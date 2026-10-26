import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
  donorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  scheduledAt: { type: Date, required: true },
  durationMinutes: {
    type: Number,
    required: true,
    default: 60,
    min: 15,
    max: 480,
    validate: Number.isInteger,
  },
  scheduledEndAt: {
    type: Date,
    required: true,
    default: function () {
      return this.scheduledAt
        ? new Date(+this.scheduledAt + (this.durationMinutes || 60) * 60000)
        : undefined;
    },
  },
  surgeonKey: {
    type: String,
    required: true,
    default: function () {
      return String(this.surgeon || "")
        .normalize("NFKC")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
    },
  },
  cancellationReason: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OrganRequest",
    required: true,
  },

  allocationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Allocation",
    required: true,
  },

  organ: {
    type: String,
    required: true,
  },

  type: {
    type: String,
    default: "Transplant Appointment",
  },

  date: {
    type: Date,
    required: true,
  },

  time: {
    type: String,
    required: true,
  },

  surgeon: {
    type: String,
    default: "To Be Assigned",
  },

  status: {
    type: String,
    enum: ["scheduled", "completed", "canceled"],
    default: "scheduled",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

appointmentSchema.index({ allocationId: 1 }, { unique: true });
appointmentSchema.index(
  { hospitalId: 1, surgeon: 1, scheduledAt: 1 },
  { unique: true, partialFilterExpression: { status: "scheduled" } },
);
appointmentSchema.index({
  hospitalId: 1,
  surgeonKey: 1,
  scheduledAt: 1,
  scheduledEndAt: 1,
  status: 1,
});
appointmentSchema.index({
  user: 1,
  status: 1,
  scheduledAt: 1,
  scheduledEndAt: 1,
});
appointmentSchema.index({
  donorId: 1,
  status: 1,
  scheduledAt: 1,
  scheduledEndAt: 1,
});
export default mongoose.model("Appointment", appointmentSchema);
