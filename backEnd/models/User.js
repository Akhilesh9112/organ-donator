import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  careHospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  sessionVersion: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null },
  consentVersion: { type: String, default: "2026-10-v1" },
  consentAt: { type: Date, default: Date.now },
  role: {
    type: String,
    required: true,
    enum: ["donor", "recipient", "hospital", "admin"],
  },

  fullName: {
    type: String,
    required: true,
  },

  phone: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    select: false,
    required: true,
  },

  bloodGroup: {
    type: String,
  },

  organ: {
    type: String,
  },

  consent: Boolean,

  // ==========================================
  // NEW — only used when role === 'hospital'.
  // A hospital account IS a User document (role: "hospital"),
  // so instead of a separate Hospital collection, the
  // license/verification fields just live here.
  // ==========================================
  license: {
    type: String,
  },

  verificationState: {
    type: String,
    enum: ["Pending", "Verified", "Rejected"],
    default: "Pending",
  },
  accountStatus: {
    type: String,
    enum: ["Active", "Suspended"],
    default: "Active",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  resetPasswordToken: {
    type: String,
    default: null,
    select: false,
  },

  resetPasswordExpires: {
    type: Date,
    default: null,
    select: false,
  },
});

export default mongoose.model("User", userSchema);
