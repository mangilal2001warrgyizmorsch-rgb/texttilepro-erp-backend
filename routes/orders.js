import { Router } from "express";
import Order from "../models/Order.js";
import Challan from "../models/Challan.js";
import Lot from "../models/Lot.js";
import Account from "../models/Account.js";
import Quality from "../models/Quality.js";
import CodeMaster from "../models/CodeMaster.js";
import Vehicle from "../models/Vehicle.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Helper to build a master detail snapshot from an Account document
function buildMasterSnapshot(account) {
  if (!account) return null;
  return {
    name: account.accountName || "",
    gstin: account.gstin || "",
    panNo: account.panNo || "",
    address: account.address || "",
    city: account.city || "",
    state: account.state || "",
    pincode: account.pincode || "",
    mobileNo: account.mobileNo || "",
    email: account.email || "",
    gstType: account.gstType || "",
    clientCode: account.clientCode || "",
  };
}

// Helper to validate and enrich order data with master lookups
async function enrichOrderData(data) {
  const enriched = { ...data };

  // Sanitize empty strings to undefined for ObjectId fields to prevent Mongoose cast errors
  const objectIdFields = [
    "firmId",
    "partyId",
    "weaverId",
    "qualityId",
    "transporterId",
    "codeMasterId",
  ];
  objectIdFields.forEach((field) => {
    if (enriched[field] === "" || enriched[field] === "CUSTOM") {
      enriched[field] = undefined;
    }
  });

  try {
    // 1. Resolve Firm — and populate firmDetails snapshot
    if (enriched.firmId && !enriched.firmDetails) {
      const firm = await Account.findById(enriched.firmId);
      if (firm) {
        enriched.firmDetails = buildMasterSnapshot(firm);
        enriched.firmName = enriched.firmName || firm.accountName;
      }
    } else if (!enriched.firmId && enriched.firmName) {
      const firm = await Account.findOne({
        accountName: { $regex: new RegExp(`^${enriched.firmName}$`, "i") },
        roleType: "Mill",
      });
      if (firm) {
        enriched.firmId = firm._id;
        enriched.firmDetails = buildMasterSnapshot(firm);
      }
    }

    // 2. Resolve Party — and populate partyDetails snapshot
    if (enriched.partyId && !enriched.partyDetails) {
      const party = await Account.findById(enriched.partyId);
      if (party) {
        enriched.partyDetails = buildMasterSnapshot(party);
        enriched.partyName = enriched.partyName || party.accountName;
        enriched.partyGstin = enriched.partyGstin || party.gstin || "";
        enriched.partyAddress = enriched.partyAddress || party.address || "";
      }
    } else if (!enriched.partyId && enriched.partyName) {
      const party = await Account.findOne({
        accountName: { $regex: new RegExp(`^${enriched.partyName}$`, "i") },
        roleType: { $in: ["Master", "Customer", "Supplier"] },
      });
      if (party) {
        enriched.partyId = party._id;
        enriched.partyDetails = buildMasterSnapshot(party);
        enriched.partyGstin = enriched.partyGstin || party.gstin || "";
        enriched.partyAddress = enriched.partyAddress || party.address || "";
      }
    }

    // 3. Resolve Quality — Auto-create or Update Master
    const normalizeQualityName = (value = "") => value.trim().toUpperCase().replace(/[-_/]/g, " ").replace(/\s+/g, " ");
    
    let quality = null;
    if (enriched.qualityId) {
      quality = await Quality.findById(enriched.qualityId);
    } else if (enriched.qualityName) {
      const scannedName = normalizeQualityName(enriched.qualityName);
      quality = await Quality.findOne({ normalizedName: scannedName });
      
      // Fallback in case old DB records aren't fully migrated
      if (!quality) {
        const allQualities = await Quality.find({});
        quality = allQualities.find((q) => normalizeQualityName(q.qualityName) === scannedName);
      }
    }

    if (quality) {
      // Update master with any new details provided in the order
      let needsUpdate = false;
      if (!quality.normalizedName) { quality.normalizedName = normalizeQualityName(quality.qualityName); needsUpdate = true; }
      if (enriched.hsnCode && !quality.hsnCode) { quality.hsnCode = enriched.hsnCode; needsUpdate = true; }
      if (enriched.itemDescription && !quality.itemDescription) { quality.itemDescription = enriched.itemDescription; needsUpdate = true; }
      if (enriched.width && !quality.width) { quality.width = enriched.width; needsUpdate = true; }
      if (enriched.jobRate && !quality.defaultJobRate) { quality.defaultJobRate = enriched.jobRate; needsUpdate = true; }
      if (enriched.greyRate && !quality.greyRate) { quality.greyRate = enriched.greyRate; needsUpdate = true; }

      if (needsUpdate) {
        console.log(`📋 Updating existing Quality master: "${quality.qualityName}" with new details`);
        await quality.save();
      }
    } else if (enriched.qualityName) {
      // Auto-create Quality in master if not found
      console.log(`📋 Auto-creating Quality master: "${enriched.qualityName}"`);
      const normalizedName = normalizeQualityName(enriched.qualityName);
      quality = await Quality.create({
        qualityName: enriched.qualityName.trim(),
        normalizedName: normalizedName,
        hsnCode: enriched.hsnCode || "",
        itemDescription: enriched.itemDescription || "",
        width: enriched.width || null,
        processType: enriched.processType || "Dyeing",
        defaultJobRate: enriched.jobRate || null,
        greyRate: enriched.greyRate || null,
      });
    }

    if (quality) {
      enriched.qualityId = quality._id;
      enriched.qualityDetails = {
        qualityName: quality.qualityName,
        gsm: quality.gsm || null,
        width: quality.width || null,
        unit: quality.unit || "",
        hsnCode: quality.hsnCode || "",
        processType: quality.processType || "",
        expectedLossPercent: quality.expectedLossPercent || null,
        shortPercent: quality.shortPercent || null,
        defaultJobRate: quality.defaultJobRate || null,
        greyRate: quality.greyRate || null,
        dispatchRate: quality.dispatchRate || null,
      };
      // If the user didn't enter rates/width on the form, auto-fill them from the master record we just loaded
      if (!enriched.jobRate && quality.defaultJobRate) enriched.jobRate = quality.defaultJobRate;
      if (!enriched.greyRate && quality.greyRate) enriched.greyRate = quality.greyRate;
      if (!enriched.width && quality.width) enriched.width = quality.width;
      if (!enriched.hsnCode && quality.hsnCode) enriched.hsnCode = quality.hsnCode;
      if (!enriched.itemDescription && quality.itemDescription) enriched.itemDescription = quality.itemDescription;
    }

    // 4. Resolve Weaver — and populate weaverDetails snapshot
    if (enriched.weaverId && !enriched.weaverDetails) {
      const weaver = await Account.findById(enriched.weaverId);
      if (weaver) {
        enriched.weaverDetails = buildMasterSnapshot(weaver);
        enriched.weaverName = enriched.weaverName || weaver.accountName;
        enriched.weaverGstin = enriched.weaverGstin || weaver.gstin || "";
        enriched.weaverAddress = enriched.weaverAddress || weaver.address || "";
      }
    } else if (!enriched.weaverId && enriched.weaverName) {
      const weaver = await Account.findOne({
        accountName: { $regex: new RegExp(`^${enriched.weaverName}$`, "i") },
        roleType: "Weaver",
      });
      if (weaver) {
        enriched.weaverId = weaver._id;
        enriched.weaverDetails = buildMasterSnapshot(weaver);
        enriched.weaverGstin = enriched.weaverGstin || weaver.gstin || "";
        enriched.weaverAddress = enriched.weaverAddress || weaver.address || "";
      }
    }

    // 5. Resolve Transporter — auto-create if new name provided
    if (!enriched.transporterId && enriched.transporterName) {
      let transporter = await Account.findOne({
        accountName: {
          $regex: new RegExp(`^${enriched.transporterName}$`, "i"),
        },
        roleType: "Transporter",
      });
      if (transporter) {
        enriched.transporterId = transporter._id;
      } else {
        // Auto-create new transporter in Account Master
        console.log(`🚛 Auto-creating Transporter: "${enriched.transporterName}"`);
        transporter = await Account.create({
          accountName: enriched.transporterName.trim(),
          roleType: "Transporter",
          isActive: true,
        });
        enriched.transporterId = transporter._id;
      }
    }

    // 6. Auto-save Vehicle Number to Vehicle Master
    if (enriched.vehicleNo) {
      try {
        await Vehicle.findOneAndUpdate(
          { vehicleNo: enriched.vehicleNo.toUpperCase().trim() },
          {
            vehicleNo: enriched.vehicleNo.toUpperCase().trim(),
            transporterId: enriched.transporterId || undefined,
            transporterName: enriched.transporterName || undefined,
            driverMobile: enriched.driverMobile || undefined,
          },
          { upsert: true, new: true }
        );
      } catch (vErr) {
        console.error("Vehicle auto-save failed:", vErr.message);
      }
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
    if (req.query.status) {
      const statusQuery = String(req.query.status);
      if (statusQuery.includes(",")) {
        filter.status = {
          $in: statusQuery
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        };
      } else {
        filter.status = statusQuery;
      }
    }
    const orders = await Order.find(filter).populate("codeMasterId", "masterName").sort({ createdAt: -1 });
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
    const enrichedData = await enrichOrderData(req.body);
    const order = await Order.create({
      ...enrichedData,
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
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
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
        // Enrich data with master lookups + full detail snapshots
        const enrichedData = await enrichOrderData(data);

        // Validate required fields
        const requiredFields = ["firmId", "qualityName", "totalMeter"];
        const missingFields = requiredFields.filter(
          (field) =>
            enrichedData[field] === undefined ||
            enrichedData[field] === null ||
            enrichedData[field] === "",
        );

        console.log(
          `📦 Creating order for ${enrichedData.firmName} with status: draft`,
        );
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
            missingFields.length > 0
              ? `Missing: ${missingFields.join(", ")}`
              : null,
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
    console.log(
      `🏁 Batch completed. Successfully processed ${results.filter((r) => !r.error).length}/${challans.length} orders.`,
    );

    res.status(201).json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
