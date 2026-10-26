import {
  appointmentWindow,
  normalizeClinician,
  prepareSchedulingResources,
  lockSchedulingResources,
  ensureNoOverlap,
} from "../services/schedulingService.js";
import { enqueueEmails } from "../services/outboxService.js";
import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";
import Allocation from "../models/Allocation.js";
import OrganRequest from "../models/OrganRequest.js";
import Operation from "../models/Operation.js";
import Pledge from "../models/Pledge.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { asyncRoute, fail } from "../middleware/validation.js";
import { requireScreening } from "../utils/clinical.js";
import { createAuditLog } from "./auditLogController.js";
const populated = (q) =>
  q
    .populate("user", "fullName email")
    .populate("donorId", "fullName")
    .populate("hospitalId", "fullName email phone");
export const getAppointments = asyncRoute(async (req, res) =>
  res.json(
    await populated(
      Appointment.find(
        req.user.role === "admin" ? {} : { hospitalId: req.user._id },
      ).sort({ scheduledAt: 1 }),
    ).lean(),
  ),
);
export const getAppointmentsByUser = asyncRoute(async (req, res) => {
  const query = {
    $or: [{ user: req.params.userId }, { donorId: req.params.userId }],
  };
  if (req.user.role === "hospital") query.hospitalId = req.user._id;
  const rows = await populated(
    Appointment.find(query).sort({ scheduledAt: 1 }),
  ).lean();
  res.json(
    rows.map((a) => ({
      ...a,
      id: a._id,
      hospital: a.hospitalId?.fullName,
      dateTime: a.scheduledAt,
    })),
  );
});
export const createAppointment = asyncRoute(async (req, res) => {
  const { allocationId, date, time, surgeon } = req.body;
  const window = appointmentWindow(
    date,
    time,
    req.body.durationMinutes === undefined ? 60 : req.body.durationMinutes,
  );
  const at = window.scheduledAt;
  if (
    !surgeon?.trim() ||
    surgeon.trim().length < 3 ||
    surgeon.trim().length > 120
  )
    fail(400, "Assign a clinician before scheduling");
  const originalAllocation = await Allocation.findOne({
    _id: allocationId,
    hospitalId: req.user._id,
    status: "Hospital Review",
  });
  if (!originalAllocation)
    fail(409, "An allocation in hospital review is required");
  const candidate = {
    ...window,
    hospitalId: req.user._id,
    user: originalAllocation.recipientId,
    donorId: originalAllocation.donorId,
    surgeon: surgeon.trim(),
  };
  await prepareSchedulingResources([candidate]);
  const session = await mongoose.startSession();
  let appointment;
  try {
    await session.withTransaction(async () => {
      const allocation = await Allocation.findOneAndUpdate(
        {
          _id: allocationId,
          hospitalId: req.user._id,
          status: "Hospital Review",
        },
        { $set: { status: "Scheduled" } },
        { returnDocument: "after", session },
      );
      if (!allocation)
        fail(409, "An allocation in hospital review is required");
      const donor = await User.findById(allocation.donorId).session(session),
        recipient = await User.findById(allocation.recipientId).session(
          session,
        );
      await requireScreening(donor, recipient, req.user._id, session);
      if (req.body.clinicalApproval !== true)
        fail(
          400,
          "A clinician must confirm the required approvals before scheduling",
        );
      await lockSchedulingResources([candidate], session);
      await ensureNoOverlap(candidate, session);
      [appointment] = await Appointment.create(
        [
          {
            user: allocation.recipientId,
            donorId: allocation.donorId,
            hospitalId: req.user._id,
            requestId: allocation.requestId,
            allocationId,
            organ: allocation.organ,
            type: `${allocation.organ} care appointment`,
            date: new Date(`${date}T00:00:00+05:30`),
            time,
            ...window,
            surgeonKey: normalizeClinician(surgeon),
            surgeon: surgeon.trim(),
          },
        ],
        { session, ordered: true },
      );
      await OrganRequest.updateOne(
        { _id: allocation.requestId },
        { $set: { status: "Scheduled" } },
        { session, ordered: true },
      );
      await Operation.create(
        [
          {
            appointmentId: appointment._id,
            allocationId,
            hospitalId: req.user._id,
            patient: recipient.fullName,
            organ: allocation.organ,
            surgeon: surgeon.trim(),
            scheduledTime: at.toISOString(),
            status: "Pre-Op Screening",
          },
        ],
        { session, ordered: true },
      );
      const notices = await Notification.create(
        [donor, recipient].map((u) => ({
          userId: u._id,
          role: u.role,
          type: "APPOINTMENT_SCHEDULED",
          title: "Appointment scheduled",
          message: `Your care appointment is scheduled for ${date} at ${time} IST.`,
          referenceId: appointment._id,
          referenceType: "Appointment",
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
    actorRole: "hospital",
    action: "APPOINTMENT_SCHEDULED",
    entityType: "Appointment",
    entityId: appointment._id,
    message: "Clinician confirmed approvals and scheduled appointment",
  });
  res.status(201).json({ message: "Appointment scheduled", appointment });
});
async function change(req, res, cancel = false) {
  const original = await Appointment.findOne({
    _id: req.params.id,
    hospitalId: req.user._id,
  });
  if (!original) fail(404, "Appointment not found");
  const requested = {
    hospitalId: original.hospitalId,
    user: original.user,
    donorId: original.donorId,
    surgeon: req.body.surgeon ?? original.surgeon,
  };
  await prepareSchedulingResources([original, requested]);
  const session = await mongoose.startSession();
  let appointment;
  try {
    await session.withTransaction(async () => {
      appointment = await Appointment.findOne({
        _id: req.params.id,
        hospitalId: req.user._id,
      }).session(session);
      if (!appointment) fail(404, "Appointment not found");
      if (appointment.status !== "scheduled")
        fail(409, "Only scheduled appointments can be changed");
      const status = cancel ? "canceled" : req.body.status || "scheduled";
      if (!["scheduled", "completed", "canceled"].includes(status))
        fail(400, "Invalid appointment status");
      if (
        status === "completed" &&
        (!appointment.scheduledEndAt || appointment.scheduledEndAt > new Date())
      )
        fail(
          409,
          "An appointment cannot be completed before its scheduled end",
        );
      if (
        status === "canceled" &&
        (!req.body.cancellationReason?.trim() ||
          req.body.cancellationReason.length > 1000)
      )
        fail(400, "Provide a cancellation reason (maximum 1000 characters)");
      if (
        status !== "scheduled" &&
        ["date", "time", "surgeon", "durationMinutes"].some(
          (field) => req.body[field] !== undefined,
        )
      )
        fail(400, "Reschedule separately before changing appointment status");
      const before = {
        hospitalId: appointment.hospitalId,
        user: appointment.user,
        donorId: appointment.donorId,
        surgeon: appointment.surgeon,
      };
      if (
        req.body.date ||
        req.body.time ||
        req.body.durationMinutes !== undefined
      ) {
        const date =
          req.body.date ||
          appointment.scheduledAt.toLocaleDateString("en-CA", {
            timeZone: "Asia/Kolkata",
          });
        const time = req.body.time || appointment.time;
        Object.assign(
          appointment,
          appointmentWindow(
            date,
            time,
            req.body.durationMinutes === undefined
              ? appointment.durationMinutes
              : req.body.durationMinutes,
          ),
        );
        appointment.date = new Date(`${date}T00:00:00+05:30`);
        appointment.time = time;
      }
      if (req.body.surgeon !== undefined) {
        if (
          req.body.surgeon.trim().length < 3 ||
          req.body.surgeon.trim().length > 120
        )
          fail(400, "Clinician name must be 3–120 characters");
        appointment.surgeon = req.body.surgeon.trim();
      }
      appointment.surgeonKey = normalizeClinician(appointment.surgeon);
      await lockSchedulingResources([before, appointment], session);
      if (status === "scheduled")
        await ensureNoOverlap(appointment, session, appointment._id);
      appointment.status = status;
      appointment.cancellationReason = req.body.cancellationReason;
      await appointment.save({ session, ordered: true });
      const linkedStatus = {
        scheduled: "Scheduled",
        completed: "Completed",
        canceled: "Cancelled",
      }[status];
      await Allocation.updateOne(
        { _id: appointment.allocationId },
        {
          $set: {
            status: linkedStatus,
            ...(status === "completed" ? { completedAt: new Date() } : {}),
          },
        },
        { session, ordered: true },
      );
      await OrganRequest.updateOne(
        { _id: appointment.requestId },
        {
          $set: {
            status: linkedStatus,
            ...(status !== "scheduled" ? { closedAt: new Date() } : {}),
          },
        },
        { session, ordered: true },
      );
      const request = await OrganRequest.findById(
        appointment.requestId,
      ).session(session);
      if (status !== "scheduled")
        await Pledge.updateOne(
          { _id: request.pledgeId },
          {
            $set: {
              status: status === "completed" ? "Completed" : "Withdrawn",
            },
          },
          { session, ordered: true },
        );
      await Operation.updateOne(
        { appointmentId: appointment._id },
        {
          $set: {
            status: {
              scheduled: "Pre-Op Screening",
              completed: "Completed",
              canceled: "Cancelled",
            }[status],
            surgeon: appointment.surgeon,
            scheduledTime: appointment.scheduledAt.toISOString(),
          },
        },
        { session, ordered: true },
      );
      const notices = await Notification.create(
        [appointment.user, appointment.donorId].map((u, i) => ({
          userId: u,
          role: i ? "donor" : "recipient",
          type: "APPOINTMENT_SCHEDULED",
          title: "Appointment updated",
          message: `Appointment status: ${status}. Check your care timeline.`,
          referenceId: appointment._id,
          referenceType: "Appointment",
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
    actorRole: "hospital",
    action: "APPOINTMENT_UPDATED",
    entityType: "Appointment",
    entityId: appointment._id,
    message: `Appointment ${appointment.status}`,
  });
  res.json(appointment);
}
export const updateAppointment = asyncRoute((req, res) => change(req, res));
export const deleteAppointment = asyncRoute((req, res) =>
  change(req, res, true),
);
