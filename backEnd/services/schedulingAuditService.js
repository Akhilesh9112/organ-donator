import Appointment from "../models/Appointment.js";
import { normalizeClinician } from "./schedulingService.js";
// Read-only migration check. No identities or medical values are emitted.
export async function inspectAppointmentSchedule() {
  let invalidIntervals = 0;
  for await (const row of Appointment.collection.find(
    { status: "scheduled" },
    {
      projection: {
        scheduledAt: 1,
        scheduledEndAt: 1,
        durationMinutes: 1,
        surgeon: 1,
        surgeonKey: 1,
      },
    },
  )) {
    if (
      !(row.scheduledAt instanceof Date) ||
      !(row.scheduledEndAt instanceof Date) ||
      !Number.isInteger(row.durationMinutes) ||
      row.durationMinutes < 15 ||
      row.durationMinutes > 480 ||
      row.durationMinutes % 15 ||
      +row.scheduledEndAt - +row.scheduledAt !== row.durationMinutes * 60000 ||
      !row.surgeonKey ||
      row.surgeonKey !== normalizeClinician(row.surgeon)
    )
      invalidIntervals++;
  }
  if (invalidIntervals)
    return { invalidIntervals, overlappingResourceIntervals: null };
  const cursor = Appointment.collection.aggregate([
    { $match: { status: "scheduled" } },
    {
      $project: {
        scheduledAt: 1,
        scheduledEndAt: 1,
        resources: [
          {
            $concat: [
              "clinician:",
              { $toString: "$hospitalId" },
              ":",
              "$surgeonKey",
            ],
          },
          { $concat: ["participant:", { $toString: "$user" }] },
          { $concat: ["participant:", { $toString: "$donorId" }] },
        ],
      },
    },
    { $unwind: "$resources" },
    { $sort: { resources: 1, scheduledAt: 1, scheduledEndAt: 1 } },
  ]);
  let resource = null,
    end = 0,
    overlappingResourceIntervals = 0;
  for await (const row of cursor) {
    if (row.resources !== resource) {
      resource = row.resources;
      end = 0;
    }
    if (+row.scheduledAt < end) overlappingResourceIntervals++;
    end = Math.max(end, +row.scheduledEndAt);
  }
  return { invalidIntervals, overlappingResourceIntervals };
}
