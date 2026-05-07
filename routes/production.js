import { Router } from "express";
import Order from "../models/Order.js";
import Lot from "../models/Lot.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/production — List lots pending finish meter entry
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const orders = await Order.find({
      takaDetails: {
        $elemMatch: { isStamped: true, isFinishCompleted: false },
      },
    });

    const orderIds = orders.map((o) => o._id);
    const lots = await Lot.find({ orderId: { $in: orderIds } });

    res.json(
      lots.map((lot) => {
        const order = orders.find(
          (o) => o._id.toString() === lot.orderId.toString(),
        );
        const pendingCount = order
          ? order.takaDetails.filter((t) => t.isStamped && !t.isFinishCompleted)
              .length
          : 0;
        return {
          _id: lot._id,
          lotNo: lot.lotNo,
          partyName: lot.partyName,
          marka: lot.marka,
          qualityName: lot.qualityName,
          pendingCount,
        };
      }),
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/production/lot-by-no — Get Lot details for Finish Meter Entry
router.get("/lot-by-no", requireAuth, async (req, res, next) => {
  try {
    const lotNo = req.query.lotNo;
    if (!lotNo)
      return res
        .status(400)
        .json({ error: "lotNo query parameter is required" });

    const lot = await Lot.findOne({
      lotNo: {
        $regex: new RegExp(
          "^" + lotNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
          "i",
        ),
      },
    });
    if (!lot) return res.status(404).json({ error: "Lot not found" });

    const order = await Order.findById(lot.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const stampedTakas = order.takaDetails.filter((t) => t.isStamped);
    const pendingFinishTakas = stampedTakas.filter((t) => !t.isFinishCompleted);

    res.json({
      lot: {
        _id: lot._id,
        lotNo: lot.lotNo,
        marka: lot.marka,
        partyName: lot.partyName,
        qualityName: lot.qualityName,
        orderId: lot.orderId,
      },
      takas: pendingFinishTakas.map((t) => ({
        takaNo: t.takaNo,
        marka: t.marka,
        greyMeter: t.meter,
        weight: t.weight,
        takaIndex: order.takaDetails.indexOf(t),
        finishMeter: t.finishMeter || 0,
        tpStatus: t.tpStatus || "Pending",
        tpEntries: t.tpEntries || [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/production/save-finish-meter — Batch save finish meters (marks as Completed)
router.post("/save-finish-meter", requireAuth, async (req, res, next) => {
  try {
    const { orderId, items } = req.body;
    if (!orderId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: "orderId and items array are required" });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const now = new Date().toISOString();

    for (const item of items) {
      const { takaIndex, finishMeter } = item;
      if (takaIndex === undefined || takaIndex < 0 || takaIndex >= order.takaDetails.length) {
        continue; // Skip invalid indices
      }

      const t = order.takaDetails[takaIndex];
      const finish = Number(finishMeter);
      if (isNaN(finish) || finish <= 0) continue;

      t.finishMeter = finish;
      t.isFinishCompleted = true;
      t.finishCompletedAt = now;
      t.tpStatus = "Completed";
      
      // Also add a single entry to tpEntries for audit trail
      if (!t.tpEntries) t.tpEntries = [];
      t.tpEntries.push({
        finishMeter: finish,
        pendingMeter: 0,
        entryDate: now,
        userName: req.user?.name || "System"
      });
    }

    // Check if all takas in the order are now completed
    const allFinished = order.takaDetails.every(t => t.isFinishCompleted);
    if (allFinished) {
      order.status = "Finish Meter Updated";
      await Lot.findOneAndUpdate({ orderId }, { status: "Finished" });
    } else {
      // If any are completed but not all, it's still "In Process" but some takas are done
      // The order status remains "Stamping Done" or "In Process"
    }

    await order.save();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/production/save-tp-entries
router.post("/save-tp-entries", requireAuth, async (req, res, next) => {
  try {
    const { orderId, takaIndex, entries, isComplete } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (
      takaIndex === undefined ||
      takaIndex < 0 ||
      takaIndex >= order.takaDetails.length
    ) {
      return res.status(400).json({ error: "Invalid takaIndex" });
    }

    const t = order.takaDetails[takaIndex];
    const now = new Date().toISOString();

    if (!t.tpEntries) t.tpEntries = [];

    let currentTotal = t.finishMeter || 0;

    for (const entry of entries) {
      const added = Number(entry.finishMeterAdded);
      if (isNaN(added) || added <= 0) continue;

      currentTotal += added;
      let pending = Math.max(0, t.meter - currentTotal);

      t.tpEntries.push({
        finishMeter: added,
        pendingMeter: pending,
        entryDate: now,
        userName: entry.userName || req.user?.name || "System",
      });
    }

    t.finishMeter = currentTotal;
    const finalPending = Math.max(0, t.meter - currentTotal);

    if (isComplete || finalPending <= 0) {
      t.tpStatus = "Completed";
      t.isFinishCompleted = true;
      t.finishCompletedAt = now;
    } else {
      t.tpStatus = "TP Pending";
      t.isFinishCompleted = false;
    }

    const allFinished = order.takaDetails.every((tk) => tk.isFinishCompleted);
    if (allFinished) {
      order.status = "Finish Meter Updated";
      await Lot.findOneAndUpdate({ orderId }, { status: "Finished" });
    }

    await order.save();
    res.json({ success: true, taka: t });
  } catch (err) {
    next(err);
  }
});

export default router;
