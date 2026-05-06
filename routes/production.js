import { Router } from "express";
import Order from "../models/Order.js";
import Lot from "../models/Lot.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/production — List lots pending finish meter entry
router.get("/", requireAuth, async (req, res, next) => {
  try {
    // Find orders that have at least one stamped taka but not all finish-completed
    // This is a bit complex in Mongo, so let's get orders that are "Stamping Done" or "In Process"
    // and have pending finish takas.
    const orders = await Order.find({
      "takaDetails": {
        $elemMatch: { isStamped: true, isFinishCompleted: false }
      }
    });

    const orderIds = orders.map(o => o._id);
    const lots = await Lot.find({ orderId: { $in: orderIds } });

    res.json(lots.map(lot => {
      const order = orders.find(o => o._id.toString() === lot.orderId.toString());
      const pendingCount = order ? order.takaDetails.filter(t => t.isStamped && !t.isFinishCompleted).length : 0;
      return {
        _id: lot._id,
        lotNo: lot.lotNo,
        partyName: lot.partyName,
        marka: lot.marka,
        qualityName: lot.qualityName,
        pendingCount
      };
    }));
  } catch (err) { next(err); }
});

// GET /api/production/lot-by-no?lotNo=02/27 — Get Lot details for Finish Meter Entry
// Changed from path param to query param to avoid "/" in lot numbers breaking the URL
router.get("/lot-by-no", requireAuth, async (req, res, next) => {
  try {
    const lotNo = req.query.lotNo;
    if (!lotNo) return res.status(400).json({ error: "lotNo query parameter is required" });

    const lot = await Lot.findOne({ lotNo: { $regex: new RegExp("^" + lotNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i") } });
    if (!lot) return res.status(404).json({ error: "Lot not found" });

    const order = await Order.findById(lot.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Only show lots where stamping is completed (all takas stamped)
    // and finish meter is pending for at least one taka
    const stampedTakas = order.takaDetails.filter(t => t.isStamped);
    const pendingFinishTakas = stampedTakas.filter(t => !t.isFinishCompleted);

    res.json({
      lot: {
        _id: lot._id,
        lotNo: lot.lotNo,
        marka: lot.marka,
        partyName: lot.partyName,
        qualityName: lot.qualityName,
        orderId: lot.orderId
      },
      takas: pendingFinishTakas.map((t, idx) => ({
        takaNo: t.takaNo,
        marka: t.marka,
        greyMeter: t.meter,
        weight: t.weight,
        takaIndex: order.takaDetails.indexOf(t)
      }))
    });
  } catch (err) { next(err); }
});

// Keep the old path-param route for backward compatibility (encode the lotNo)
router.get("/lot-by-no/:lotNo", requireAuth, async (req, res, next) => {
  try {
    const lotNo = decodeURIComponent(req.params.lotNo);

    const lot = await Lot.findOne({ lotNo: { $regex: new RegExp("^" + lotNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i") } });
    if (!lot) return res.status(404).json({ error: "Lot not found" });

    const order = await Order.findById(lot.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const stampedTakas = order.takaDetails.filter(t => t.isStamped);
    const pendingFinishTakas = stampedTakas.filter(t => !t.isFinishCompleted);

    res.json({
      lot: {
        _id: lot._id,
        lotNo: lot.lotNo,
        marka: lot.marka,
        partyName: lot.partyName,
        qualityName: lot.qualityName,
        orderId: lot.orderId
      },
      takas: pendingFinishTakas.map((t, idx) => ({
        takaNo: t.takaNo,
        marka: t.marka,
        greyMeter: t.meter,
        weight: t.weight,
        takaIndex: order.takaDetails.indexOf(t)
      }))
    });
  } catch (err) { next(err); }
});

// POST /api/production/save-finish-meter
router.post("/save-finish-meter", requireAuth, async (req, res, next) => {
  try {
    const { orderId, items } = req.body; // items: Array of { takaNo, finishMeter, takaIndex }
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const now = new Date().toISOString();
    
    for (const item of items) {
      const { takaNo, finishMeter, takaIndex } = item;
      
      // Use takaIndex if available, fallback to takaNo matching
      if (takaIndex !== undefined && takaIndex >= 0 && takaIndex < order.takaDetails.length) {
        const t = order.takaDetails[takaIndex];
        order.takaDetails[takaIndex] = {
          ...t.toObject(),
          finishMeter: Number(finishMeter),
          isFinishCompleted: true,
          finishCompletedAt: now
        };
      } else {
        // Fallback: match by takaNo
        order.takaDetails = order.takaDetails.map(t => 
          t.takaNo === takaNo ? { 
            ...t.toObject(), 
            finishMeter: Number(finishMeter), 
            isFinishCompleted: true, 
            finishCompletedAt: now 
          } : t
        );
      }
    }

    // Check if all takas in the order are now finish-completed
    const allFinished = order.takaDetails.every(t => t.isFinishCompleted);
    if (allFinished) {
      order.status = "Finish Meter Updated";
      await Lot.findOneAndUpdate({ orderId }, { status: "Finished" });
    }

    await order.save();
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
