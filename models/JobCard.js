import mongoose from "mongoose";

const colorRecipeSchema = new mongoose.Schema(
  {
    colorName: { type: String, required: true },
    shade: { type: String },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
  },
  { _id: false }
);

const chemicalSchema = new mongoose.Schema(
  {
    chemName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
  },
  { _id: false }
);

const jobCardSchema = new mongoose.Schema(
  {
    jobCardNo: { type: String, required: true, unique: true },
    jobCardDate: { type: String, required: true },
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lot",
      required: true,
    },
    lotNo: { type: String, required: true },
    processIssueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProcessIssue",
    },
    issueNo: { type: String },
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
    inputMeter: { type: Number, required: true },
    machineNo: { type: String },
    operatorName: { type: String },
    colorRecipe: [colorRecipeSchema],
    chemicals: [chemicalSchema],
    temperature: { type: Number },
    duration: { type: String },
    notes: { type: String },
    // Production output
    finishedMeter: { type: Number },
    shortage: { type: Number },
    completedAt: { type: String },
    status: {
      type: String,
      required: true,
      enum: ["Open", "InProgress", "Completed"],
      default: "Open",
    },
  },
  { timestamps: true }
);

jobCardSchema.index({ lotId: 1 });
jobCardSchema.index({ status: 1 });

export default mongoose.model("JobCard", jobCardSchema);
