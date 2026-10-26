import express from "express";

import { getAuditLogs } from "../controllers/auditLogController.js";

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

router.get("/admin/audit-logs", protect, adminOnly, getAuditLogs);

export default router;
