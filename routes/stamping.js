import { Router } from "express";
import Order from "../models/Order.js";
import Lot from "../models/Lot.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/stamping — list Pending Lots for Stamping
router.get("/", requireAuth, async (req, res, next) => {
  try {
    // Find orders with unstamped takas
    const ordersWithUnstamped = await Order.find({
      status: { $in: ["ChallanIssued", "LotCreated", "InProcess"] },
      "takaDetails.isStamped": false
    }, "_id");

    const orderIds = ordersWithUnstamped.map(o => o._id);

    // Find Lots associated with these orders
    const lots = await Lot.find({ orderId: { $in: orderIds } }).sort({ createdAt: -1 });

    // The user wants: Date, Lot No, Party Name, Master Name, Quality, Total Taka, Total Meter
    const response = lots.map(lot => ({
      _id: lot._id,
      orderId: lot.orderId,
      date: lot.createdAt,
      lotNo: lot.lotNo,
      partyName: lot.partyName,
      masterName: lot.masterName,
      qualityName: lot.qualityName,
      totalTaka: lot.totalTaka,
      totalMeter: lot.totalMeter
    }));

    res.json(response);
  } catch (err) { next(err); }
});

// GET /api/stamping/search-taka — Search for Unstamped Taka
router.get("/search-taka", requireAuth, async (req, res, next) => {
  try {
    const { takaMarka, weaverChNo, weaverMarka, baleNo } = req.query;
    
    let query = {
      status: { $in: ["ChallanIssued", "LotCreated", "InProcess"] },
      "takaDetails.isStamped": false
    };

    if (weaverChNo) query.weaverChNo = { $regex: weaverChNo, $options: "i" };
    if (weaverMarka) query.weaverMarka = { $regex: weaverMarka, $options: "i" };
    if (baleNo) query.baleNo = { $regex: baleNo, $options: "i" };
    if (takaMarka) query["takaDetails.marka"] = { $regex: takaMarka, $options: "i" };

    const orders = await Order.find(query);
    const orderIds = orders.map(o => o._id);
    const lots = await Lot.find({ orderId: { $in: orderIds } });

    const results = [];
    for (const order of orders) {
      const lot = lots.find(l => l.orderId.toString() === order._id.toString());
      for (const taka of order.takaDetails) {
        if (!taka.isStamped) {
          // If takaMarka filter is provided, check if this specific taka matches
          if (takaMarka && !new RegExp(takaMarka, "i").test(taka.marka)) continue;

          results.push({
            orderId: order._id,
            lotNo: lot?.lotNo || "N/A",
            partyMarka: order.marka,
            takaNo: taka.takaNo,
            takaMeter: taka.meter,
            takaMarka: taka.marka,
            weaverChNo: order.weaverChNo,
            weaverMarka: order.weaverMarka,
            baleNo: order.baleNo
          });
        }
      }
    }

    res.json(results);
  } catch (err) { next(err); }
});

// POST /api/stamping/stamp
router.post("/stamp", requireAuth, async (req, res, next) => {
  try {
    const { orderId, takaNo } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    
    const now = new Date().toISOString();
    order.takaDetails = order.takaDetails.map(t => 
      t.takaNo === takaNo ? { ...t.toObject(), isStamped: true, stampedAt: now } : t
    );
    
    await order.save();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/stamping/stamp-multiple
router.post("/stamp-multiple", requireAuth, async (req, res, next) => {
  try {
    const { items } = req.body; // Array of { orderId, takaNo }
    const now = new Date().toISOString();

    // Group items by orderId for efficient saving
    const grouped = items.reduce((acc, item) => {
      acc[item.orderId] = acc[item.orderId] || [];
      acc[item.orderId].push(item.takaNo);
      return acc;
    }, {});

    for (const orderId in grouped) {
      const order = await Order.findById(orderId);
      if (order) {
        const takaNosToStamp = grouped[orderId];
        order.takaDetails = order.takaDetails.map(t => 
          takaNosToStamp.includes(t.takaNo) ? { ...t.toObject(), isStamped: true, stampedAt: now } : t
        );
        await order.save();
      }
    }

    res.json({ success: true });
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

