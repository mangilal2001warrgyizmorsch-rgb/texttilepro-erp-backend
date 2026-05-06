import mongoose from 'mongoose';
import 'dotenv/config';

import Order from './models/Order.js';
import Lot from './models/Lot.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/textile-erp");
  const lots = await Lot.find({});
  console.log("Lots:");
  for (let l of lots) {
    const o = await Order.findById(l.orderId);
    console.log(`Lot: ${l.lotNo}, Status: ${l.status}, OrderId: ${l.orderId}, Order Status: ${o ? o.status : 'null'}, Unstamped Taka: ${o ? o.takaDetails.filter(t=>!t.isStamped).length : 0}`);
  }
  process.exit();
}
run();
