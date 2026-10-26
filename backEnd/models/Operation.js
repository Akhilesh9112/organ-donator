import mongoose from "mongoose";

const operationSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    unique: true,
    sparse: true,
  },
  allocationId: { type: mongoose.Schema.Types.ObjectId, ref: "Allocation" },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  patient: {
    type: String,
    required: true,
  },

  organ: {
    type: String,
    required: true,
  },

  surgeon: {
    type: String,
  },

  scheduledTime: {
    type: String,
  },

  status: {
    type: String,
    enum: ["OR Ready", "Pre-Op Screening", "Completed", "Cancelled"],
    default: "Pre-Op Screening",
  },
});

export default mongoose.model("Operation", operationSchema);
