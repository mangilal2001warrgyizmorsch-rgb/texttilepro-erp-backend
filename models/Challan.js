import mongoose from "mongoose";

const challanSchema = new mongoose.Schema(
  {
    challanDate: { type: String, required: true },
    challanNo: { type: String, required: true, unique: true },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    firmName: { type: String, required: true },
    marka: { type: String, required: true },
    totalTaka: { type: Number, required: true },
    totalMeter: { type: Number, required: true },
    status: {
      type: String,
      required: true,
      enum: ["Active", "LotCreated"],
      default: "Active",
    },
  },
  { timestamps: true }
);

challanSchema.index({ orderId: 1 });
challanSchema.index({ status: 1 });

export default mongoose.model("Challan", challanSchema);
