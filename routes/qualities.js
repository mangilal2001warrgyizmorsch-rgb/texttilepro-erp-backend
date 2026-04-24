import { Router } from "express";
import Quality from "../models/Quality.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const qualities = await Quality.find().sort({ createdAt: -1 });
    res.json(qualities);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const quality = await Quality.findById(req.params.id);
    if (!quality) return res.status(404).json({ error: "Quality not found" });
    res.json(quality);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const quality = await Quality.create(req.body);
    res.status(201).json(quality);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const quality = await Quality.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!quality) return res.status(404).json({ error: "Quality not found" });
    res.json(quality);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await Quality.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
