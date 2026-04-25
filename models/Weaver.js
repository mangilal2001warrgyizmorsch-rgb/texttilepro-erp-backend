import mongoose from "mongoose";

const weaverSchema = new mongoose.Schema(
  {
    weaverName: { type: String, required: true },
    weaverCode: { type: String, required: true },
    gstin: { type: String },
    mobileNo: { type: String },
    address: { type: String },
  },
  { timestamps: true }
);

weaverSchema.index({ weaverCode: 1 });

export default mongoose.model("Weaver", weaverSchema);
