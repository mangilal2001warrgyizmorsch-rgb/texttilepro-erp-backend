import mongoose from 'mongoose';
import 'dotenv/config';

import Order from './models/Order.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/textile-erp");

  const order = await Order.findById("69f978a656a7dadec5674661");
  console.log(order.takaDetails.map(t => t.takaNo));
  process.exit();
}
run();
