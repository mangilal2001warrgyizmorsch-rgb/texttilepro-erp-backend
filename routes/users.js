import { Router } from "express";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Lot from "../models/Lot.js";
import Dispatch from "../models/Dispatch.js";
import Bill from "../models/Bill.js";
import JobCard from "../models/JobCard.js";
import { requireAuth, requireOwner } from "../middleware/auth.js";

const router = Router();

// GET /api/users — list all users (owner only)
router.get("/", requireAuth, requireOwner, async (req, res, next) => {
  try {
    const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/role — update user role (owner only)
router.patch("/:id/role", requireAuth, requireOwner, async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!["owner", "manager", "operator"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Prevent owner from demoting themselves
    if (req.user.id === req.params.id && role !== "owner") {
      return res.status(400).json({ error: "Cannot change your own owner role" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/stats — owner dashboard stats
router.get("/stats", requireAuth, requireOwner, async (req, res, next) => {
  try {
    const [allOrders, allLots, allDispatches, allBills, allJobCards] = await Promise.all([
      Order.find(),
      Lot.find(),
      Dispatch.find(),
      Bill.find(),
      JobCard.find(),
    ]);

    const totalOrderedMeter = allOrders.reduce((s, o) => s + o.totalMeter, 0);
    const totalFinishedMeter = allLots.reduce((s, l) => s + (l.finishedMeter || 0), 0);
    const totalDispatchedMeter = allDispatches.reduce((s, d) => s + d.finishedMeter, 0);

    const totalBilled = allBills.reduce((s, b) => s + b.totalAmount, 0);
    const totalPaid = allBills.filter(b => b.status === "Paid").reduce((s, b) => s + b.totalAmount, 0);
    const totalPending = allBills.filter(b => b.status !== "Paid").reduce((s, b) => s + b.totalAmount, 0);

    const ordersByStatus = {
      PendingChallan: allOrders.filter(o => o.status === "PendingChallan").length,
      ChallanIssued: allOrders.filter(o => o.status === "ChallanIssued").length,
      LotCreated: allOrders.filter(o => o.status === "LotCreated").length,
      InProcess: allOrders.filter(o => o.status === "InProcess").length,
      Completed: allOrders.filter(o => o.status === "Completed").length,
      Dispatched: allOrders.filter(o => o.status === "Dispatched").length,
    };

    const lotsByStatus = {
      InStorage: allLots.filter(l => l.status === "InStorage").length,
      InProcess: allLots.filter(l => l.status === "InProcess").length,
      Finished: allLots.filter(l => l.status === "Finished").length,
      Dispatched: allLots.filter(l => l.status === "Dispatched").length,
    };

    const billsByStatus = {
      Draft: allBills.filter(b => b.status === "Draft").length,
      Issued: allBills.filter(b => b.status === "Issued").length,
      Paid: allBills.filter(b => b.status === "Paid").length,
    };

    const recentDispatches = await Dispatch.find().sort({ createdAt: -1 }).limit(10);
    const recentBills = await Bill.find().sort({ createdAt: -1 }).limit(10);

    res.json({
      totals: {
        orders: allOrders.length,
        lots: allLots.length,
        dispatches: allDispatches.length,
        bills: allBills.length,
        jobCards: allJobCards.length,
      },
      meters: { totalOrderedMeter, totalFinishedMeter, totalDispatchedMeter },
      financials: { totalBilled, totalPaid, totalPending },
      ordersByStatus,
      lotsByStatus,
      billsByStatus,
      recentDispatches,
      recentBills,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
