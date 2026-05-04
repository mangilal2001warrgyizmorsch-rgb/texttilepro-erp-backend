import mongoose from "mongoose";

const lotSchema = new mongoose.Schema(
  {
    lotNo: { type: String, required: true, unique: true },
    challanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challan",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    partyName: { type: String, required: true },
    marka: { type: String, required: true },
    qualityName: { type: String, required: true },
    challanNo: { type: String },
    challanDate: { type: Date },
    totalTaka: { type: Number, required: true },
    totalMeter: { type: Number, required: true },
    balanceMeter: { type: Number, required: true },
    amount: { type: Number },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
    locationName: { type: String },
    status: {
      type: String,
      required: true,
      enum: ["InStorage", "InProcess", "Finished", "Dispatched"],
      default: "InStorage",
    },
    processType: {
      type: String,
      enum: ["Dyeing", "Printing", "Both"],
    },
    finishedMeter: { type: Number },
    shortage: { type: Number },
  },
  { timestamps: true }
);

lotSchema.index({ status: 1 });
lotSchema.index({ partyId: 1 });
lotSchema.index({ lotNo: 1 });

export default mongoose.model("Lot", lotSchema);
