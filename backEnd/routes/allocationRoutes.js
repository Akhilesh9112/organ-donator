import express from "express";

import { createAllocation } from "../controllers/allocationController.js";

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

router.post(
  "/allocations",

  protect,
  verifiedHospitalOnly,

  createAllocation,
);

export default router;
