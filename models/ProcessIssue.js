import mongoose from "mongoose";

const processIssueSchema = new mongoose.Schema(
  {
    issueDate: { type: String, required: true },
    issueNo: { type: String, required: true, unique: true },
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lot",
      required: true,
    },
    lotNo: { type: String, required: true },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    partyName: { type: String, required: true },
    marka: { type: String, required: true },
    qualityName: { type: String, required: true },
    processType: {
      type: String,
      required: true,
      enum: ["Dyeing", "Printing", "Both"],
    },
    totalMeter: { type: Number, required: true },
    machineNo: { type: String },
    operatorName: { type: String },
    remarks: { type: String },
    status: {
      type: String,
      required: true,
      enum: ["Issued", "Completed"],
      default: "Issued",
    },
  },
  { timestamps: true }
);

processIssueSchema.index({ lotId: 1 });
processIssueSchema.index({ status: 1 });

export default mongoose.model("ProcessIssue", processIssueSchema);
