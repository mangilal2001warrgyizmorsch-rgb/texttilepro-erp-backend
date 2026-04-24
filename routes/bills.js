import { Router } from "express";
import Bill from "../models/Bill.js";
import Dispatch from "../models/Dispatch.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    res.json(await Bill.find(filter).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
});

router.get("/by-party/:partyId", requireAuth, async (req, res, next) => {
  try { res.json(await Bill.find({ partyId: req.params.partyId }).sort({ createdAt: -1 })); }
  catch (err) { next(err); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const b = await Bill.findById(req.params.id);
    if (!b) return res.status(404).json({ error: "Bill not found" });
    res.json(b);
  } catch (err) { next(err); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const last = await Bill.findOne().sort({ createdAt: -1 });
    let seq = 1;
    if (last && last.billNo.startsWith(`BILL-${dateStr}`)) {
      const parts = last.billNo.split("-");
      seq = parseInt(parts[parts.length - 1]) + 1;
    }
    const billNo = `BILL-${dateStr}-${String(seq).padStart(4, "0")}`;
    const bill = await Bill.create({ ...req.body, billNo, status: "Draft" });
    // Mark dispatches as Billed
    if (req.body.dispatchIds) {
      for (const dId of req.body.dispatchIds) {
        await Dispatch.findByIdAndUpdate(dId, { status: "Billed" });
      }
    }
    res.status(201).json(bill);
  } catch (err) { next(err); }
});

router.patch("/:id/status", requireAuth, async (req, res, next) => {
  try {
    const b = await Bill.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!b) return res.status(404).json({ error: "Bill not found" });
    res.json(b);
  } catch (err) { next(err); }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const b = await Bill.findById(req.params.id);
    if (!b) return res.status(404).json({ error: "Bill not found" });
    if (b.status !== "Draft") return res.status(400).json({ error: "Only Draft bills can be deleted" });
    await Bill.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
