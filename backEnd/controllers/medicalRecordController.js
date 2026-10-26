import fs from "node:fs/promises";
import path from "node:path";
import MedicalRecord from "../models/MedicalRecord.js";
import User from "../models/User.js";
import OrganRequest from "../models/OrganRequest.js";
import { extractMedicalDataFromPdf } from "../services/medicalExtractionService.js";
import { asyncRoute, fail, BLOOD_GROUPS } from "../middleware/validation.js";
import { createAuditLog } from "./auditLogController.js";
const types = [
  "Blood Group Report",
  "HLA Typing Report",
  "Crossmatch Report",
  "Medical Summary",
  "Other",
];
const safe = (r) => ({
  id: r._id,
  documentType: r.documentType,
  fileName: r.originalFileName,
  originalFileName: r.originalFileName,
  laboratory: r.laboratory,
  reportDate: r.reportDate,
  verificationStatus: r.verificationStatus,
  extractionStatus: r.extractionStatus,
  extractedData: r.extractedData,
  reviewNotes: r.reviewNotes,
  verifiedAt: r.verifiedAt,
  createdAt: r.createdAt,
  patient: r.user?.fullName
    ? { id: r.user._id, fullName: r.user.fullName, role: r.user.role }
    : undefined,
});
async function audit(req, record, action) {
  await createAuditLog({
    actorId: req.user._id,
    actorRole: req.user.role,
    action,
    entityType: "MedicalRecord",
    entityId: record._id,
    message: action.replaceAll("_", " "),
  });
}
function privatePath(file) {
  const base = path.resolve(
      process.env.UPLOAD_DIR || "uploads/medical-records",
    ),
    target = path.resolve(file);
  if (!target.startsWith(base + path.sep)) fail(403, "Invalid file location");
  return target;
}
export const uploadMedicalRecord = asyncRoute(async (req, res) => {
  try {
    if (!req.file) fail(400, "Choose a medical document");
    if (!types.includes(req.body.documentType))
      fail(400, "Select a valid document type");
    const hospital = await User.findOne({
      _id: req.user.careHospitalId,
      role: "hospital",
      verificationState: "Verified",
      accountStatus: "Active",
      deletedAt: null,
    });
    if (!hospital)
      fail(409, "Select a verified care hospital before uploading");
    if (req.body.laboratory && req.body.laboratory.length > 200)
      fail(400, "Laboratory name is too long");
    if (
      req.body.reportDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.reportDate) ||
        !Number.isFinite(+new Date(req.body.reportDate)) ||
        new Date(req.body.reportDate) > new Date())
    )
      fail(400, "Report date must be valid and cannot be in the future");
    const bytes = await fs.readFile(req.file.path),
      ext = path.extname(req.file.originalname).toLowerCase();
    const actual =
      bytes.subarray(0, 5).toString() === "%PDF-"
        ? ".pdf"
        : bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? ".png"
          : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            ? ".jpg"
            : null;
    if (!actual || actual !== (ext === ".jpeg" ? ".jpg" : ext))
      fail(400, "File contents do not match the selected document format");
    const record = await MedicalRecord.create({
      user: req.user._id,
      hospitalId: hospital._id,
      documentType: req.body.documentType,
      originalFileName: path.basename(req.file.originalname).slice(0, 180),
      storedFileName: req.file.filename,
      filePath: path.resolve(req.file.path),
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      laboratory: req.body.laboratory || "",
      reportDate: req.body.reportDate || null,
    });
    await audit(req, record, "DOCUMENT_UPLOADED");
    res
      .status(201)
      .json({
        message: "Document submitted to your care hospital",
        record: safe(record),
      });
  } catch (error) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    throw error;
  }
});
export const getMedicalRecordsByUser = asyncRoute(async (req, res) => {
  const query = { user: req.params.userId };
  if (req.user.role === "hospital") query.hospitalId = req.user._id;
  res.json((await MedicalRecord.find(query).sort({ createdAt: -1 })).map(safe));
});
export const getMedicalRecordFile = asyncRoute(async (req, res) => {
  const record = req.record;
  await audit(req, record, "DOCUMENT_VIEWED");
  res.set({
    "Content-Type": record.mimeType,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox",
    "Cache-Control": "no-store",
  });
  res.sendFile(privatePath(record.filePath));
});
export const analyzeMedicalRecord = asyncRoute(async (req, res) => {
  const record = req.record;
  if (record.verificationStatus !== "Pending")
    fail(409, "Reviewed evidence cannot be overwritten");
  if (path.extname(record.originalFileName).toLowerCase() !== ".pdf")
    fail(
      400,
      "Images require manual hospital review; automatic extraction supports text PDFs",
    );
  const locked = await MedicalRecord.findOneAndUpdate(
    {
      _id: record._id,
      verificationStatus: "Pending",
      extractionStatus: { $ne: "Processing" },
    },
    { $set: { extractionStatus: "Processing" } },
    { returnDocument: "after" },
  );
  if (!locked) fail(409, "Document analysis is already running");
  try {
    const { extractedData } = await extractMedicalDataFromPdf(
      privatePath(record.filePath),
    );
    locked.extractedData = extractedData;
    locked.extractionStatus = "Extracted";
    await locked.save();
    await audit(req, record, "DOCUMENT_ANALYZED");
    res.json({
      message: "Extraction complete. Hospital review is still required.",
      record: safe(locked),
      extractedData: locked.extractedData,
    });
  } catch (error) {
    await MedicalRecord.updateOne(
      { _id: record._id },
      { $set: { extractionStatus: "Failed" } },
    );
    fail(
      422,
      "Unable to read this PDF. Ask your hospital to review it manually.",
    );
  }
});
export const getPendingMedicalRecords = asyncRoute(async (req, res) =>
  res.json(
    (
      await MedicalRecord.find({
        hospitalId: req.user._id,
        verificationStatus: "Pending",
      })
        .populate("user", "fullName role")
        .sort({ createdAt: -1 })
    ).map(safe),
  ),
);
export const verifyMedicalRecord = asyncRoute(async (req, res) => {
  const { status, bloodGroup, reviewNotes } = req.body;
  if (!["Verified", "Rejected"].includes(status))
    fail(400, "Choose Verified or Rejected");
  if (!reviewNotes?.trim() || reviewNotes.length > 2000)
    fail(400, "Add review notes (maximum 2000 characters)");
  const record = req.record;
  if (
    record.verificationStatus !== "Pending" ||
    record.extractionStatus === "Processing"
  )
    fail(409, "This document is already reviewed or being processed");
  if (status === "Verified") {
    if (req.body.confirmed !== true)
      fail(400, "Confirm that you reviewed the original evidence");
    if (
      record.documentType === "Blood Group Report" &&
      !BLOOD_GROUPS.includes(bloodGroup)
    )
      fail(400, "Confirm the blood group from the original document");
    if (bloodGroup && !BLOOD_GROUPS.includes(bloodGroup))
      fail(400, "Invalid blood group");
    if (bloodGroup) record.extractedData.bloodGroup = bloodGroup;
  }
  const updated = await MedicalRecord.findOneAndUpdate(
    {
      _id: record._id,
      verificationStatus: "Pending",
      extractionStatus: { $ne: "Processing" },
    },
    {
      $set: {
        verificationStatus: status,
        extractionStatus:
          status === "Verified" ? "Extracted" : record.extractionStatus,
        extractedData: record.extractedData,
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        reviewNotes: reviewNotes.trim(),
      },
    },
    { returnDocument: "after", runValidators: true },
  );
  if (!updated) fail(409, "Another reviewer already updated this document");
  await audit(req, record, `DOCUMENT_${status.toUpperCase()}`);
  res.json({
    message: `Document ${status.toLowerCase()}`,
    record: safe(updated),
  });
});
export const deleteMedicalRecord = asyncRoute(async (req, res) => {
  const record = req.record;
  if (
    record.verificationStatus !== "Pending" ||
    record.extractionStatus === "Processing"
  )
    fail(409, "Reviewed or processing evidence must be retained");
  const active = await OrganRequest.exists({
    $or: [{ donorId: req.user._id }, { recipientId: req.user._id }],
    status: { $in: ["Pending", "Accepted", "Hospital Review", "Scheduled"] },
  });
  if (active) fail(409, "Documents cannot be removed during an active case");
  await fs.unlink(privatePath(record.filePath)).catch(() => {});
  await record.deleteOne();
  await audit(req, record, "DOCUMENT_REMOVED");
  res.json({ message: "Document removed" });
});
