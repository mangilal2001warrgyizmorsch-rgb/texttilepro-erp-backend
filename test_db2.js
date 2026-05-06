import mongoose from 'mongoose';
import 'dotenv/config';

import Order from './models/Order.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/textile-erp");

  const orders = await Order.find({"takaDetails.isStamped": false}).limit(5);
  console.log("Orders with unstamped takas:");
  for (const o of orders) {
    console.log(`OrderId: ${o._id}, Status: ${o.status}, Unstamped count: ${o.takaDetails.filter(t=>!t.isStamped).length}`);
    if (o.takaDetails.length > 0) {
      console.log(`First taka:`, o.takaDetails[0]);
    }
  }
  process.exit();
}
run();
