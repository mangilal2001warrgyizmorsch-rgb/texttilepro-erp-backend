import { Router } from "express";
import Employee from "../models/Employee.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET all employees
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    next(err);
  }
});

// POST new employee
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { empCode, employeeName, department, designation, machine } = req.body;
    
    if (!empCode || !employeeName || !department || !designation || !machine) {
      return res.status(400).json({ error: "All fields are mandatory" });
    }

    // Validate 12 digits (allowing spaces in payload or stripping them)
    const rawEmpCode = empCode.replace(/\s/g, '');
    if (!/^\d{12}$/.test(rawEmpCode)) {
      return res.status(400).json({ error: "Emp Code must be exactly 12 digits" });
    }

    // Format code as 1234 5678 9012 just in case
    const formattedEmpCode = rawEmpCode.replace(/(\d{4})(?=\d)/g, '$1 ');

    // Check duplicate
    const existing = await Employee.findOne({ empCode: formattedEmpCode });
    if (existing) {
      return res.status(400).json({ error: "Employee Code already exists" });
    }

    const employee = await Employee.create({
      empCode: formattedEmpCode,
      employeeName,
      department,
      designation,
      machine
    });

    res.status(201).json(employee);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Employee Code already exists" });
    }
    next(err);
  }
});

export default router;
