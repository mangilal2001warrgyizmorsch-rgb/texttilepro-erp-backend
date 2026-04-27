import mongoose from "mongoose";

const challanSchema = new mongoose.Schema(
  {
    // Basic Details
    challan_no: { type: String, required: true, unique: true },
    challan_date: { type: String, required: true },
    date: { type: String, required: true },
    firm: { type: String, required: true },
    party: { type: String, required: true },
    party_address: { type: String },
    gstin_no: { type: String },

    // Item & Quality
    quality: { type: String, required: true },
    hsn_code: { type: String },
    item: { type: String },
    taka: { type: String, required: true },
    meter: { type: String, required: true },
    dyed_print: { type: String },
    weaver: { type: String },

    // Rates & Amounts
    fas_rate: { type: String },
    amount: { type: String },
    weight: { type: String },
    total: { type: String },
    chadhti: { type: String },
    width: { type: String },
    pu_bill_no: { type: String },

    // Dispatch Details
    lr_no: { type: String },
    lr_date: { type: String },
    transpoter: { type: String },
    remark: { type: String },

    // Taka Details Table
    table: [
      {
        tn: { type: Number },
        marka: { type: String },
        meter: { type: String },
      },
    ],

    // Status & References (for backward compatibility)
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
    },
    status: {
      type: String,
      enum: ["draft", "pending", "approved"],
      default: "pending",
    },
  },
  { timestamps: true }
);

challanSchema.index({ challan_no: 1 });
challanSchema.index({ firm: 1 });
challanSchema.index({ party: 1 });
challanSchema.index({ status: 1 });

export default mongoose.model("Challan", challanSchema);
