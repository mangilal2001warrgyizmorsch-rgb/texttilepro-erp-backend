import mongoose from "mongoose";

async function run() {
  await mongoose.connect("mongodb+srv://TextilePro:r1g0r0us@cluster0.o5h6q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");
  const Challan = (await import("./backend/models/Challan.js")).default;
  const Lot = (await import("./backend/models/Lot.js")).default;
  
  const c = await Challan.findOne({ status: "Active" });
  if (!c) { console.log("No active challans"); process.exit(0); }
  
  try {
    const lot = new Lot({
      lotNo: "LOT-TEST-999",
      challanId: c._id,
      orderId: c.orderId,
      partyId: c.firmId,
      partyName: c.firmName,
      marka: c.marka,
      qualityName: "",
      totalTaka: c.totalTaka,
      totalMeter: c.totalMeter,
      balanceMeter: c.totalMeter,
      status: "InStorage",
      processType: "Dyeing"
    });
    await lot.validate();
    console.log("Validation passed");
  } catch(e) {
    console.log("Validation failed:", e.message);
  }
  process.exit(0);
}
run();
