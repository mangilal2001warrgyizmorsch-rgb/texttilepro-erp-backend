import mongoose from "mongoose";

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    marka: { type: String, required: true },
    qualityName: { type: String, required: true },
    meter: { type: Number, required: true },
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    billNo: { type: String, required: true, unique: true },
    billDate: { type: String, required: true },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    partyName: { type: String, required: true },
    gstin: { type: String },
    dispatchIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Dispatch",
      },
    ],
    lineItems: [lineItemSchema],
    subtotal: { type: Number, required: true },
    gstRate: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    notes: { type: String },
    status: {
      type: String,
      required: true,
      enum: ["Draft", "Issued", "Paid"],
      default: "Draft",
    },
  },
  { timestamps: true }
);

billSchema.index({ partyId: 1 });
billSchema.index({ status: 1 });

export default mongoose.model("Bill", billSchema);
