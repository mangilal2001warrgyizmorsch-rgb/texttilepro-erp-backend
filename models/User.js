import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, default: "" },
    avatar: { type: String, default: "" },
    role: {
      type: String,
      enum: ["owner", "manager", "operator"],
      default: "operator",
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });

export default mongoose.model("User", userSchema);
