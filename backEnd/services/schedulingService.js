import Appointment from "../models/Appointment.js";
import SchedulingResource from "../models/SchedulingResource.js";
import { fail } from "../middleware/validation.js";
export const normalizeClinician = (value) =>
  String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
export function appointmentWindow(date, time, durationMinutes = 60) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date || "") ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")
  )
    fail(400, "Use a valid date and 24-hour time");
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 15 ||
    durationMinutes > 480 ||
    durationMinutes % 15
  )
    fail(400, "Duration must be 15–480 minutes in 15-minute increments");
  const scheduledAt = new Date(`${date}T${time}:00+05:30`);
  if (
    !Number.isFinite(+scheduledAt) ||
    scheduledAt <= new Date() ||
    scheduledAt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) !==
      date
  )
    fail(400, "Choose a valid future appointment in India time");
  return {
    scheduledAt,
    scheduledEndAt: new Date(+scheduledAt + durationMinutes * 60000),
    durationMinutes,
  };
}
export function resourceKeys({ hospitalId, surgeon, user, donorId }) {
  return [
    ...new Set([
      `clinician:${hospitalId}:${normalizeClinician(surgeon)}`,
      `participant:${user}`,
      `participant:${donorId}`,
    ]),
  ].sort();
}
export async function prepareSchedulingResources(appointments) {
  const keys = [...new Set(appointments.flatMap(resourceKeys))].sort();
  for (const key of keys) {
    try {
      await SchedulingResource.updateOne(
        { _id: key },
        { $setOnInsert: { revision: 0 } },
        { upsert: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
}
export async function lockSchedulingResources(appointments, session) {
  const keys = [...new Set(appointments.flatMap(resourceKeys))].sort();
  // A concurrent booking touching the same participant/clinician retries its transaction
  // and checks overlaps against the winner's committed appointment.
  for (const key of keys) {
    const result = await SchedulingResource.updateOne(
      { _id: key },
      { $inc: { revision: 1 } },
      { session },
    );
    if (!result.matchedCount)
      fail(409, "Scheduling resources changed. Refresh and try again.");
  }
}
export async function ensureNoOverlap(candidate, session, excludeId) {
  const participants = [candidate.user, candidate.donorId];
  const resources = {
    $or: [
      {
        hospitalId: candidate.hospitalId,
        surgeonKey: normalizeClinician(candidate.surgeon),
      },
      { user: { $in: participants } },
      { donorId: { $in: participants } },
    ],
  };
  // Legacy records without explicit time bounds cannot safely participate in scheduling.
  const legacy = await Appointment.exists({
    status: "scheduled",
    $or: [
      { hospitalId: candidate.hospitalId, surgeonKey: null },
      { ...resources, scheduledEndAt: null },
    ],
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).session(session);
  if (legacy)
    fail(
      409,
      "Existing appointments need duration migration before new bookings",
    );
  const overlap = await Appointment.exists({
    status: "scheduled",
    ...resources,
    scheduledAt: { $lt: candidate.scheduledEndAt },
    scheduledEndAt: { $gt: candidate.scheduledAt },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).session(session);
  if (overlap)
    fail(
      409,
      "This time overlaps another appointment for the clinician, donor, or recipient. Choose another time.",
    );
}
