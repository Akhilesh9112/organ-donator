import mongoose from "mongoose";

const medicalRecordSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reviewNotes: { type: String, default: "" },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    documentType: {
      type: String,
      enum: [
        "Blood Group Report",
        "HLA Typing Report",
        "Crossmatch Report",
        "Medical Summary",
        "Other",
      ],
      required: true,
    },

    originalFileName: {
      type: String,
      required: true,
    },

    storedFileName: {
      type: String,
      required: true,
    },

    filePath: {
      type: String,
      required: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    fileSize: {
      type: Number,
    },

    laboratory: {
      type: String,
      default: "",
    },

    reportDate: {
      type: Date,
      default: null,
    },

    verificationStatus: {
      type: String,
      enum: ["Pending", "Verified", "Rejected"],
      default: "Pending",
    },

    extractionStatus: {
      type: String,
      enum: ["Not Processed", "Processing", "Extracted", "Failed"],
      default: "Not Processed",
    },

    extractedData: {
      cbc: {
        hemoglobin: Number,
        wbc: Number,
        rbc: Number,
        hematocrit: Number,
        platelets: Number,
      },
      bloodGroup: {
        type: String,
        default: null,
      },

      hla: {
        hlaA: {
          type: [String],
          default: [],
        },

        hlaB: {
          type: [String],
          default: [],
        },

        hlaDR: {
          type: [String],
          default: [],
        },
      },

      heightCm: {
        type: Number,
        default: null,
      },

      weightKg: {
        type: Number,
        default: null,
      },
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("MedicalRecord", medicalRecordSchema);
