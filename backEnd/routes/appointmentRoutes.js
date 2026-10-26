import express from "express";

import {
  getAppointments,
  getAppointmentsByUser,
  createAppointment,
  updateAppointment,
  deleteAppointment,
} from "../controllers/appointmentController.js";

import {
  protect,
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
// HOSPITAL APPOINTMENT LIST
// ==========================================

router.get(
  "/",

  protect,

  allowRoles("hospital", "admin"),

  (req, res, next) =>
    req.user.role === "admin" ? next() : verifiedHospitalOnly(req, res, next),
  getAppointments,
);

// ==========================================
// USER'S APPOINTMENTS
// ==========================================

router.get(
  "/user/:userId",

  protect,

  allowRoles("donor", "recipient", "hospital", "admin"),

  sameUserOrRole("userId", "hospital", "admin"),

  (req, res, next) =>
    req.user.role !== "hospital"
      ? next()
      : verifiedHospitalOnly(req, res, next),
  getAppointmentsByUser,
);

// ==========================================
// CREATE APPOINTMENT
// ==========================================

router.post(
  "/",

  protect,
  verifiedHospitalOnly,

  createAppointment,
);

// ==========================================
// UPDATE APPOINTMENT
// ==========================================

router.patch(
  "/:id",

  protect,
  verifiedHospitalOnly,

  updateAppointment,
);

// ==========================================
// DELETE APPOINTMENT
// ==========================================

router.delete(
  "/:id",

  protect,
  verifiedHospitalOnly,

  deleteAppointment,
);

export default router;
