import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, unique: true },
    warehouseName: { type: String, required: true },
    section: {
      type: String,
      required: true,
      enum: ["GreyArea", "ProcessingArea", "FinishedArea"],
    },
    rack: { type: String },
    zone: { type: String },
    floor: { type: String },
    capacityMeter: { type: Number, required: true },
    occupiedMeter: { type: Number, default: 0 },
    status: {
      type: String,
      required: true,
      enum: ["Empty", "Partial", "Full"],
      default: "Empty",
    },
  },
  { timestamps: true }
);

locationSchema.index({ section: 1 });
locationSchema.index({ status: 1 });
locationSchema.index({ locationId: 1 });

export default mongoose.model("Location", locationSchema);
