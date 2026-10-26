import mongoose from "mongoose";

const allocationSchema = new mongoose.Schema({
  completedAt: { type: Date, default: null },
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OrganRequest",
    required: true,
  },

  donorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  pledgeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Pledge",
    required: true,
  },

  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  organ: {
    type: String,
    required: true,
  },

  status: {
    type: String,
    enum: ["Hospital Review", "Scheduled", "Completed", "Cancelled"],
    default: "Hospital Review",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

allocationSchema.index({ requestId: 1 }, { unique: true });
export default mongoose.model("Allocation", allocationSchema);
