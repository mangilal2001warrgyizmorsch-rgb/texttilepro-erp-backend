import { Router } from "express";
import Lot from "../models/Lot.js";
import Challan from "../models/Challan.js";
import Order from "../models/Order.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

async function generateLotNo() {
  const today = new Date();
  const dateStr =
    today.getFullYear().toString() +
    (today.getMonth() + 1).toString().padStart(2, "0") +
    today.getDate().toString().padStart(2, "0");
  const last = await Lot.findOne().sort({ createdAt: -1 });
  let seq = 1;
  if (last) {
    const parts = last.lotNo.split("-");
    const lastSeq = parseInt(parts[parts.length - 1] || "0", 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `LOT-${dateStr}-${seq.toString().padStart(4, "0")}`;
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    res.json(await Lot.find(filter).sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

router.get("/by-challan/:challanId", requireAuth, async (req, res, next) => {
  try {
    res.json(await Lot.find({ challanId: req.params.challanId }));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const lot = await Lot.findById(req.params.id)
      .populate("orderId")
      .populate("challanId");
    if (!lot) return res.status(404).json({ error: "Lot not found" });
    res.json(lot);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findById(req.body.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Verify challan exists and is in correct status
    const challan = await Challan.findById(req.body.challanId);
    if (!challan) return res.status(404).json({ error: "Challan not found" });
    if (challan.status !== "pending")
      return res
        .status(400)
        .json({ error: "Challan must be in pending status to create lot" });

    const lotNo = await generateLotNo();
    const lotData = {
      ...req.body,
      qualityName: req.body.qualityName || order.qualityName,
      lotNo,
      balanceMeter: req.body.totalMeter,
      status: "InStorage",
    };

    const lot = await Lot.create(lotData);
    await Challan.findByIdAndUpdate(req.body.challanId, {
      status: "LotCreated",
    });
    await Order.findByIdAndUpdate(req.body.orderId, { status: "LotCreated" });
    res.status(201).json(lot);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", requireAuth, async (req, res, next) => {
  try {
    const lot = await Lot.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!lot) return res.status(404).json({ error: "Lot not found" });
    res.json(lot);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const lot = await Lot.findById(req.params.id);
    if (!lot) return res.status(404).json({ error: "Lot not found" });
    await Challan.findByIdAndUpdate(lot.challanId, { status: "Active" });
    await Order.findByIdAndUpdate(lot.orderId, { status: "ChallanIssued" });
    await Lot.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
