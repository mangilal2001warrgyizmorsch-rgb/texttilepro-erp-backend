import { Router } from "express";
import Order from "../models/Order.js";
import Lot from "../models/Lot.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/stamping — list Pending Lots for Stamping
router.get("/", requireAuth, async (req, res, next) => {
  try {
    // Find orders with at least one unstamped taka
    // Use correct status values matching the Order schema enum
    const ordersWithUnstamped = await Order.find({
      status: { $in: ["Lot Created", "Stamping Done", "In Process", "Challan Created"] },
      "takaDetails.isStamped": false
    }, "_id");

    const orderIds = ordersWithUnstamped.map(o => o._id);

    // Find Lots associated with these orders
    const lots = await Lot.find({ orderId: { $in: orderIds } }).sort({ createdAt: -1 });

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
    const { takaMarka, weaverChNo, weaverMarka, baleNo, lotNo } = req.query;
    
    // 1. Identify valid orders based on status and filters
    // Use correct status values matching the Order schema enum
    let orderQuery = {
      status: { $in: ["Lot Created", "Stamping Done", "In Process", "Challan Created"] },
      "takaDetails.isStamped": false
    };

    if (weaverChNo) orderQuery.weaverChNo = { $regex: weaverChNo, $options: "i" };
    if (weaverMarka) orderQuery["marka"] = { $regex: weaverMarka, $options: "i" };
    if (baleNo) orderQuery.baleNo = { $regex: baleNo, $options: "i" };
    
    // If takaMarka is provided, search in the taka's marka field AND takaNo field
    if (takaMarka) {
      orderQuery["$or"] = [
        { "takaDetails.marka": { $regex: takaMarka, $options: "i" } },
        { "takaDetails.takaNo": { $regex: takaMarka, $options: "i" } },
        { "marka": { $regex: takaMarka, $options: "i" } }
      ];
    }

    let orders = await Order.find(orderQuery);
    let orderIds = orders.map(o => o._id);

    // 2. Find Lots for these orders (Mandatory filter: only Taka with assigned lots)
    let lotQuery = { orderId: { $in: orderIds } };
    if (lotNo) {
      // Escape special regex characters in lotNo (especially /)
      const escapedLotNo = lotNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      lotQuery.lotNo = { $regex: escapedLotNo, $options: "i" };
    }
    
    const lots = await Lot.find(lotQuery);
    const validOrderIdsWithLots = lots.map(l => l.orderId.toString());

    // Filter orders to only those that have a corresponding lot
    orders = orders.filter(o => validOrderIdsWithLots.includes(o._id.toString()));

    const results = [];
    for (const order of orders) {
      const lot = lots.find(l => l.orderId.toString() === order._id.toString());
      if (!lot) continue; // Safety check

      for (let takaIndex = 0; takaIndex < order.takaDetails.length; takaIndex++) {
        const taka = order.takaDetails[takaIndex];
        if (!taka.isStamped) {
          // In-memory filters for specific taka row matches
          
          // 1. Taka Marka filter: search against takaNo and marka fields
          if (takaMarka) {
            const regex = new RegExp(takaMarka.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
            const takaNoMatch = regex.test(taka.takaNo || "");
            const markaMatch = regex.test(taka.marka || "");
            const orderMarkaMatch = regex.test(order.marka || "");
            if (!takaNoMatch && !markaMatch && !orderMarkaMatch) continue;
          }

          results.push({
            orderId: order._id,
            lotNo: lot.lotNo,
            partyMarka: order.marka,
            takaNo: taka.takaNo,
            takaMeter: taka.meter,
            takaMarka: taka.marka || order.marka,
            takaIndex: takaIndex, // Use index for precise taka identification
            takaSerialNo: takaIndex + 1,
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
    const { orderId, takaIndex } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    
    const now = new Date().toISOString();
    
    // Use takaIndex for precise taka identification
    if (takaIndex !== undefined && takaIndex >= 0 && takaIndex < order.takaDetails.length) {
      const taka = order.takaDetails[takaIndex];
      order.takaDetails[takaIndex] = { ...taka.toObject(), isStamped: true, stampedAt: now };
    }
    
    // Only update status to "Stamping Done" if ALL takas are stamped
    const allStamped = order.takaDetails.every(t => t.isStamped);
    if (allStamped) {
      order.status = "Stamping Done";
    }
    
    await order.save();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/stamping/stamp-multiple
router.post("/stamp-multiple", requireAuth, async (req, res, next) => {
  try {
    const { items, stampmanId, stampmanName, stampmanCode } = req.body;
    // items: Array of { orderId, takaIndex }
    const now = new Date().toISOString();

    // Group items by orderId for efficient saving
    const grouped = items.reduce((acc, item) => {
      acc[item.orderId] = acc[item.orderId] || [];
      acc[item.orderId].push(item.takaIndex);
      return acc;
    }, {});

    for (const orderId in grouped) {
      const order = await Order.findById(orderId);
      if (order) {
        const takaIndicesToStamp = grouped[orderId];
        
        // Stamp only the selected takas by index
        order.takaDetails = order.takaDetails.map((t, idx) => 
          takaIndicesToStamp.includes(idx) ? { 
            ...t.toObject(), 
            isStamped: true, 
            stampedAt: now,
            stampmanId: stampmanId || undefined,
            stampmanName: stampmanName || undefined,
            stampmanCode: stampmanCode || undefined
          } : t
        );
        
        // Only update status to "Stamping Done" if ALL takas are stamped
        const allStamped = order.takaDetails.every(t => t.isStamped);
        if (allStamped) {
          order.status = "Stamping Done";
        }
        // If partially stamped, keep existing status (don't change to "Stamping Done")
        
        await order.save();
      }
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/stamping/unstamp
router.post("/unstamp", requireAuth, async (req, res, next) => {
  try {
    const { orderId, takaIndex } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    
    if (takaIndex !== undefined && takaIndex >= 0 && takaIndex < order.takaDetails.length) {
      const taka = order.takaDetails[takaIndex];
      order.takaDetails[takaIndex] = { ...taka.toObject(), isStamped: false, stampedAt: undefined };
    }
    
    // Revert status if not all stamped
    const allStamped = order.takaDetails.every(t => t.isStamped);
    if (!allStamped && order.status === "Stamping Done") {
      order.status = "Lot Created";
    }
    
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
    order.status = "Stamping Done";
    await order.save();
    res.json(order.takaDetails);
  } catch (err) { next(err); }
});

export default router;
