import { Router } from "express";
import Location from "../models/Location.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.section) filter.section = req.query.section;
    res.json(await Location.find(filter));
  } catch (err) { next(err); }
});

router.get("/dashboard-stats", requireAuth, async (req, res, next) => {
  try {
    const all = await Location.find();
    const totalCapacity = all.reduce((s, l) => s + l.capacityMeter, 0);
    const totalOccupied = all.reduce((s, l) => s + l.occupiedMeter, 0);
    const bySection = {
      GreyArea: { capacity: 0, occupied: 0, count: 0 },
      ProcessingArea: { capacity: 0, occupied: 0, count: 0 },
      FinishedArea: { capacity: 0, occupied: 0, count: 0 },
    };
    for (const loc of all) {
      bySection[loc.section].capacity += loc.capacityMeter;
      bySection[loc.section].occupied += loc.occupiedMeter;
      bySection[loc.section].count += 1;
    }
    res.json({
      totalLocations: all.length, totalCapacity, totalOccupied, bySection,
      empty: all.filter(l => l.status === "Empty").length,
      partial: all.filter(l => l.status === "Partial").length,
      full: all.filter(l => l.status === "Full").length,
    });
  } catch (err) { next(err); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const loc = await Location.findById(req.params.id);
    if (!loc) return res.status(404).json({ error: "Location not found" });
    res.json(loc);
  } catch (err) { next(err); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const existing = await Location.findOne({ locationId: req.body.locationId });
    if (existing) return res.status(409).json({ error: `Location ID "${req.body.locationId}" already exists` });
    const loc = await Location.create({ ...req.body, occupiedMeter: 0, status: "Empty" });
    res.status(201).json(loc);
  } catch (err) { next(err); }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const loc = await Location.findById(req.params.id);
    if (!loc) return res.status(404).json({ error: "Location not found" });
    const newOccupied = req.body.occupiedMeter ?? loc.occupiedMeter;
    const newCapacity = req.body.capacityMeter ?? loc.capacityMeter;
    let status = "Empty";
    if (newOccupied >= newCapacity) status = "Full";
    else if (newOccupied > 0) status = "Partial";
    const updated = await Location.findByIdAndUpdate(req.params.id, { ...req.body, status }, { new: true });
    res.json(updated);
  } catch (err) { next(err); }
});

router.post("/:id/assign-lot", requireAuth, async (req, res, next) => {
  try {
    const loc = await Location.findById(req.params.id);
    if (!loc) return res.status(404).json({ error: "Location not found" });
    const newOccupied = loc.occupiedMeter + (req.body.meters || 0);
    let status = "Empty";
    if (newOccupied >= loc.capacityMeter) status = "Full";
    else if (newOccupied > 0) status = "Partial";
    const updated = await Location.findByIdAndUpdate(req.params.id, { occupiedMeter: newOccupied, status }, { new: true });
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await Location.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
