import { Router } from "express";
import Weaver from "../models/Weaver.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const weavers = await Weaver.find().sort({ createdAt: -1 });
    res.json(weavers);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const weaver = await Weaver.findById(req.params.id);
    if (!weaver) return res.status(404).json({ error: "Weaver not found" });
    res.json(weaver);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const weaver = await Weaver.create(req.body);
    res.status(201).json(weaver);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const weaver = await Weaver.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!weaver) return res.status(404).json({ error: "Weaver not found" });
    res.json(weaver);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await Weaver.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
