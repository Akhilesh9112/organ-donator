import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import MedicalRecord from "../models/MedicalRecord.js";
import {
  protect,
  allowRoles,
  sameUserOrRole,
  verifiedHospitalOnly,
} from "../middleware/authMiddleware.js";
import { asyncRoute, fail } from "../middleware/validation.js";
import {
  uploadMedicalRecord,
  getMedicalRecordsByUser,
  getMedicalRecordFile,
  analyzeMedicalRecord,
  getPendingMedicalRecords,
  verifyMedicalRecord,
  deleteMedicalRecord,
} from "../controllers/medicalRecordController.js";
const router = express.Router();
[
  "id",
  "userId",
  "hospitalId",
  "donorId",
  "recipientId",
  "recordId",
  "requestId",
  "allocationId",
  "recommendationId",
  "pledgeId",
].forEach((param) =>
  router.param(param, (req, res, next, value) =>
    /^[a-f0-9]{24}$/i.test(value)
      ? next()
      : res.status(400).json({ message: `Invalid ${param}` }),
  ),
);
const dir = path.resolve(process.env.UPLOAD_DIR || "uploads/medical-records");
fs.mkdirSync(dir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: dir,
    filename: (req, file, cb) =>
      cb(
        null,
        crypto.randomUUID() + path.extname(file.originalname).toLowerCase(),
      ),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 8 },
  fileFilter: (req, file, cb) => {
    const valid = {
      ".pdf": ["application/pdf"],
      ".png": ["image/png"],
      ".jpg": ["image/jpeg"],
      ".jpeg": ["image/jpeg"],
    };
    cb(
      valid[path.extname(file.originalname).toLowerCase()]?.includes(
        file.mimetype,
      )
        ? null
        : Object.assign(new Error("Upload a PDF, PNG or JPEG"), {
            status: 400,
          }),
      true,
    );
  },
});
const owner = asyncRoute(async (req, res, next) => {
  const record = await MedicalRecord.findById(req.params.recordId);
  if (!record) fail(404, "Record not found");
  if (String(record.user) !== String(req.user._id))
    fail(403, "You can modify only your documents");
  req.record = record;
  next();
});
const access = asyncRoute(async (req, res, next) => {
  const record = await MedicalRecord.findById(req.params.recordId);
  if (!record) fail(404, "Record not found");
  const owns = String(record.user) === String(req.user._id);
  const assigned =
    req.user.role === "hospital" &&
    req.user.verificationState === "Verified" &&
    String(record.hospitalId) === String(req.user._id);
  if (!owns && !assigned)
    fail(
      403,
      "Medical records are restricted to the patient and assigned verified hospital",
    );
  req.record = record;
  next();
});
router.use(protect);
router.get("/hospital/pending", verifiedHospitalOnly, getPendingMedicalRecords);
router.post(
  "/:userId/upload",
  allowRoles("donor", "recipient"),
  sameUserOrRole("userId"),
  (req, res, next) =>
    upload.single("file")(req, res, (error) =>
      error
        ? res
            .status(400)
            .json({
              message:
                error.code === "LIMIT_FILE_SIZE"
                  ? "Maximum document size is 10 MB"
                  : error.message,
            })
        : next(),
    ),
  uploadMedicalRecord,
);
router.get("/file/:recordId", access, getMedicalRecordFile);
router.post("/:recordId/analyze", access, analyzeMedicalRecord);
router.patch(
  "/:recordId/verify",
  verifiedHospitalOnly,
  access,
  verifyMedicalRecord,
);
router.delete(
  "/:recordId",
  allowRoles("donor", "recipient"),
  owner,
  deleteMedicalRecord,
);
router.get(
  "/:userId",
  asyncRoute(async (req, res, next) => {
    if (
      String(req.user._id) !== req.params.userId &&
      req.user.role !== "hospital"
    )
      fail(403, "You cannot access another patient's records");
    if (
      req.user.role === "hospital" &&
      req.user.verificationState !== "Verified"
    )
      fail(403, "Hospital verification is required");
    next();
  }),
  getMedicalRecordsByUser,
);
export default router;
