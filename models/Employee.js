import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema({
  empCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  employeeName: {
    type: String,
    required: true,
    trim: true,
  },
  department: {
    type: String,
    required: true,
    trim: true,
  },
  designation: {
    type: String,
    required: true,
    trim: true,
  },
  machine: {
    type: String,
    required: true,
    trim: true,
  }
}, { timestamps: true });

const Employee = mongoose.model("Employee", employeeSchema);
export default Employee;
