import { Router } from "express";
import Vehicle from "../models/Vehicle.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET all vehicles
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const search = req.query.search || "";
    const filter = {};
    if (search) {
      filter.vehicleNo = { $regex: search, $options: "i" };
    }
    res.json(await Vehicle.find(filter).sort({ updatedAt: -1 }).limit(100));
  } catch (err) {
    next(err);
  }
});

// POST create new vehicle
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { vehicleNo, transporterId, transporterName, driverName, driverMobile } = req.body;
    if (!vehicleNo) return res.status(400).json({ error: "Vehicle number is required" });

    // Upsert: update if exists, create if not
    const vehicle = await Vehicle.findOneAndUpdate(
      { vehicleNo: vehicleNo.toUpperCase().trim() },
      {
        vehicleNo: vehicleNo.toUpperCase().trim(),
        transporterId: transporterId || undefined,
        transporterName: transporterName || undefined,
        driverName: driverName || undefined,
        driverMobile: driverMobile || undefined,
      },
      { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json(vehicle);
  } catch (err) {
    next(err);
  }
});

// DELETE vehicle
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await Vehicle.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
