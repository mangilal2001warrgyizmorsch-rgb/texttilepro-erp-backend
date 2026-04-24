import mongoose from "mongoose";

const qualitySchema = new mongoose.Schema(
  {
    qualityName: { type: String, required: true },
    gsm: { type: Number },
    width: { type: Number },
    unit: { type: String },
    hsnCode: { type: String },
    processType: {
      type: String,
      required: true,
      enum: ["Dyeing", "Printing", "Both"],
    },
    expectedLossPercent: { type: Number },
    shortPercent: { type: Number },
    defaultJobRate: { type: Number },
    greyRate: { type: Number },
    dispatchRate: { type: Number },
  },
  { timestamps: true }
);

qualitySchema.index({ qualityName: 1 });

export default mongoose.model("Quality", qualitySchema);
