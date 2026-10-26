import express from "express";

import {
  getPledges,
  createPledge,
  deletePledge,
} from "../controllers/pledgeController.js";

import {
  protect,
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

// ==========================================
// DONOR PLEDGES
// ==========================================

router.get(
  "/pledges/:userId",

  protect,

  allowRoles("donor", "admin"),

  sameUserOrRole("userId", "admin"),

  getPledges,
);

// ==========================================
// CREATE PLEDGE
// ==========================================

router.post(
  "/pledges/:userId",

  protect,

  allowRoles("donor"),

  sameUserOrRole("userId"),

  createPledge,
);

// ==========================================
// DELETE / WITHDRAW PLEDGE
// ==========================================

router.delete(
  "/pledges/:userId/:pledgeId",

  protect,

  allowRoles("donor"),

  sameUserOrRole("userId"),

  deletePledge,
);

export default router;
