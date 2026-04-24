import { Router } from "express";
import CodeMaster from "../models/CodeMaster.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/code-master
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const codes = await CodeMaster.find().sort({ createdAt: -1 });
    res.json(codes);
  } catch (err) {
    next(err);
  }
});

// GET /api/code-master/by-account/:accountId
router.get("/by-account/:accountId", requireAuth, async (req, res, next) => {
  try {
    const codes = await CodeMaster.find({ accountId: req.params.accountId });
    res.json(codes);
  } catch (err) {
    next(err);
  }
});

// POST /api/code-master
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const code = await CodeMaster.create(req.body);
    res.status(201).json(code);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/code-master/:id
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const code = await CodeMaster.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!code) return res.status(404).json({ error: "Code not found" });
    res.json(code);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/code-master/:id
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await CodeMaster.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
