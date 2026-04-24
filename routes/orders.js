import { Router } from "express";
import Order from "../models/Order.js";
import Challan from "../models/Challan.js";
import Lot from "../models/Lot.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

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
      status: "PendingChallan",
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
    const today = new Date();
    const dateStr = today.getFullYear().toString() + 
                    (today.getMonth() + 1).toString().padStart(2, "0") + 
                    today.getDate().toString().padStart(2, "0");

    for (const data of challans) {
      // 1. Create Order
      const order = await Order.create({
        ...data,
        status: "LotCreated", // Skip PendingChallan since we are doing everything at once
      });

      // 2. Create Internal Challan (Required for Lot model)
      const challan = await Challan.create({
        challanDate: data.challan_date || data.date || new Date().toISOString().split('T')[0],
        challanNo: data.challan_no,
        orderId: order._id,
        firmId: data.firmId || data.partyId, // Fallback if specific IDs aren't provided
        firmName: data.firm || data.partyName,
        marka: data.marka || data.weaverMarka,
        totalTaka: Number(data.taka || data.takaCount),
        totalMeter: Number(data.meter || data.totalMeter),
        status: "LotCreated",
      });

      // 3. Generate Lot No and Create Lot
      const lastLot = await Lot.findOne().sort({ createdAt: -1 });
      let seq = 1;
      if (lastLot) {
        const parts = lastLot.lotNo.split("-");
        const lastSeq = parseInt(parts[parts.length - 1] || "0", 10);
        if (!isNaN(lastSeq)) seq = lastSeq + 1;
      }
      const lotNo = `LOT-${dateStr}-${seq.toString().padStart(4, "0")}`;

      const lot = await Lot.create({
        lotNo,
        challanId: challan._id,
        orderId: order._id,
        partyId: data.partyId,
        partyName: data.party || data.partyName,
        marka: data.marka || data.weaverMarka,
        qualityName: data.quality || data.qualityName,
        totalTaka: Number(data.taka || data.takaCount),
        totalMeter: Number(data.meter || data.totalMeter),
        balanceMeter: Number(data.meter || data.totalMeter),
        status: "InStorage",
      });

      results.push({ order, challan, lot });
    }

    res.status(201).json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
