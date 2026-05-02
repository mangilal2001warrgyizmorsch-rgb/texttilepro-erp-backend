import mongoose from "mongoose";

const takaDetailSchema = new mongoose.Schema(
  {
    takaNo: { type: String },
    marka: { type: String },
    meter: { type: Number, required: true },
    weight: { type: Number },
    isStamped: { type: Boolean, default: false },
    stampedAt: { type: String },
  },
  { _id: false }
);

// Embedded snapshot of master record at order creation time
const masterDetailSchema = new mongoose.Schema(
  {
    name: { type: String },
    gstin: { type: String },
    panNo: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    mobileNo: { type: String },
    email: { type: String },
    gstType: { type: String },
    clientCode: { type: String },
  },
  { _id: false }
);

// Embedded snapshot of quality master record
const qualityDetailSchema = new mongoose.Schema(
  {
    qualityName: { type: String },
    gsm: { type: Number },
    width: { type: Number },
    unit: { type: String },
    hsnCode: { type: String },
    processType: { type: String },
    expectedLossPercent: { type: Number },
    shortPercent: { type: Number },
    defaultJobRate: { type: Number },
    greyRate: { type: Number },
    dispatchRate: { type: Number },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderDate: { type: String, required: true },
    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    firmName: { type: String, required: true },
    firmDetails: masterDetailSchema,
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    partyName: { type: String },
    partyChallanNo: { type: String },
    partyGstin: { type: String },
    partyAddress: { type: String },
    partyDetails: masterDetailSchema,
    brokerName: { type: String },
    codeMasterId: { type: mongoose.Schema.Types.ObjectId, ref: "CodeMaster" },
    marka: { type: String, required: true },
    // Weaver details
    weaverId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    weaverName: { type: String },
    weaverGstin: { type: String },
    weaverAddress: { type: String },
    weaverDetails: masterDetailSchema,
    weaverChNo: { type: String },
    weaverMarka: { type: String },
    weaverChDate: { type: String },
    // Fabric
    qualityId: { type: mongoose.Schema.Types.ObjectId, ref: "Quality" },
    qualityName: { type: String, required: true },
    qualityDetails: qualityDetailSchema,
    hsnCode: { type: String },
    itemDescription: { type: String },
    weight: { type: Number },
    length: { type: Number },
    width: { type: Number },
    chadhti: { type: Number },
    totalTaka: { type: Number, required: true },
    totalMeter: { type: Number, required: true },
    jobRate: { type: Number },
    greyRate: { type: Number },
    // Shipping
    shippingMode: {
      type: String,
      required: true,
      enum: ["DirectMills", "MarketTempo", "ByLR"],
    },
    vehicleNo: { type: String },
    driverMobile: { type: String },
    transporterId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    transporterName: { type: String },
    lrNo: { type: String },
    lrDate: { type: String },
    noBales: { type: Number },
    baleNo: { type: String },
    chequeAmount: { type: Number },
    lrFileId: { type: String },
    receiverName: { type: String },
    receiverMobile: { type: String },
    // Status
    status: {
      type: String,
      required: true,
      enum: [
        "draft",
        "PendingChallan",
        "ChallanIssued",
        "LotCreated",
        "InProcess",
        "Completed",
        "Dispatched",
      ],
      default: "draft",
    },
    takaDetails: [takaDetailSchema],
    ocrFileId: { type: String },
    ocrExtractedData: { type: String },
  },
  { timestamps: true }
);

orderSchema.index({ status: 1 });
orderSchema.index({ firmId: 1 });

export default mongoose.model("Order", orderSchema);
