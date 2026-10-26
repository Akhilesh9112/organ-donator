import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    notificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      unique: true,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Sending", "Sent", "Failed", "Skipped"],
      default: "Pending",
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lockedUntil: Date,
    sentAt: Date,
  },
  { timestamps: true },
);
schema.index({ status: 1, nextAttemptAt: 1 });
export default mongoose.model("EmailOutbox", schema);
