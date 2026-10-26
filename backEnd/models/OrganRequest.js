import mongoose from "mongoose";

const organRequestSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  recommendationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MatchRecommendation",
  },
  cancellationReason: String,
  closedAt: { type: Date, default: null },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  donorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  pledgeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Pledge",
    default: null,
  },

  organ: {
    type: String,
    required: true,
  },

  bloodGroup: {
    type: String,
    required: true,
  },

  hospital: {
    type: String,
    default: "Assigned Hospital",
  },

  status: {
    type: String,
    enum: [
      "Pending",
      "Accepted",
      "Rejected",
      "Hospital Review",
      "Scheduled",
      "Completed",
      "Cancelled",
    ],
    default: "Pending",
  },

  donorApprovedAt: {
    type: Date,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

organRequestSchema.index(
  { recipientId: 1, pledgeId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["Pending", "Accepted", "Hospital Review", "Scheduled"] },
    },
  },
);
organRequestSchema.index(
  { pledgeId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: ["Accepted", "Hospital Review", "Scheduled", "Completed"],
      },
    },
  },
);
export default mongoose.model("OrganRequest", organRequestSchema);
