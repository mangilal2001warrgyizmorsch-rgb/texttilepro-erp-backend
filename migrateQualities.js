import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const qualitySchema = new mongoose.Schema({
  qualityName: { type: String },
  normalizedName: { type: String }
}, { strict: false });
const Quality = mongoose.model("Quality", qualitySchema);

const normalizeQualityName = (value = "") => value.trim().toUpperCase().replace(/[-_/]/g, " ").replace(/\s+/g, " ");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB.");
  const all = await Quality.find();
  for (const q of all) {
    q.normalizedName = normalizeQualityName(q.qualityName);
    await q.save();
  }
  console.log(`Migrated ${all.length} qualities.`);
  process.exit(0);
}
run();
