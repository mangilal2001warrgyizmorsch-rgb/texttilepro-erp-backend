import mongoose from 'mongoose';
import 'dotenv/config';

import Order from './models/Order.js';
import Lot from './models/Lot.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/textile-erp");

  let orderQuery = {
    status: { $in: ["ChallanIssued", "LotCreated", "Lot Created", "InProcess", "Finished"] },
    "takaDetails.isStamped": false
  };

  const lotNo = "02/27"; // user search input
  // Note: user search input `lotNo` could also be empty. We emulate `lotNo=02/27`.

  let orders = await Order.find(orderQuery);
  let orderIds = orders.map(o => o._id);

  let lotQuery = { orderId: { $in: orderIds } };
  if (lotNo) {
    lotQuery.lotNo = { $regex: lotNo, $options: "i" };
  }
  
  const lots = await Lot.find(lotQuery);
  const validOrderIdsWithLots = lots.map(l => l.orderId.toString());

  orders = orders.filter(o => validOrderIdsWithLots.includes(o._id.toString()));

  const results = [];
  for (const order of orders) {
    const lot = lots.find(l => l.orderId.toString() === order._id.toString());
    if (!lot) continue;

    for (let takaIndex = 0; takaIndex < order.takaDetails.length; takaIndex++) {
      const taka = order.takaDetails[takaIndex];
      if (!taka.isStamped) {
        results.push({
          lotNo: lot.lotNo,
        });
      }
    }
  }
  
  console.log("Results length:", results.length);
  if (results.length > 0) {
    console.log("First result:", results[0]);
  }
  process.exit();
}
run();
