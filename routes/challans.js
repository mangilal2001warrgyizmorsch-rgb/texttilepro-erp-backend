import { Router } from "express";
import Challan from "../models/Challan.js";
import Order from "../models/Order.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

async function generateChallanNo() {
  const today = new Date();
  const dateStr = today.getFullYear().toString() + (today.getMonth() + 1).toString().padStart(2, "0") + today.getDate().toString().padStart(2, "0");
  const last = await Challan.findOne().sort({ createdAt: -1 });
  let seq = 1;
  
  if (last) {
    // Handle both old (challanNo) and new (challan_no) field names
    const challanNo = last.challan_no || last.challanNo;
    
    if (challanNo && typeof challanNo === "string") {
      const parts = challanNo.split("-");
      const lastSeq = parseInt(parts[parts.length - 1] || "0", 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
  }
  
  return `CH-${dateStr}-${seq.toString().padStart(4, "0")}`;
}

// GET with pagination and search
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    
    // Search across multiple fields
    if (search) {
      filter.$or = [
        { challan_no: { $regex: search, $options: "i" } },
        { firm: { $regex: search, $options: "i" } },
        { party: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Challan.countDocuments(filter);
    const data = await Challan.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/by-order/:orderId", requireAuth, async (req, res, next) => {
  try {
    res.json(await Challan.find({ orderId: req.params.orderId }));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const c = await Challan.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Challan not found" });
    res.json(c);
  } catch (err) {
    next(err);
  }
});

// Single challan creation
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const challanNo = await generateChallanNo();
    const challan = await Challan.create({ 
      ...req.body, 
      challan_no: challanNo, 
      status: "pending" 
    });
    if (req.body.orderId) {
      await Order.findByIdAndUpdate(req.body.orderId, { status: "PendingChallan" });
    }
    res.status(201).json(challan);
  } catch (err) {
    next(err);
  }
});

// Batch creation
router.post("/batch", requireAuth, async (req, res, next) => {
  try {
    const { challans } = req.body;
    if (!Array.isArray(challans)) {
      return res.status(400).json({ error: "Challans must be an array" });
    }

    const created = [];
    for (const data of challans) {
      const challanNo = await generateChallanNo();
      const challan = await Challan.create({
        ...data,
        challan_no: challanNo,
        status: "pending",
      });
      created.push(challan);
    }

    res.status(201).json({ success: true, count: created.length, data: created });
  } catch (err) {
    next(err);
  }
});

// Update challan
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const challan = await Challan.findById(req.params.id);
    if (!challan) return res.status(404).json({ error: "Challan not found" });

    // Don't allow overwriting system fields
    const { _id, createdAt, updatedAt, ...updateData } = req.body;

    const updated = await Challan.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const c = await Challan.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Challan not found" });
    if (c.orderId) {
      await Order.findByIdAndUpdate(c.orderId, { status: "draft" });
    }
    await Challan.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
