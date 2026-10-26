import Appointment from "../models/Appointment.js";
import Operation from "../models/Operation.js";
import { enqueueEmails } from "../services/outboxService.js";
import mongoose from "mongoose";
import OrganRequest from "../models/OrganRequest.js";
import User from "../models/User.js";
import Pledge from "../models/Pledge.js";
import Allocation from "../models/Allocation.js";
import Notification from "../models/Notification.js";
import MatchRecommendation from "../models/MatchRecommendation.js";
import { asyncRoute, fail } from "../middleware/validation.js";
import { requireScreening } from "../utils/clinical.js";
import { createAuditLog } from "./auditLogController.js";
const populate = (q) =>
  q
    .populate("recipientId", "fullName email phone bloodGroup")
    .populate("donorId", "fullName email phone bloodGroup")
    .populate("pledgeId")
    .populate("hospitalId", "fullName");
export const createRequest = asyncRoute(async (req, res) => {
  const session = await mongoose.startSession();
  let request;
  try {
    await session.withTransaction(async () => {
      const { recommendationId, donorId, pledgeId, organ } = req.body;
      const recipient = await User.findById(req.user._id).session(session);
      if (!recommendationId)
        fail(
          400,
          "Select a hospital recommendation before requesting donor consent",
        );
      const recommendation = await MatchRecommendation.findOne({
        _id: recommendationId,
        recipientId: req.user._id,
        status: "Recommended",
      }).session(session);
      if (!recommendation) fail(409, "Recommendation is unavailable");
      if (
        String(recommendation.donorId) !== donorId ||
        String(recommendation.pledgeId) !== pledgeId ||
        recommendation.organ !== organ
      )
        fail(400, "Request does not match the recommendation");
      const donor = await User.findById(donorId).session(session);
      const bloodGroup = await requireScreening(
        donor,
        recipient,
        recommendation.hospitalId,
        session,
      );
      const pledge = await Pledge.findOne({
        _id: pledgeId,
        donorId,
        organ,
        status: "Active & Pledged",
        donationType: "Living",
      }).session(session);
      if (!pledge) fail(409, "Pledge is no longer available");
      [request] = await OrganRequest.create(
        [
          {
            recipientId: req.user._id,
            donorId,
            pledgeId,
            organ,
            bloodGroup,
            hospitalId: recommendation.hospitalId,
            hospital: "Assigned care hospital",
            recommendationId,
          },
        ],
        { session, ordered: true },
      );
      recommendation.status = "Request Sent";
      await recommendation.save({ session, ordered: true });
      const notices = await Notification.create(
        [
          {
            userId: donorId,
            role: "donor",
            type: "GENERAL",
            title: "Consent requested",
            message: `A ${organ} case is awaiting your decision.`,
            referenceId: request._id,
            referenceType: "OrganRequest",
          },
        ],
        { session, ordered: true },
      );
      await enqueueEmails(notices, session);
    });
  } finally {
    await session.endSession();
  }
  await createAuditLog({
    actorId: req.user._id,
    actorRole: req.user.role,
    action: "REQUEST_CREATED",
    entityType: "OrganRequest",
    entityId: request._id,
    message: "Recipient requested donor consent",
  });
  res.status(201).json(await populate(OrganRequest.findById(request._id)));
});
export const getRequestsByUser = asyncRoute(async (req, res) =>
  res.json(
    await populate(
      OrganRequest.find({ recipientId: req.params.userId }).sort({
        createdAt: -1,
      }),
    ).lean(),
  ),
);
export const getDonorRequests = asyncRoute(async (req, res) =>
  res.json(
    await populate(
      OrganRequest.find({ donorId: req.params.donorId }).sort({
        createdAt: -1,
      }),
    ).lean(),
  ),
);
export const updateRequestStatus = asyncRoute(async (req, res) => {
  const { status } = req.body;
  if (!["Accepted", "Rejected"].includes(status))
    fail(400, "Choose Accepted or Rejected");
  const session = await mongoose.startSession();
  let request;
  try {
    await session.withTransaction(async () => {
      request = await OrganRequest.findOne({
        _id: req.params.requestId,
        donorId: req.user._id,
        status: "Pending",
      }).session(session);
      if (!request) fail(409, "Request is no longer pending");
      if (status === "Accepted") {
        const donor = await User.findById(request.donorId).session(session),
          recipient = await User.findById(request.recipientId).session(session);
        await requireScreening(donor, recipient, request.hospitalId, session);
        const pledge = await Pledge.findOneAndUpdate(
          {
            _id: request.pledgeId,
            status: "Active & Pledged",
            donationType: "Living",
          },
          { $set: { status: "Matched - Donor Accepted" } },
          { returnDocument: "after", session },
        );
        if (!pledge) fail(409, "Pledge has already been reserved or withdrawn");
        request.donorApprovedAt = new Date();
        await OrganRequest.updateMany(
          {
            _id: { $ne: request._id },
            pledgeId: request.pledgeId,
            status: "Pending",
          },
          { $set: { status: "Rejected", closedAt: new Date() } },
          { session, ordered: true },
        );
        await MatchRecommendation.updateMany(
          { pledgeId: request.pledgeId, status: "Recommended" },
          { $set: { status: "Expired" } },
          { session, ordered: true },
        );
      }
      request.status = status;
      await request.save({ session, ordered: true });
      const notices = await Notification.create(
        [
          {
            userId: request.recipientId,
            role: "recipient",
            type: "GENERAL",
            title: `Donor ${status.toLowerCase()}`,
            message: `Your ${request.organ} request was ${status.toLowerCase()}.`,
            referenceId: request._id,
            referenceType: "OrganRequest",
          },
        ],
        { session, ordered: true },
      );
      await enqueueEmails(notices, session);
    });
  } finally {
    await session.endSession();
  }
  await createAuditLog({
    actorId: req.user._id,
    actorRole: req.user.role,
    action: `REQUEST_${status.toUpperCase()}`,
    entityType: "OrganRequest",
    entityId: request._id,
    message: `Donor ${status.toLowerCase()} request`,
  });
  res.json({ message: `Request ${status.toLowerCase()}`, request });
});
export const getAcceptedRequests = asyncRoute(async (req, res) => {
  const requests = await populate(
    OrganRequest.find({
      hospitalId: req.user._id,
      status: {
        $in: [
          "Accepted",
          "Hospital Review",
          "Scheduled",
          "Completed",
          "Cancelled",
        ],
      },
    }).sort({ createdAt: -1 }),
  ).lean();
  const allocations = await Allocation.find({
    hospitalId: req.user._id,
    requestId: { $in: requests.map((r) => r._id) },
  }).lean();
  const byRequest = new Map(allocations.map((a) => [String(a.requestId), a]));
  res.json(
    requests.map((r) => ({
      ...r,
      id: r._id,
      recipientName: r.recipientId?.fullName,
      donorName: r.donorId?.fullName,
      allocationId: byRequest.get(String(r._id))?._id,
    })),
  );
});

export const withdrawRequest = asyncRoute(async (req, res) => {
  const reason = req.body.withdrawalReason;
  if (typeof reason !== "string" || !reason.trim() || reason.length > 1000)
    fail(400, "Provide a withdrawal reason (maximum 1000 characters)");
  const session = await mongoose.startSession();
  let request;
  try {
    await session.withTransaction(async () => {
      const owner =
        req.user.role === "donor"
          ? { donorId: req.user._id }
          : { recipientId: req.user._id };
      request = await OrganRequest.findOneAndUpdate(
        {
          _id: req.params.requestId,
          ...owner,
          status: {
            $in: ["Pending", "Accepted", "Hospital Review", "Scheduled"],
          },
        },
        {
          $set: {
            status: "Cancelled",
            closedAt: new Date(),
            cancellationReason: reason.trim(),
          },
        },
        { returnDocument: "after", session },
      );
      if (!request) fail(409, "Only your active care cases can be withdrawn");
      // A recipient canceling a pending request does not withdraw another person's pledge.
      const allocation = await Allocation.findOne({
        requestId: request._id,
      }).session(session);
      const pledge = await Pledge.findById(request.pledgeId).session(session);
      if (
        pledge &&
        (req.user.role === "donor" ||
          pledge.status === "Matched - Donor Accepted")
      ) {
        pledge.status = "Withdrawn";
        await pledge.save({ session });
      }
      await Allocation.updateMany(
        { requestId: request._id },
        { $set: { status: "Cancelled" } },
        { session },
      );
      await Appointment.updateMany(
        { requestId: request._id, status: "scheduled" },
        { $set: { status: "canceled", cancellationReason: reason.trim() } },
        { session },
      );
      if (allocation)
        await Operation.updateMany(
          { allocationId: allocation._id },
          { $set: { status: "Cancelled" } },
          { session },
        );
      if (req.user.role === "donor") {
        await OrganRequest.updateMany(
          { pledgeId: request.pledgeId, status: "Pending" },
          {
            $set: {
              status: "Cancelled",
              closedAt: new Date(),
              cancellationReason: "Donor withdrew consent",
            },
          },
          { session },
        );
        await MatchRecommendation.updateMany(
          { pledgeId: request.pledgeId, status: "Recommended" },
          { $set: { status: "Expired" } },
          { session },
        );
      }
      const recipients = [
        request.donorId,
        request.recipientId,
        request.hospitalId,
      ].filter((u) => String(u) !== String(req.user._id));
      const notices = await Notification.create(
        recipients.map((userId) => ({
          userId,
          title: "Care case withdrawn",
          message:
            "A participant withdrew from this care case. Review the updated timeline with your coordinator.",
          referenceId: request._id,
          referenceType: "OrganRequest",
        })),
        { session, ordered: true },
      );
      await enqueueEmails(notices, session);
    });
  } finally {
    await session.endSession();
  }
  await createAuditLog({
    actorId: req.user._id,
    actorRole: req.user.role,
    action: "CASE_WITHDRAWN",
    entityType: "OrganRequest",
    entityId: request._id,
    message: "Participant withdrew from the care case",
  });
  res.json({
    message: "Withdrawal recorded and linked appointments canceled",
    request,
  });
});
