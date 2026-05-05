import { Router } from "express";
import Lot from "../models/Lot.js";
import Challan from "../models/Challan.js";
import Order from "../models/Order.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function getFinancialYear(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 4) {
    return { startYear: year, endYear: year + 1, suffix: (year + 1).toString().slice(-2) };
  } else {
    return { startYear: year - 1, endYear: year, suffix: year.toString().slice(-2) };
  }
}

async function generateLotNo() {
  const fy = getFinancialYear(new Date());
  const fyStartDate = new Date(fy.startYear, 3, 1); // April 1st
  
  const lastLot = await Lot.findOne({
    createdAt: { $gte: fyStartDate }
  }).sort({ createdAt: -1 });
  
  let serial = 1;
  if (lastLot && lastLot.lotNo.includes("/")) {
    const parts = lastLot.lotNo.split("/");
    const lastSerial = parseInt(parts[0], 10);
    if (!isNaN(lastSerial)) serial = lastSerial + 1;
  }
  
  const serialStr = serial < 10 ? `0${serial}` : serial.toString();
  return `${serialStr}/${fy.suffix}`;
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    res.json(await Lot.find(filter).sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

router.get("/by-challan/:challanId", requireAuth, async (req, res, next) => {
  try {
    res.json(await Lot.find({ challanId: req.params.challanId }));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const lot = await Lot.findById(req.params.id)
      .populate("orderId")
      .populate("challanId");
    if (!lot) return res.status(404).json({ error: "Lot not found" });
    res.json(lot);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findById(req.body.orderId).populate("codeMasterId");
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Verify challan exists and is in correct status
    const challan = await Challan.findById(req.body.challanId);
    if (!challan) return res.status(404).json({ error: "Challan not found" });
    if (challan.status !== "pending")
      return res
        .status(400)
        .json({ error: "Challan must be in pending status to create lot" });

    const lotNo = await generateLotNo();
    const lotData = {
      ...req.body,
      partyName: order.partyName,
      masterName: order.codeMasterId?.masterName || order.brokerName || "",
      marka: order.marka,
      qualityName: order.qualityName,
      totalTaka: order.totalTaka,
      totalMeter: order.totalMeter,
      lotNo,
      balanceMeter: order.totalMeter,
      status: "InStorage",
    };

    const lot = await Lot.create(lotData);
    await Challan.findByIdAndUpdate(req.body.challanId, {
      status: "LotCreated",
    });
    await Order.findByIdAndUpdate(req.body.orderId, { status: "Lot Created" });
    res.status(201).json(lot);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", requireAuth, async (req, res, next) => {
  try {
    const lot = await Lot.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!lot) return res.status(404).json({ error: "Lot not found" });
    res.json(lot);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const lot = await Lot.findById(req.params.id);
    if (!lot) return res.status(404).json({ error: "Lot not found" });
    await Challan.findByIdAndUpdate(lot.challanId, { status: "Active" });
    await Order.findByIdAndUpdate(lot.orderId, { status: "Challan Created" });
    await Lot.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
