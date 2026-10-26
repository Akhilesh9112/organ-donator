import express from "express";

import {
  hospitalMatch,
  recipientCompatibilityMatch,
  getScreeningRecipients,
} from "../controllers/matchController.js";

import { protect, verifiedHospitalOnly } from "../middleware/authMiddleware.js";

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

// ==========================================
// HOSPITAL MATCHING
// ==========================================

router.post(
  "/match/hospital",

  protect,
  verifiedHospitalOnly,

  hospitalMatch,
);

// ==========================================
// RECIPIENTS READY FOR SCREENING
// ==========================================

router.get(
  "/match/recipients/ready",

  protect,
  verifiedHospitalOnly,

  getScreeningRecipients,
);

// ==========================================
// VERIFIED RECIPIENT MATCHING
// ==========================================

router.get(
  "/match/recipient/:recipientId",

  protect,
  verifiedHospitalOnly,

  recipientCompatibilityMatch,
);

export default router;
