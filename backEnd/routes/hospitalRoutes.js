import express from "express";

import {
  getHospitalStats,
  getOperations,
  listHospitals,
  verifyHospital,
} from "../controllers/hospitalController.js";

import {
  protect,
  adminOnly,
  allowRoles,
  sameUserOrRole,
  verifiedHospitalOnly,
} from "../middleware/authMiddleware.js";

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
// PARTNER HOSPITAL LIST
// ==========================================

router.get(
  "/",

  protect,

  allowRoles("recipient", "donor", "hospital", "admin"),

  listHospitals,
);

// ==========================================
// ADMIN VERIFY HOSPITAL
// Legacy endpoint
// ==========================================

router.patch(
  "/:id/verify",

  protect,
  adminOnly,

  verifyHospital,
);

// ==========================================
// HOSPITAL DASHBOARD STATS
// ==========================================

router.get(
  "/:hospitalId/stats",

  protect,

  allowRoles("hospital", "admin"),

  sameUserOrRole("hospitalId", "admin"),

  getHospitalStats,
);

// ==========================================
// HOSPITAL OPERATIONS
// ==========================================

router.get(
  "/:hospitalId/operations",

  protect,

  allowRoles("hospital", "admin"),

  sameUserOrRole("hospitalId", "admin"),

  (req, res, next) =>
    req.user.role === "admin" ? next() : verifiedHospitalOnly(req, res, next),
  getOperations,
);

export default router;
