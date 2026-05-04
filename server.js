import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

// Route imports
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import accountRoutes from "./routes/accounts.js";
import codeMasterRoutes from "./routes/codeMaster.js";
import weaverRoutes from "./routes/weavers.js";
import qualityRoutes from "./routes/qualities.js";
import orderRoutes from "./routes/orders.js";
import challanRoutes from "./routes/challans.js";
import lotRoutes from "./routes/lots.js";
import locationRoutes from "./routes/locations.js";
import stampingRoutes from "./routes/stamping.js";
import processIssueRoutes from "./routes/processIssues.js";
import jobCardRoutes from "./routes/jobCards.js";
import dispatchRoutes from "./routes/dispatches.js";
import billRoutes from "./routes/bills.js";
import ocrRoutes from "./routes/ocr.js";
import vehicleRoutes from "./routes/vehicles.js";

const app = express();
const PORT = process.env.PORT || 5500;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/code-master", codeMasterRoutes);
app.use("/api/weavers", weaverRoutes);
app.use("/api/qualities", qualityRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/challans", challanRoutes);
app.use("/api/lots", lotRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/stamping", stampingRoutes);
app.use("/api/process-issues", processIssueRoutes);
app.use("/api/job-cards", jobCardRoutes);
app.use("/api/dispatches", dispatchRoutes);
app.use("/api/bills", billRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/vehicles", vehicleRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    code: err.code || "INTERNAL_ERROR",
  });
});

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });
