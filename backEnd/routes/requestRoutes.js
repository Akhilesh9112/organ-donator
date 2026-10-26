import express from "express";

import {
  createRequest,
  withdrawRequest,
  getRequestsByUser,
  getDonorRequests,
  updateRequestStatus,
  getAcceptedRequests,
} from "../controllers/requestController.js";

import {
  protect,
  allowRoles,
  sameUserOrRole,
  verifiedHospitalOnly,
} from "../middleware/authMiddleware.js";

import OrganRequest from "../models/OrganRequest.js";

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
// RECIPIENT CREATE REQUEST
// ==========================================

router.post(
  "/requests",

  protect,

  allowRoles("recipient"),

  (req, res, next) => {
    const loggedInUserId = String(req.user._id);

    const recipientId = String(req.body.recipientId || "");

    if (loggedInUserId !== recipientId) {
      return res.status(403).json({
        message: "You can create transplant requests only for your own account",
      });
    }

    next();
  },

  createRequest,
);

// ==========================================
// RECIPIENT REQUEST HISTORY
// ==========================================

router.get(
  "/users/:userId/requests",

  protect,

  allowRoles("recipient", "admin"),

  sameUserOrRole("userId", "admin"),

  getRequestsByUser,
);

// ==========================================
// DONOR REQUESTS
// ==========================================

router.get(
  "/donor/:donorId/requests",

  protect,

  allowRoles("donor", "admin"),

  sameUserOrRole("donorId", "admin"),

  getDonorRequests,
);

// ==========================================
// DONOR ACCEPT / REJECT REQUEST
// ==========================================

router.patch(
  "/requests/:requestId/status",

  protect,

  allowRoles("donor"),

  async (req, res, next) => {
    try {
      const request = await OrganRequest.findById(req.params.requestId).select(
        "donorId",
      );

      if (!request) {
        return res.status(404).json({
          message: "Transplant request not found",
        });
      }

      if (String(request.donorId) !== String(req.user._id)) {
        return res.status(403).json({
          message: "You cannot update another donor's request",
        });
      }

      next();
    } catch (error) {
      console.error("Request authorization error:", error);

      return res.status(500).json({
        message: "Unable to authorize request",
      });
    }
  },

  updateRequestStatus,
);

// ==========================================
// HOSPITAL ACCEPTED REQUESTS
// ==========================================

router.get(
  "/hospital/requests/accepted",

  protect,

  verifiedHospitalOnly,

  getAcceptedRequests,
);

router.patch(
  "/requests/:requestId/withdraw",
  protect,
  allowRoles("donor", "recipient"),
  withdrawRequest,
);
export default router;
