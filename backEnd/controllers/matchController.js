import User from "../models/User.js";
import Pledge from "../models/Pledge.js";
import MedicalRecord from "../models/MedicalRecord.js";
import { asyncRoute, fail } from "../middleware/validation.js";
import { verifiedBlood } from "../utils/clinical.js";
export const getScreeningRecipients = asyncRoute(async (req, res) => {
  const users = await User.find({
    role: "recipient",
    careHospitalId: req.user._id,
    accountStatus: "Active",
    deletedAt: null,
  }).select("fullName organ bloodGroup");
  const rows = [];
  for (const u of users) {
    const blood = await verifiedBlood(u._id);
    if (blood)
      rows.push({
        id: u._id,
        fullName: u.fullName,
        organ: u.organ,
        verifiedBloodGroup: blood,
        status: "Ready for Screening",
      });
  }
  res.json(rows);
});
export const recipientCompatibilityMatch = asyncRoute(async (req, res) => {
  const recipient = await User.findOne({
    _id: req.params.recipientId,
    role: "recipient",
    careHospitalId: req.user._id,
    accountStatus: "Active",
    deletedAt: null,
  });
  if (!recipient) fail(404, "Assigned recipient not found");
  const blood = await verifiedBlood(recipient._id);
  if (!blood)
    return res.json({
      readyForMatching: false,
      reason: "Verified blood-group evidence required",
      matches: [],
    });
  const donors = await User.find({
    role: "donor",
    careHospitalId: req.user._id,
    accountStatus: "Active",
    deletedAt: null,
  }).distinct("_id");
  const pledges = await Pledge.find({
    donorId: { $in: donors },
    organ: recipient.organ,
    status: "Active & Pledged",
    donationType: "Living",
  }).populate("donorId", "fullName bloodGroup");
  const matches = [];
  for (const p of pledges) {
    const d = await verifiedBlood(p.donorId._id);
    if (d === blood)
      matches.push({
        donorId: p.donorId._id,
        donorName: p.donorId.fullName,
        pledgeId: p._id,
        organ: p.organ,
        bloodGroup: d,
        screeningStatus: "Basic screening only",
        missingEvidence: [
          "Clinical eligibility",
          "Crossmatch",
          "Final approvals",
        ],
      });
  }
  res.json({
    readyForMatching: true,
    recipient: {
      id: recipient._id,
      name: recipient.fullName,
      organ: recipient.organ,
      verifiedBloodGroup: blood,
    },
    matches,
    disclaimer:
      "Screening support only. Clinical suitability and final allocation require authorized transplant professionals.",
  });
});
export const hospitalMatch = asyncRoute(async (req, res) => {
  const donorIds = await User.find({
    careHospitalId: req.user._id,
    role: "donor",
    accountStatus: "Active",
    deletedAt: null,
  }).distinct("_id");
  res.json(
    await Pledge.find({
      donorId: { $in: donorIds },
      organ: req.body.organ,
      status: "Active & Pledged",
      donationType: "Living",
    }).populate("donorId", "fullName bloodGroup"),
  );
});
