import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Order from "./models/Order.js";
import CodeMaster from "./models/CodeMaster.js";
import Account from "./models/Account.js";
import Quality from "./models/Quality.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const orders = await Order.find({}).populate("codeMasterId", "masterName").sort({ createdAt: -1 });
    console.log("Success, got", orders.length, "orders");
  } catch(err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
run();
