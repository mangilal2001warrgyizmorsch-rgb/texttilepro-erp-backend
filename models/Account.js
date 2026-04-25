import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    gstin: { type: String },
    accountName: { type: String, required: true },
    clientCode: { type: String },
    roleType: {
      type: String,
      required: true,
      enum: ["Mill", "Weaver", "Transporter", "Master", "Customer", "Supplier"],
    },
    panNo: { type: String },
    gstType: {
      type: String,
      required: true,
      enum: ["Regular", "Composition"],
    },
    mobileNo: { type: String },
    email: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    transportLink: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
    },
    defaultAgent: { type: String },
    creditDays: { type: Number },
    openingBalance: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

accountSchema.index({ roleType: 1 });
accountSchema.index({ isActive: 1 });

export default mongoose.model("Account", accountSchema);
