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
    const { takaMarka, weaverChNo, weaverMarka, baleNo, lotNo, takaNo } = req.query;
    
    // 1. Identify valid orders based on status and filters
    let orderQuery = {
      status: { $in: ["ChallanIssued", "LotCreated", "InProcess", "Finished"] },
      "takaDetails.isStamped": false
    };

    if (weaverChNo) orderQuery.weaverChNo = { $regex: weaverChNo, $options: "i" };
    if (weaverMarka) orderQuery.weaverMarka = { $regex: weaverMarka, $options: "i" };
    if (baleNo) orderQuery.baleNo = { $regex: baleNo, $options: "i" };
    
    // If takaMarka is provided, search in either the order's main marka OR the taka's specific marka
    if (takaMarka) {
      orderQuery.$or = [
        { "marka": { $regex: takaMarka, $options: "i" } },
        { "takaDetails.marka": { $regex: takaMarka, $options: "i" } }
      ];
    }

    // If takaNo is provided, ensure the order has that taka
    if (takaNo) {
      orderQuery["takaDetails.takaNo"] = { $regex: takaNo, $options: "i" };
    }

    let orders = await Order.find(orderQuery);
    let orderIds = orders.map(o => o._id);

    // 2. Find Lots for these orders (Mandatory filter: only Taka with assigned lots)
    let lotQuery = { orderId: { $in: orderIds } };
    if (lotNo) {
      lotQuery.lotNo = { $regex: lotNo, $options: "i" };
    }
    
    const lots = await Lot.find(lotQuery);
    const validOrderIdsWithLots = lots.map(l => l.orderId.toString());

    // Filter orders to only those that have a corresponding lot
    orders = orders.filter(o => validOrderIdsWithLots.includes(o._id.toString()));

    const results = [];
    for (const order of orders) {
      const lot = lots.find(l => l.orderId.toString() === order._id.toString());
      if (!lot) continue; // Safety check

      for (const taka of order.takaDetails) {
        if (!taka.isStamped) {
          // In-memory filters for specific taka row matches
          
          // 1. Taka Marka fallback match
          if (takaMarka) {
            const regex = new RegExp(takaMarka, "i");
            const resolvedMarka = taka.marka || order.marka || "";
            if (!regex.test(resolvedMarka)) continue;
          }

          // 2. Taka No specific match
          if (takaNo) {
            const regex = new RegExp(takaNo, "i");
            if (!regex.test(taka.takaNo || "")) continue;
          }

          results.push({
            orderId: order._id,
            lotNo: lot.lotNo,
            partyMarka: order.marka,
            takaNo: taka.takaNo,
            takaMeter: taka.meter,
            takaMarka: taka.marka || order.marka, // Fallback to Party Marka
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
        order.status = "Stamping Done"; // Update status
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

