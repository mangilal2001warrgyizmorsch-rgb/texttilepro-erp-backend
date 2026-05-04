import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    vehicleNo: { type: String, required: true, unique: true },
    transporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
    },
    transporterName: { type: String },
    driverName: { type: String },
    driverMobile: { type: String },
  },
  { timestamps: true }
);

vehicleSchema.index({ vehicleNo: 1 });

export default mongoose.model("Vehicle", vehicleSchema);
