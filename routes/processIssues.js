import { Router } from "express";
import ProcessIssue from "../models/ProcessIssue.js";
import Lot from "../models/Lot.js";
import Order from "../models/Order.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

async function generateIssueNo() {
  const today = new Date();
  const dateStr = today.getFullYear().toString() + (today.getMonth() + 1).toString().padStart(2, "0") + today.getDate().toString().padStart(2, "0");
  const last = await ProcessIssue.findOne().sort({ createdAt: -1 });
  let seq = 1;
  if (last) {
    const parts = last.issueNo.split("-");
    const lastSeq = parseInt(parts[parts.length - 1] || "0", 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `PI-${dateStr}-${seq.toString().padStart(4, "0")}`;
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    res.json(await ProcessIssue.find(filter).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
});

router.get("/by-lot/:lotId", requireAuth, async (req, res, next) => {
  try { res.json(await ProcessIssue.find({ lotId: req.params.lotId })); }
  catch (err) { next(err); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const pi = await ProcessIssue.findById(req.params.id);
    if (!pi) return res.status(404).json({ error: "Process issue not found" });
    res.json(pi);
  } catch (err) { next(err); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const issueNo = await generateIssueNo();
    const pi = await ProcessIssue.create({ ...req.body, issueNo, status: "Issued" });
    await Lot.findByIdAndUpdate(req.body.lotId, { status: "InProcess" });
    await Order.findByIdAndUpdate(req.body.orderId, { status: "InProcess" });
    res.status(201).json(pi);
  } catch (err) { next(err); }
});

router.patch("/:id/complete", requireAuth, async (req, res, next) => {
  try {
    const pi = await ProcessIssue.findByIdAndUpdate(req.params.id, { status: "Completed" }, { new: true });
    if (!pi) return res.status(404).json({ error: "Process issue not found" });
    res.json(pi);
  } catch (err) { next(err); }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const pi = await ProcessIssue.findById(req.params.id);
    if (!pi) return res.status(404).json({ error: "Process issue not found" });
    await Lot.findByIdAndUpdate(pi.lotId, { status: "InStorage" });
    await ProcessIssue.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
