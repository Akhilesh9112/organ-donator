import User from "../models/User.js";
import MedicalRecord from "../models/MedicalRecord.js";
import { fail } from "../middleware/validation.js";
export async function verifiedBlood(userId, session) {
  let query = MedicalRecord.findOne({
    user: userId,
    verificationStatus: "Verified",
    extractionStatus: "Extracted",
    "extractedData.bloodGroup": {
      $in: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },
  }).sort({ verifiedAt: -1 });
  if (session) query = query.session(session);
  return (await query)?.extractedData.bloodGroup;
}
export async function requireScreening(donor, recipient, hospitalId, session) {
  if (
    !(await User.exists({
      _id: hospitalId,
      role: "hospital",
      verificationState: "Verified",
      accountStatus: "Active",
      deletedAt: null,
    }).session(session || null))
  )
    fail(409, "The assigned hospital must be active and verified");
  if (
    !donor ||
    !recipient ||
    donor.role !== "donor" ||
    recipient.role !== "recipient" ||
    donor.accountStatus !== "Active" ||
    recipient.accountStatus !== "Active" ||
    donor.deletedAt ||
    recipient.deletedAt
  )
    fail(409, "Both participants must have active accounts");
  if (
    String(donor.careHospitalId) !== String(hospitalId) ||
    String(recipient.careHospitalId) !== String(hospitalId)
  )
    fail(403, "Both participants must be assigned to this hospital");
  const d = await verifiedBlood(donor._id, session),
    r = await verifiedBlood(recipient._id, session);
  if (!d || !r)
    fail(
      409,
      "Verified blood-group evidence is required for both participants",
    );
  if (d !== r)
    fail(
      409,
      "This workflow requires matching verified blood groups for initial screening",
    );
  return r;
}
