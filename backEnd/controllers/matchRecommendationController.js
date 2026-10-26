import { requireScreening } from "../utils/clinical.js";
import mongoose from "mongoose";

import MatchRecommendation from "../models/MatchRecommendation.js";

import User from "../models/User.js";

import Pledge from "../models/Pledge.js";

// ==========================================
// HOSPITAL CREATES RECOMMENDATION
// POST /api/match-recommendations
// ==========================================

export const createMatchRecommendation = async (req, res) => {
  try {
    const {
      recipientId,
      donorId,
      pledgeId,
      organ,
      bloodGroup,
      screeningStatus,
      dataCompleteness,
      factors,
      missingEvidence,
    } = req.body;

    // Hospital comes from authenticated JWT
    const hospitalId = req.user?._id;

    // ======================================
    // AUTH CHECK
    // ======================================

    if (!hospitalId) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    // ======================================
    // REQUIRED FIELDS
    // ======================================

    if (!recipientId || !donorId || !pledgeId || !organ || !bloodGroup) {
      return res.status(400).json({
        message:
          "Recipient, donor, pledge, organ and blood group are required.",
      });
    }

    // ======================================
    // VALIDATE IDS
    // ======================================

    if (
      !mongoose.Types.ObjectId.isValid(recipientId) ||
      !mongoose.Types.ObjectId.isValid(donorId) ||
      !mongoose.Types.ObjectId.isValid(pledgeId)
    ) {
      return res.status(400).json({
        message: "Invalid recommendation identifiers.",
      });
    }

    // ======================================
    // VERIFY RECIPIENT
    // ======================================

    const recipient = await User.findById(recipientId);

    if (!recipient || String(recipient.role).toLowerCase() !== "recipient") {
      return res.status(404).json({
        message: "Valid recipient not found.",
      });
    }

    // ======================================
    // VERIFY DONOR
    // ======================================

    const donor = await User.findById(donorId);

    if (!donor || String(donor.role).toLowerCase() !== "donor") {
      return res.status(404).json({
        message: "Valid donor not found.",
      });
    }

    // ======================================
    // VERIFY AUTHENTICATED HOSPITAL
    // ======================================

    const hospital = await User.findById(hospitalId);

    if (!hospital || String(hospital.role).toLowerCase() !== "hospital") {
      return res.status(403).json({
        message: "Hospital access required.",
      });
    }

    // ======================================
    // VERIFY ACTUAL DONOR PLEDGE
    // ======================================

    const pledge = await Pledge.findOne({
      _id: pledgeId,
      donorId,
      organ,
      status: "Active & Pledged",
      donationType: "Living",
    });

    if (!pledge) {
      return res.status(400).json({
        message: "The selected donor pledge is no longer active.",
      });
    }

    const verifiedGroup = await requireScreening(donor, recipient, hospitalId);
    if (recipient.organ !== organ)
      return res
        .status(400)
        .json({ message: "Organ must match the recipient care profile" });

    // ======================================
    // PREVENT DUPLICATE RECOMMENDATION
    // ======================================

    const existing = await MatchRecommendation.findOne({
      recipientId,
      donorId,
      pledgeId,
      hospitalId,
      status: "Recommended",
    });

    if (existing) {
      return res.status(409).json({
        message: "This match has already been recommended to the recipient.",
      });
    }

    // ======================================
    // SAFE COMPLETENESS VALUE
    // ======================================

    const completeness = Math.max(
      0,
      Math.min(100, Number(dataCompleteness) || 0),
    );

    // ======================================
    // CREATE RECOMMENDATION
    // ======================================

    const recommendation = await MatchRecommendation.create({
      recipientId,

      donorId,

      pledgeId,

      // JWT-derived hospital
      hospitalId,

      organ,

      bloodGroup: verifiedGroup,

      screeningStatus: "Basic screening only; clinical review required",
      dataCompleteness: 0,
      factors: [
        "Same verified blood group",
        "Active organ pledge",
        "Assigned care hospital",
      ],
      missingEvidence: [
        "Organ-specific eligibility",
        "Clinical crossmatch",
        "Final approvals",
      ],

      status: "Recommended",
    });

    return res.status(201).json({
      message: "Match recommendation sent to recipient.",

      recommendation,
    });
  } catch (error) {
    console.error("Create Match Recommendation Error:", error);

    return res.status(error.status || (error.code === 11000 ? 409 : 500)).json({
      message: error.status
        ? error.message
        : "Unable to create match recommendation.",
    });
  }
};

// ==========================================
// RECIPIENT GETS RECOMMENDATIONS
// GET /api/match-recommendations/
// recipient/:recipientId
// ==========================================

export const getRecipientRecommendations = async (req, res) => {
  try {
    const { recipientId } = req.params;

    // ======================================
    // VALIDATE ID
    // ======================================

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({
        message: "Invalid recipient ID.",
      });
    }

    // Route middleware already checks
    // recipient ownership.
    // Extra controller protection included.
    const role = String(req.user?.role || "").toLowerCase();

    if (role !== "admin" && String(req.user?._id) !== String(recipientId)) {
      return res.status(403).json({
        message: "You cannot access another recipient's recommendations.",
      });
    }

    // ======================================
    // LOAD RECOMMENDATIONS
    // ======================================

    const recommendations = await MatchRecommendation.find({
      recipientId,
    })
      .populate("donorId", "fullName bloodGroup")
      .populate("hospitalId", "fullName")
      .sort({
        createdAt: -1,
      });

    const result = recommendations.map((item) => ({
      id: item._id,

      donorId: item.donorId?._id,

      donorName: item.donorId?.fullName || "Donor",

      donorBloodGroup: item.donorId?.bloodGroup || null,

      hospitalId: item.hospitalId?._id,

      hospitalName: item.hospitalId?.fullName || "Hospital",

      pledgeId: item.pledgeId,

      organ: item.organ,

      bloodGroup: item.bloodGroup,

      screeningStatus: item.screeningStatus,

      dataCompleteness: item.dataCompleteness,

      factors: item.factors,

      missingEvidence: item.missingEvidence,

      status: item.status,

      createdAt: item.createdAt,
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get Recommendations Error:", error);

    return res.status(500).json({
      message: error.message || "Unable to load recommendations.",
    });
  }
};

// ==========================================
// RECIPIENT UPDATES RECOMMENDATION
// PATCH /api/match-recommendations/
// :recommendationId/status
// ==========================================

export const updateRecommendationStatus = async (req, res) => {
  try {
    const { recommendationId } = req.params;

    const { status } = req.body;

    // Authenticated recipient
    const recipientId = req.user?._id;

    // ======================================
    // AUTH CHECK
    // ======================================

    if (!recipientId) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    // ======================================
    // VALIDATE RECOMMENDATION ID
    // ======================================

    if (!mongoose.Types.ObjectId.isValid(recommendationId)) {
      return res.status(400).json({
        message: "Invalid recommendation ID.",
      });
    }

    // ======================================
    // VALIDATE STATUS
    // ======================================

    if (!["Declined"].includes(status)) {
      return res.status(400).json({
        message:
          "Status must be Declined; requesting consent is a separate transaction.",
      });
    }

    // ======================================
    // FIND RECOMMENDATION
    // ======================================

    const recommendation = await MatchRecommendation.findById(recommendationId);

    if (!recommendation) {
      return res.status(404).json({
        message: "Recommendation not found.",
      });
    }

    // ======================================
    // OWNERSHIP CHECK
    // ======================================

    if (String(recommendation.recipientId) !== String(recipientId)) {
      return res.status(403).json({
        message: "You cannot update this recommendation.",
      });
    }

    // ======================================
    // ONLY ACTIVE RECOMMENDATION
    // CAN BE UPDATED
    // ======================================

    if (recommendation.status !== "Recommended") {
      return res.status(409).json({
        message: `Recommendation is already ${recommendation.status}.`,
      });
    }

    // ======================================
    // UPDATE
    // ======================================

    recommendation.status = status;

    await recommendation.save();

    return res.status(200).json({
      message:
        status === "Request Sent"
          ? "Recommendation converted to donor request."
          : "Recommendation declined.",

      recommendation: {
        id: recommendation._id,

        status: recommendation.status,
      },
    });
  } catch (error) {
    console.error("Update Recommendation Error:", error);

    return res.status(500).json({
      message: error.message || "Unable to update recommendation.",
    });
  }
};
