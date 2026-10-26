import mongoose from "mongoose";

const pledgeSchema = new mongoose.Schema({
  donationType: {
    type: String,
    enum: ["Living", "Deceased pledge"],
    required: true,
  },
  donorId: {
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
    enum: [
      "Active & Pledged",
      "Matched - Donor Accepted",
      "Withdrawn",
      "Completed",
    ],
    default: "Active & Pledged",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

pledgeSchema.index(
  { donorId: 1, organ: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["Active & Pledged", "Matched - Donor Accepted"] },
    },
  },
);
export default mongoose.model("Pledge", pledgeSchema);
