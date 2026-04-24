import { Router } from "express";
import Order from "../models/Order.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/stamping — list stampable orders
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const orders = await Order.find({ status: { $in: ["ChallanIssued", "LotCreated", "InProcess"] } }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { next(err); }
});

// POST /api/stamping/stamp
router.post("/stamp", requireAuth, async (req, res, next) => {
  try {
    const { orderId, takaNo } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    const now = new Date().toISOString();
    order.takaDetails = order.takaDetails.map(t => t.takaNo === takaNo ? { ...t.toObject(), isStamped: true, stampedAt: now } : t);
    await order.save();
    res.json(order.takaDetails);
  } catch (err) { next(err); }
});

// POST /api/stamping/unstamp
router.post("/unstamp", requireAuth, async (req, res, next) => {
  try {
    const { orderId, takaNo } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    order.takaDetails = order.takaDetails.map(t => t.takaNo === takaNo ? { ...t.toObject(), isStamped: false, stampedAt: undefined } : t);
    await order.save();
    res.json(order.takaDetails);
  } catch (err) { next(err); }
});

// POST /api/stamping/stamp-all
router.post("/stamp-all", requireAuth, async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    const now = new Date().toISOString();
    order.takaDetails = order.takaDetails.map(t => ({ ...t.toObject(), isStamped: true, stampedAt: t.stampedAt || now }));
    await order.save();
    res.json(order.takaDetails);
  } catch (err) { next(err); }
});

export default router;
