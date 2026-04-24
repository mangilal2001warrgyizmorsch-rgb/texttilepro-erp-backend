import { Router } from "express";
import Dispatch from "../models/Dispatch.js";
import Lot from "../models/Lot.js";
import Order from "../models/Order.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    res.json(await Dispatch.find(filter).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
});

router.get("/by-party/:partyId", requireAuth, async (req, res, next) => {
  try { res.json(await Dispatch.find({ partyId: req.params.partyId }).sort({ createdAt: -1 })); }
  catch (err) { next(err); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const d = await Dispatch.findById(req.params.id);
    if (!d) return res.status(404).json({ error: "Dispatch not found" });
    res.json(d);
  } catch (err) { next(err); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const last = await Dispatch.findOne().sort({ createdAt: -1 });
    let seq = 1;
    if (last && last.dispatchNo.startsWith(`DSP-${dateStr}`)) {
      const parts = last.dispatchNo.split("-");
      seq = parseInt(parts[parts.length - 1]) + 1;
    }
    const dispatchNo = `DSP-${dateStr}-${String(seq).padStart(4, "0")}`;
    const dispatch = await Dispatch.create({ ...req.body, dispatchNo, status: "Dispatched" });
    await Lot.findByIdAndUpdate(req.body.lotId, { status: "Dispatched" });
    await Order.findByIdAndUpdate(req.body.orderId, { status: "Dispatched" });
    res.status(201).json(dispatch);
  } catch (err) { next(err); }
});

router.patch("/:id/mark-billed", requireAuth, async (req, res, next) => {
  try {
    const d = await Dispatch.findByIdAndUpdate(req.params.id, { status: "Billed" }, { new: true });
    if (!d) return res.status(404).json({ error: "Dispatch not found" });
    res.json(d);
  } catch (err) { next(err); }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await Dispatch.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
