import { inspectAppointmentSchedule } from "../services/schedulingAuditService.js";
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import OrganRequest from "../models/OrganRequest.js";
import Allocation from "../models/Allocation.js";
import Appointment from "../models/Appointment.js";
import Pledge from "../models/Pledge.js";
import MedicalRecord from "../models/MedicalRecord.js";
import MatchRecommendation from "../models/MatchRecommendation.js";
import Operation from "../models/Operation.js";
import Notification from "../models/Notification.js";
import EmailOutbox from "../models/EmailOutbox.js";
await mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DATABASE,
  autoIndex: false,
});
try {
  const missing = {};
  for (const [label, model, fields] of [
    ["pledges", Pledge, ["donationType"]],
    ["requests", OrganRequest, ["hospitalId"]],
    [
      "appointments",
      Appointment,
      [
        "donorId",
        "scheduledAt",
        "scheduledEndAt",
        "durationMinutes",
        "surgeonKey",
      ],
    ],
    ["documents", MedicalRecord, ["hospitalId"]],
  ])
    missing[label] = await model.countDocuments({
      $or: fields.map((f) => ({ [f]: null })),
    });
  const duplicates = {};
  for (const [label, model, match, group] of [
    [
      "activePledges",
      Pledge,
      { status: { $in: ["Active & Pledged", "Matched - Donor Accepted"] } },
      { donorId: "$donorId", organ: "$organ" },
    ],
    ["allocations", Allocation, {}, "$requestId"],
    ["appointments", Appointment, {}, "$allocationId"],
    [
      "acceptedRequests",
      OrganRequest,
      {
        status: {
          $in: ["Accepted", "Hospital Review", "Scheduled", "Completed"],
        },
      },
      "$pledgeId",
    ],
    [
      "activeRequests",
      OrganRequest,
      {
        status: {
          $in: ["Pending", "Accepted", "Hospital Review", "Scheduled"],
        },
      },
      { recipientId: "$recipientId", pledgeId: "$pledgeId" },
    ],
    [
      "recommendations",
      MatchRecommendation,
      { status: "Recommended" },
      {
        recipientId: "$recipientId",
        pledgeId: "$pledgeId",
        hospitalId: "$hospitalId",
      },
    ],
  ])
    duplicates[label] =
      (
        await model.aggregate([
          { $match: match },
          { $group: { _id: group, n: { $sum: 1 } } },
          { $match: { n: { $gt: 1 } } },
          { $count: "count" },
        ])
      )[0]?.count || 0;
  const scheduling = await inspectAppointmentSchedule();
  console.log(JSON.stringify({ missing, duplicates, scheduling }, null, 2));
  if (
    [
      ...Object.values(missing),
      ...Object.values(duplicates),
      scheduling.invalidIntervals,
      scheduling.overlappingResourceIntervals,
    ].some(Boolean)
  )
    throw new Error(
      "Resolve legacy mappings and duplicate records on a backup/staging copy before creating indexes. No records were changed.",
    );
  if (process.argv.includes("--apply")) {
    for (const model of [
      User,
      OrganRequest,
      Allocation,
      Appointment,
      Pledge,
      MedicalRecord,
      MatchRecommendation,
      Operation,
      Notification,
      EmailOutbox,
    ])
      await model.createIndexes();
    console.log("Indexes created; no clinical records changed");
  } else
    console.log(
      "Checks passed. Use npm run db:indexes only after backup and review.",
    );
} finally {
  await mongoose.disconnect();
}
