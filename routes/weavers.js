import { Router } from "express";
import Account from "../models/Account.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/weavers -> Filter accounts by roleType "Weaver"
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const weavers = await Account.find({ roleType: "Weaver" }).sort({ createdAt: -1 });
    // Map accountName to weaverName for frontend compatibility
    const mapped = weavers.map(w => ({
      ...w.toObject(),
      weaverName: w.accountName,
      weaverCode: w.clientCode
    }));
    res.json(mapped);
  } catch (err) {
    next(err);
  }
});

// GET /api/weavers/:id
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const weaver = await Account.findOne({ _id: req.params.id, roleType: "Weaver" });
    if (!weaver) return res.status(404).json({ error: "Weaver not found" });
    res.json({
      ...weaver.toObject(),
      weaverName: weaver.accountName,
      weaverCode: weaver.clientCode
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/weavers -> Create as Account with roleType "Weaver"
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const data = {
      ...req.body,
      accountName: req.body.weaverName,
      clientCode: req.body.weaverCode,
      roleType: "Weaver",
      isActive: true
    };
    const weaver = await Account.create(data);
    res.status(201).json({
      ...weaver.toObject(),
      weaverName: weaver.accountName,
      weaverCode: weaver.clientCode
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/weavers/:id
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.weaverName) data.accountName = data.weaverName;
    if (data.weaverCode) data.clientCode = data.weaverCode;
    
    const weaver = await Account.findOneAndUpdate(
      { _id: req.params.id, roleType: "Weaver" },
      data,
      { new: true }
    );
    if (!weaver) return res.status(404).json({ error: "Weaver not found" });
    res.json({
      ...weaver.toObject(),
      weaverName: weaver.accountName,
      weaverCode: weaver.clientCode
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/weavers/:id
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await Account.findOneAndDelete({ _id: req.params.id, roleType: "Weaver" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
