import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    // User who receives the notification
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Category used by frontend for icon/navigation
    type: {
      type: String,
      enum: [
        "REQUEST_RECEIVED",
        "REQUEST_ACCEPTED",
        "REQUEST_DECLINED",
        "HOSPITAL_REVIEW",
        "ALLOCATION_CREATED",
        "APPOINTMENT_SCHEDULED",
        "MEDICAL_RECORD_VERIFIED",
        "MEDICAL_RECORD_REJECTED",
        "GENERAL",
      ],
      default: "GENERAL",
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional reference to related record
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    referenceType: {
      type: String,
      enum: [
        "OrganRequest",
        "Allocation",
        "Appointment",
        "MedicalRecord",
        "MatchRecommendation",
        null,
      ],
      default: null,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Fast query for:
// newest notifications for a user
notificationSchema.index({
  userId: 1,
  createdAt: -1,
});

// Fast query for:
// unread notification count
notificationSchema.index({
  userId: 1,
  isRead: 1,
});

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
