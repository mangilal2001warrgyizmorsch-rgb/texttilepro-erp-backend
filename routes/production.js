import { Router } from "express";
import Order from "../models/Order.js";
import Lot from "../models/Lot.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/production/lot-by-no/:lotNo — Get Lot details for Finish Meter Entry
router.get("/lot-by-no/:lotNo", requireAuth, async (req, res, next) => {
  try {
    const lot = await Lot.findOne({ lotNo: { $regex: new RegExp("^" + req.params.lotNo + "$", "i") } });
    if (!lot) return res.status(404).json({ error: "Lot not found" });

    const order = await Order.findById(lot.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Show only takas where finish meter is pending
    const pendingTakas = order.takaDetails.filter(t => !t.isFinishCompleted);

    res.json({
      lot: {
        _id: lot._id,
        lotNo: lot.lotNo,
        marka: lot.marka,
        partyName: lot.partyName,
        qualityName: lot.qualityName,
        orderId: lot.orderId
      },
      takas: pendingTakas.map(t => ({
        takaNo: t.takaNo,
        marka: t.marka,
        greyMeter: t.meter,
        weight: t.weight
      }))
    });
  } catch (err) { next(err); }
});

// POST /api/production/save-finish-meter
router.post("/save-finish-meter", requireAuth, async (req, res, next) => {
  try {
    const { orderId, items } = req.body; // items: Array of { takaNo, finishMeter }
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const now = new Date().toISOString();
    
    for (const item of items) {
      const { takaNo, finishMeter } = item;
      order.takaDetails = order.takaDetails.map(t => 
        t.takaNo === takaNo ? { 
          ...t.toObject(), 
          finishMeter: Number(finishMeter), 
          isFinishCompleted: true, 
          finishCompletedAt: now 
        } : t
      );
    }

    await order.save();

    // Check if all takas in the order are now finish-completed
    const allFinished = order.takaDetails.every(t => t.isFinishCompleted);
    if (allFinished) {
      // Update Lot status to Finished
      await Lot.findOneAndUpdate({ orderId }, { status: "Finished" });
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
