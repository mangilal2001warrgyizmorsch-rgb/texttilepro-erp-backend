import { Router } from "express";
import JobCard from "../models/JobCard.js";
import Lot from "../models/Lot.js";
import Order from "../models/Order.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

async function generateJobCardNo() {
  const today = new Date();
  const dateStr = today.getFullYear().toString() + (today.getMonth() + 1).toString().padStart(2, "0") + today.getDate().toString().padStart(2, "0");
  const last = await JobCard.findOne().sort({ createdAt: -1 });
  let seq = 1;
  if (last) {
    const parts = last.jobCardNo.split("-");
    const lastSeq = parseInt(parts[parts.length - 1] || "0", 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `JC-${dateStr}-${seq.toString().padStart(4, "0")}`;
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    res.json(await JobCard.find(filter).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
});

router.get("/by-lot/:lotId", requireAuth, async (req, res, next) => {
  try { res.json(await JobCard.find({ lotId: req.params.lotId })); }
  catch (err) { next(err); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const jc = await JobCard.findById(req.params.id);
    if (!jc) return res.status(404).json({ error: "Job card not found" });
    res.json(jc);
  } catch (err) { next(err); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const jobCardNo = await generateJobCardNo();
    const jc = await JobCard.create({ ...req.body, jobCardNo, status: "Open" });
    res.status(201).json(jc);
  } catch (err) { next(err); }
});

router.patch("/:id/recipe", requireAuth, async (req, res, next) => {
  try {
    const jc = await JobCard.findByIdAndUpdate(req.params.id, { ...req.body, status: "InProgress" }, { new: true });
    if (!jc) return res.status(404).json({ error: "Job card not found" });
    res.json(jc);
  } catch (err) { next(err); }
});

router.patch("/:id/production", requireAuth, async (req, res, next) => {
  try {
    const jc = await JobCard.findById(req.params.id);
    if (!jc) return res.status(404).json({ error: "Job card not found" });
    const shortage = jc.inputMeter - req.body.finishedMeter;
    const completedAt = new Date().toISOString();
    await JobCard.findByIdAndUpdate(req.params.id, { finishedMeter: req.body.finishedMeter, shortage, completedAt, status: "Completed" });
    await Lot.findByIdAndUpdate(jc.lotId, { finishedMeter: req.body.finishedMeter, shortage, balanceMeter: req.body.finishedMeter, status: "Finished" });
    await Order.findByIdAndUpdate(jc.orderId, { status: "Completed" });
    const updated = await JobCard.findById(req.params.id);
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await JobCard.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
