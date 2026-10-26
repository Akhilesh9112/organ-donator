import mongoose from "mongoose";
import OrganRequest from "../models/OrganRequest.js";
import MatchRecommendation from "../models/MatchRecommendation.js";
import Pledge from "../models/Pledge.js";

const formatDate = (date) =>
  date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// ==========================================
// GET DONOR PLEDGES
// ==========================================

export const getPledges = async (req, res) => {
  try {
    const { userId } = req.params;

    const pledges = await Pledge.find({
      donorId: userId,
    }).sort({
      createdAt: -1,
    });

    const mapped = pledges.map((p) => ({
      id: p._id,
      organ: p.organ,
      donationType: p.donationType,
      pledgeDate: formatDate(p.createdAt),
      status: p.status,
    }));

    return res.status(200).json(mapped);
  } catch (error) {
    console.error("Get Pledges Error:", error);

    return res.status(error.status || (error.code === 11000 ? 409 : 500)).json({
      message: "Unable to complete the request",
    });
  }
};

// ==========================================
// CREATE PLEDGE
// ==========================================

export const createPledge = async (req, res) => {
  try {
    const { userId } = req.params;

    const { organ, donationType } = req.body;

    if (!organ) {
      return res.status(400).json({
        message: "Organ is required",
      });
    }

    if (String(userId) !== String(req.user._id)) {
      return res.status(403).json({
        message: "You can create pledges only for your own account",
      });
    }

    const validOrgans = [
      "Kidney",
      "Liver",
      "Heart",
      "Lungs",
      "Pancreas",
      "Cornea",
    ];

    if (!validOrgans.includes(organ)) {
      return res.status(400).json({
        message: "Invalid organ selection",
      });
    }

    if (
      !["Living", "Deceased pledge"].includes(donationType) ||
      (donationType === "Living" && !["Kidney", "Liver"].includes(organ))
    )
      return res
        .status(400)
        .json({
          message:
            "Living donation screening supports kidney or partial liver only. Other organs may be recorded as future deceased-donation pledges.",
        });
    const existing = await Pledge.findOne({
      donorId: req.user._id,
      organ,
      status: "Active & Pledged",
    });

    if (existing) {
      return res.status(409).json({
        message: `You already have an active ${organ} pledge`,
      });
    }

    const pledge = await Pledge.create({
      donorId: req.user._id,
      organ,
      donationType,
    });

    return res.status(201).json({
      id: pledge._id,
      organ: pledge.organ,
      donationType: pledge.donationType,
      pledgeDate: formatDate(pledge.createdAt),
      status: pledge.status,
    });
  } catch (error) {
    if (error.code !== 11000) console.error("Create pledge failed");

    return res.status(error.status || (error.code === 11000 ? 409 : 500)).json({
      message: "Unable to complete the request",
    });
  }
};

// ==========================================
// DELETE / WITHDRAW PLEDGE
// ==========================================

export const deletePledge = async (req, res) => {
  try {
    const { userId, pledgeId } = req.params;

    if (String(userId) !== String(req.user._id)) {
      return res.status(403).json({
        message: "You cannot withdraw another donor's pledge",
      });
    }

    const pledge = await Pledge.findOne({
      _id: pledgeId,
      donorId: req.user._id,
    });

    if (!pledge) {
      return res.status(404).json({
        message: "Pledge not found",
      });
    }

    if (pledge.status !== "Active & Pledged") {
      return res.status(409).json({
        message: "Only active pledges can be withdrawn",
      });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const changed = await Pledge.findOneAndUpdate(
          { _id: pledgeId, donorId: req.user._id, status: "Active & Pledged" },
          { $set: { status: "Withdrawn" } },
          { returnDocument: "after", session },
        );
        if (!changed)
          throw Object.assign(new Error("Pledge is no longer active"), {
            status: 409,
          });
        await OrganRequest.updateMany(
          { pledgeId, status: "Pending" },
          { $set: { status: "Cancelled", closedAt: new Date() } },
          { session, ordered: true },
        );
        await MatchRecommendation.updateMany(
          { pledgeId, status: "Recommended" },
          { $set: { status: "Expired" } },
          { session, ordered: true },
        );
      });
    } finally {
      await session.endSession();
    }

    return res.status(200).json({
      message: "Pledge withdrawn",
    });
  } catch (error) {
    console.error("Delete Pledge Error:", error);

    return res.status(error.status || (error.code === 11000 ? 409 : 500)).json({
      message: "Unable to complete the request",
    });
  }
};
