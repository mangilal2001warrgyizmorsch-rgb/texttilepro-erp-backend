import mongoose from "mongoose";

const dispatchSchema = new mongoose.Schema(
  {
    dispatchNo: { type: String, required: true, unique: true },
    dispatchDate: { type: String, required: true },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lot",
      required: true,
    },
    lotNo: { type: String, required: true },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    partyName: { type: String, required: true },
    marka: { type: String, required: true },
    qualityName: { type: String, required: true },
    finishedMeter: { type: Number, required: true },
    // Transport details
    transportName: { type: String },
    vehicleNo: { type: String },
    driverMobile: { type: String },
    lrNo: { type: String },
    lrDate: { type: String },
    noBales: { type: Number },
    receiverName: { type: String },
    receiverMobile: { type: String },
    shippingMode: {
      type: String,
      required: true,
      enum: ["DirectMills", "MarketTempo", "ByLR"],
    },
    notes: { type: String },
    status: {
      type: String,
      required: true,
      enum: ["Pending", "Dispatched", "Billed"],
      default: "Dispatched",
    },
  },
  { timestamps: true }
);

dispatchSchema.index({ orderId: 1 });
dispatchSchema.index({ lotId: 1 });
dispatchSchema.index({ partyId: 1 });
dispatchSchema.index({ status: 1 });

export default mongoose.model("Dispatch", dispatchSchema);
