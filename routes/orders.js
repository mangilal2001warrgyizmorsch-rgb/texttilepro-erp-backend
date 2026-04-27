import { Router } from "express";
import Order from "../models/Order.js";
import Challan from "../models/Challan.js";
import Lot from "../models/Lot.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/orders
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// POST /api/orders
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const order = await Order.create({
      ...req.body,
      status: "draft",
    });
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/orders/:id
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/orders/:id
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/batch
router.post("/batch", requireAuth, async (req, res, next) => {
  try {
    const { challans } = req.body;
    if (!Array.isArray(challans)) {
      return res.status(400).json({ error: "Challans must be an array" });
    }

    const results = [];

    for (const data of challans) {
      // 1. Create Order with draft status
      const order = await Order.create({
        ...data,
        status: "draft",
      });

      results.push({ order, message: "Order created successfully. Create challan to proceed." });
    }

    res.status(201).json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
