import EmailOutbox from "../models/EmailOutbox.js";
import { asyncRoute, fail } from "../middleware/validation.js";
import express from "express";

import {
  getAdminStats,
  getAdminUsers,
  updateUserStatus,
  getAdminHospitals,
  updateHospitalVerification,
  getAdminCases,
  createAdminUser,
  deleteAdminUser,
} from "../controllers/adminController.js";

import { protect, adminOnly } from "../middleware/authMiddleware.js";

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
// ALL ROUTES BELOW REQUIRE ADMIN LOGIN
// ==========================================
router.use("/admin", protect, adminOnly);

// Dashboard statistics
router.get("/admin/stats", getAdminStats);

// Users
router.get("/admin/users", getAdminUsers);

router.post("/admin/users", createAdminUser);

router.patch("/admin/users/:userId/status", updateUserStatus);

router.delete("/admin/users/:userId", deleteAdminUser);

// Hospitals
router.get("/admin/hospitals", getAdminHospitals);

router.patch(
  "/admin/hospitals/:hospitalId/verification",
  updateHospitalVerification,
);

// Cases
router.get("/admin/cases", getAdminCases);

router.get(
  "/admin/delivery",
  asyncRoute(async (req, res) =>
    res.json(
      await EmailOutbox.find()
        .select("status attempts createdAt nextAttemptAt sentAt")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ),
  ),
);
router.post(
  "/admin/delivery/:id/retry",
  asyncRoute(async (req, res) => {
    const job = await EmailOutbox.findOneAndUpdate(
      { _id: req.params.id, status: "Failed" },
      { $set: { status: "Pending", attempts: 0, nextAttemptAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!job) fail(409, "Only failed delivery jobs can be retried");
    res.json({ message: "Delivery retry queued" });
  }),
);
export default router;
