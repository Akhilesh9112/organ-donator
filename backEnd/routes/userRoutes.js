import express from "express";
import {
  getUsers,
  createUser,
  getUserById,
  loginUser,
  findCompatibleDonor,
  forgotPassword,
  assignCareHospital,
  resetPassword,
} from "../controllers/userController.js";

import {
  protect,
  adminOnly,
  allowRoles,
  sameUserOrRole,
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
router.get("/me", protect, (req, res) => res.json(req.user));
router.patch(
  "/me/care-hospital",
  protect,
  allowRoles("donor", "recipient"),
  assignCareHospital,
);

// Login
router.post("/login", loginUser);

// Find compatible donor
router.get("/match", protect, (req, res) =>
  res
    .status(410)
    .json({ message: "Use the assigned-hospital screening workspace" }),
);

// Fetch all users
router.get("/", protect, adminOnly, getUsers);

// Create user
router.post("/register", createUser);

router.post("/forgot-password", forgotPassword);
//reset password route
router.post("/reset-password/:token", resetPassword);

// Fetch user by ID
router.get("/:id", protect, sameUserOrRole("id", "admin"), getUserById);

export default router;
