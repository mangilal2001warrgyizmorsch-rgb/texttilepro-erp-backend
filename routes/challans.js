import { Router } from "express";
import Challan from "../models/Challan.js";
import Order from "../models/Order.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

async function generateChallanNo() {
  const today = new Date();
  const dateStr = today.getFullYear().toString() + (today.getMonth() + 1).toString().padStart(2, "0") + today.getDate().toString().padStart(2, "0");
  const last = await Challan.findOne().sort({ createdAt: -1 });
  let seq = 1;
  if (last) {
    const parts = last.challanNo.split("-");
    const lastSeq = parseInt(parts[parts.length - 1] || "0", 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `CH-${dateStr}-${seq.toString().padStart(4, "0")}`;
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    res.json(await Challan.find(filter).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
});

router.get("/by-order/:orderId", requireAuth, async (req, res, next) => {
  try {
    res.json(await Challan.find({ orderId: req.params.orderId }));
  } catch (err) { next(err); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const c = await Challan.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Challan not found" });
    res.json(c);
  } catch (err) { next(err); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const challanNo = await generateChallanNo();
    const challan = await Challan.create({ ...req.body, challanNo, status: "Active" });
    await Order.findByIdAndUpdate(req.body.orderId, { status: "ChallanIssued" });
    res.status(201).json(challan);
  } catch (err) { next(err); }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const c = await Challan.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Challan not found" });
    await Order.findByIdAndUpdate(c.orderId, { status: "PendingChallan" });
    await Challan.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
