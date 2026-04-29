import { Router } from "express";
import Order from "../models/Order.js";
import Challan from "../models/Challan.js";
import Lot from "../models/Lot.js";
import Account from "../models/Account.js";
import Quality from "../models/Quality.js";
import Weaver from "../models/Weaver.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Helper to validate and enrich order data with master lookups
async function enrichOrderData(data) {
  const enriched = { ...data };

  try {
    // 1. Resolve Firm
    if (!enriched.firmId && enriched.firmName) {
      const firm = await Account.findOne({
        accountName: { $regex: new RegExp(`^${enriched.firmName}$`, "i") },
        roleType: "Mill",
      });
      if (firm) enriched.firmId = firm._id;
    }

    // 2. Resolve Party
    if (!enriched.partyId && enriched.partyName) {
      const party = await Account.findOne({
        accountName: { $regex: new RegExp(`^${enriched.partyName}$`, "i") },
        roleType: { $in: ["Master", "Customer", "Supplier"] },
      });
      if (party) enriched.partyId = party._id;
    }

    // 3. Resolve Quality
    if (!enriched.qualityId && enriched.qualityName) {
      const quality = await Quality.findOne({
        qualityName: { $regex: new RegExp(`^${enriched.qualityName}$`, "i") },
      });
      if (quality) enriched.qualityId = quality._id;
    }

    // 4. Resolve Weaver
    if (!enriched.weaverId && enriched.weaverName) {
      const weaver = await Weaver.findOne({
        weaverName: { $regex: new RegExp(`^${enriched.weaverName}$`, "i") },
      });
      if (weaver) enriched.weaverId = weaver._id;
    }

    // 5. Resolve Transporter
    if (!enriched.transporterId && enriched.transporterName) {
      const transporter = await Account.findOne({
        accountName: { $regex: new RegExp(`^${enriched.transporterName}$`, "i") },
        roleType: "Transporter",
      });
      if (transporter) enriched.transporterId = transporter._id;
    }

    return enriched;
  } catch (err) {
    console.error("Error enriching order data:", err);
    return enriched; // Return original data if enrichment fails
  }
}

// GET /api/orders
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// POST /api/orders
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const order = await Order.create({
      ...req.body,
      status: "draft",
    });
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/orders/:id
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/orders/:id
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/batch
router.post("/batch", requireAuth, async (req, res, next) => {
  try {
    const { challans } = req.body;
    if (!Array.isArray(challans)) {
      return res.status(400).json({ error: "Challans must be an array" });
    }

    const results = [];

    for (const data of challans) {
      try {
        // Enrich data with master lookups
        const enrichedData = await enrichOrderData(data);

        // Validate required fields
        const requiredFields = ["firmId", "qualityName", "totalMeter"];
        const missingFields = requiredFields.filter(
          (field) => enrichedData[field] === undefined || enrichedData[field] === null || enrichedData[field] === ""
        );

        console.log(`📦 Creating order for ${enrichedData.firmName} with status: draft`);
        const order = await Order.create({
          ...enrichedData,
          status: "draft",
          ocrExtractedData: data.ocrExtractedData
            ? JSON.stringify(data.ocrExtractedData)
            : undefined,
        });
        console.log(`✅ Created Order ID: ${order._id}`);

        results.push({
          order,
          message: "Order created successfully. Create challan to proceed.",
          validationWarnings:
            missingFields.length > 0 ? `Missing: ${missingFields.join(", ")}` : null,
        });
      } catch (itemErr) {
        console.error("❌ Error creating individual order in batch:", itemErr);
        results.push({
          error: itemErr.message,
          message: "Failed to create this order",
          data: data,
        });
      }
    }
    console.log(`🏁 Batch completed. Successfully processed ${results.filter(r => !r.error).length}/${challans.length} orders.`);

    res.status(201).json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
