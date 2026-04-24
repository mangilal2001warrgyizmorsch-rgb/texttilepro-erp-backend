import { Router } from "express";
import Account from "../models/Account.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/accounts
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.roleType) filter.roleType = req.query.roleType;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === "true";
    const accounts = await Account.find(filter).sort({ createdAt: -1 });
    res.json(accounts);
  } catch (err) {
    next(err);
  }
});

// GET /api/accounts/:id
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ error: "Account not found" });
    res.json(account);
  } catch (err) {
    next(err);
  }
});

// POST /api/accounts
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const account = await Account.create(req.body);
    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/accounts/:id
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const account = await Account.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!account) return res.status(404).json({ error: "Account not found" });
    res.json(account);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/accounts/:id
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const account = await Account.findByIdAndDelete(req.params.id);
    if (!account) return res.status(404).json({ error: "Account not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
