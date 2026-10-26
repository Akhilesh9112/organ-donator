import express from "express";

import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notificationController.js";

import { protect } from "../middleware/authMiddleware.js";

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

// All notification routes require login
router.use(protect);

// Current user's notifications
router.get("/", getNotifications);

// Current user's unread count
router.get("/unread-count", getUnreadCount);

// Mark all as read
// IMPORTANT:
// Keep this BEFORE /:id/read
router.patch("/read-all", markAllNotificationsRead);

// Mark one as read
router.patch("/:id/read", markNotificationRead);

export default router;
