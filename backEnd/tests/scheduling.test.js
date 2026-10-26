import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "isolated-scheduling-secret-at-least-32-chars";
process.env.MAIL_MODE = "disabled";
process.env.UPLOAD_DIR = await fs.mkdtemp(
  path.join(os.tmpdir(), "organsync-scheduling-"),
);
const { default: app } = await import("../app.js");
const { default: User } = await import("../models/User.js");
const { default: Appointment } = await import("../models/Appointment.js");
const { default: Allocation } = await import("../models/Allocation.js");
const { default: OrganRequest } = await import("../models/OrganRequest.js");
const { default: Pledge } = await import("../models/Pledge.js");
const { default: MedicalRecord } = await import("../models/MedicalRecord.js");
const { default: Operation } = await import("../models/Operation.js");
const { default: Notification } = await import("../models/Notification.js");
let db, hospital, token;
const call = (method, url, body) =>
  request(app)[method](url).auth(token, { type: "bearer" }).send(body);
const expectStatus = (r, status) => {
  assert.equal(r.status, status, JSON.stringify(r.body));
  return r.body;
};
before(
  async () => {
    db = await MongoMemoryReplSet.create({
      replSet: { count: 1, args: ["--nounixsocket"] },
      binary: { version: "7.0.24" },
    });
    await mongoose.connect(db.getUri(), { dbName: "scheduling" });
    for (const m of Object.values(mongoose.models)) await m.init();
    hospital = await User.create({
      role: "hospital",
      fullName: "Scheduling Hospital",
      email: "hospital@example.test",
      phone: "9876543210",
      password: "not-a-login-password",
      verificationState: "Verified",
      license: "SYNTHETIC-ONLY",
    });
    token = jwt.sign(
      { userId: hospital.id, sessionVersion: 0 },
      process.env.JWT_SECRET,
    );
  },
  { timeout: 120000 },
);
beforeEach(async () => {
  for (const model of [
    Appointment,
    Allocation,
    OrganRequest,
    Pledge,
    Operation,
    Notification,
  ])
    await model.deleteMany({});
});
after(async () => {
  await mongoose.disconnect();
  if (db) await db.stop();
  await fs.rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
});
async function person(role) {
  const u = await User.create({
    role,
    fullName: `Test ${role}`,
    email: `${randomUUID()}@example.test`,
    phone: "9876543210",
    password: "not-a-login-password",
    careHospitalId: hospital.id,
    bloodGroup: "O+",
    organ: "Kidney",
    consent: true,
  });
  await MedicalRecord.create({
    user: u.id,
    hospitalId: hospital.id,
    documentType: "Blood Group Report",
    originalFileName: "synthetic.pdf",
    storedFileName: "synthetic.pdf",
    filePath: path.join(process.env.UPLOAD_DIR, "synthetic.pdf"),
    mimeType: "application/pdf",
    verificationStatus: "Verified",
    extractionStatus: "Extracted",
    extractedData: { bloodGroup: "O+" },
    verifiedAt: new Date(),
  });
  return u;
}
async function allocation(people, organ = "Kidney") {
  const donor = people?.donor || (await person("donor")),
    recipient = people?.recipient || (await person("recipient"));
  const pledge = await Pledge.create({
    donorId: donor.id,
    organ,
    donationType: "Living",
    status: "Matched - Donor Accepted",
  });
  const q = await OrganRequest.create({
    donorId: donor.id,
    recipientId: recipient.id,
    pledgeId: pledge.id,
    hospitalId: hospital.id,
    organ,
    bloodGroup: "O+",
    status: "Hospital Review",
  });
  const a = await Allocation.create({
    requestId: q.id,
    donorId: donor.id,
    recipientId: recipient.id,
    pledgeId: pledge.id,
    hospitalId: hospital.id,
    organ,
  });
  return { a, donor, recipient };
}
const book = (a, overrides = {}) =>
  call("post", "/api/appointments", {
    allocationId: a.id,
    date: "2030-06-15",
    time: "09:00",
    surgeon: "Dr. Shared",
    durationMinutes: 60,
    clinicalApproval: true,
    ...overrides,
  });
test("duration validation rejects malformed or unsupported values", async () => {
  const { a } = await allocation();
  for (const durationMinutes of [0, 14, 20, 481, 60.5, "60", null])
    expectStatus(await book(a, { durationMinutes }), 400);
});
test("explicit duration produces a persisted end time including midnight rollover", async () => {
  const { a } = await allocation();
  const ap = expectStatus(
    await book(a, { time: "23:30", durationMinutes: 90 }),
    201,
  ).appointment;
  assert.equal(ap.durationMinutes, 90);
  assert.equal(ap.scheduledAt, "2030-06-15T18:00:00.000Z");
  assert.equal(ap.scheduledEndAt, "2030-06-15T19:30:00.000Z");
  assert.equal(ap.surgeonKey, "dr. shared");
});
test("overlap uses normalized clinician names and different start times", async () => {
  const first = await allocation(),
    second = await allocation();
  expectStatus(await book(first.a), 201);
  const r = await book(second.a, {
    time: "09:30",
    surgeon: "  DR.   SHARED  ",
  });
  expectStatus(r, 409);
  assert.match(r.body.message, /overlaps/);
  assert.equal(
    (await Allocation.findById(second.a.id)).status,
    "Hospital Review",
  );
  assert.equal(await Appointment.countDocuments(), 1);
});
test("donor conflicts are blocked even with a different clinician and recipient", async () => {
  const first = await allocation();
  const second = await allocation(
    { donor: first.donor, recipient: await person("recipient") },
    "Liver",
  );
  expectStatus(await book(first.a), 201);
  expectStatus(
    await book(second.a, { time: "09:45", surgeon: "Dr Other" }),
    409,
  );
});
test("recipient conflicts are blocked even with a different clinician and donor", async () => {
  const first = await allocation();
  const second = await allocation({
    donor: await person("donor"),
    recipient: first.recipient,
  });
  expectStatus(await book(first.a), 201);
  expectStatus(
    await book(second.a, { time: "09:45", surgeon: "Dr Other" }),
    409,
  );
});
test("adjacent appointments sharing resources are allowed", async () => {
  const first = await allocation(),
    second = await allocation(
      { donor: first.donor, recipient: first.recipient },
      "Liver",
    );
  expectStatus(await book(first.a), 201);
  expectStatus(await book(second.a, { time: "10:00" }), 201);
  assert.equal(await Appointment.countDocuments(), 2);
});
test("concurrent overlapping bookings commit only one appointment", async () => {
  const first = await allocation(),
    second = await allocation();
  const responses = await Promise.all([
    book(first.a),
    book(second.a, { time: "09:15" }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  assert.equal(await Appointment.countDocuments(), 1);
  assert.equal(await Operation.countDocuments(), 1);
  assert.equal(await Allocation.countDocuments({ status: "Scheduled" }), 1);
});
test("conflicting reschedule rolls back appointment, operation, and notifications", async () => {
  const first = await allocation(),
    second = await allocation();
  expectStatus(await book(first.a), 201);
  const ap = expectStatus(
    await book(second.a, { time: "11:00" }),
    201,
  ).appointment;
  const notices = await Notification.countDocuments();
  expectStatus(
    await call("patch", `/api/appointments/${ap._id}`, {
      time: "09:30",
      durationMinutes: 90,
    }),
    409,
  );
  const unchanged = await Appointment.findById(ap._id);
  assert.equal(unchanged.time, "11:00");
  assert.equal(unchanged.durationMinutes, 60);
  assert.equal(
    (await Operation.findOne({ appointmentId: ap._id })).scheduledTime,
    ap.scheduledAt,
  );
  assert.equal(await Notification.countDocuments(), notices);
});
test("successful reschedule updates duration and the linked operation", async () => {
  const { a } = await allocation();
  const ap = expectStatus(await book(a), 201).appointment;
  const changed = expectStatus(
    await call("patch", `/api/appointments/${ap._id}`, {
      time: "11:00",
      durationMinutes: 90,
    }),
    200,
  );
  assert.equal(changed.durationMinutes, 90);
  assert.equal(
    new Date(changed.scheduledEndAt) - new Date(changed.scheduledAt),
    90 * 60000,
  );
  assert.equal(
    (await Operation.findOne({ appointmentId: ap._id })).scheduledTime,
    changed.scheduledAt,
  );
});
test("canceling a booking releases its time without deleting history", async () => {
  const first = await allocation(),
    second = await allocation();
  const ap = expectStatus(await book(first.a), 201).appointment;
  expectStatus(
    await call("patch", `/api/appointments/${ap._id}`, {
      status: "canceled",
      cancellationReason: "Synthetic cancellation",
    }),
    200,
  );
  expectStatus(await book(second.a, { time: "09:15" }), 201);
  assert.equal(await Appointment.countDocuments(), 2);
});
test("completion requires the appointment end to have elapsed", async () => {
  const { a } = await allocation();
  const ap = expectStatus(await book(a), 201).appointment;
  await Appointment.updateOne(
    { _id: ap._id },
    {
      $set: {
        scheduledAt: new Date(Date.now() - 60000),
        scheduledEndAt: new Date(Date.now() + 60000),
      },
    },
  );
  expectStatus(
    await call("patch", `/api/appointments/${ap._id}`, { status: "completed" }),
    409,
  );
});
test("combined terminal-state and time edits are rejected without mutations", async () => {
  const { a } = await allocation();
  const ap = expectStatus(await book(a), 201).appointment;
  expectStatus(
    await call("patch", `/api/appointments/${ap._id}`, {
      status: "canceled",
      time: "11:00",
      cancellationReason: "Test",
    }),
    400,
  );
  assert.equal((await Appointment.findById(ap._id)).status, "scheduled");
});
test("human actions appear under the actual account name in audit history", async () => {
  const { a } = await allocation();
  expectStatus(await book(a), 201);
  const logs = await mongoose
    .model("AuditLog")
    .find({ action: "APPOINTMENT_SCHEDULED", actorId: hospital.id });
  assert.ok(logs.length);
  assert.ok(logs.every((l) => l.actorName === "Scheduling Hospital"));
});

test("legacy time bounds block new bookings until their migration is verified", async () => {
  const first = await allocation(),
    second = await allocation();
  const ap = expectStatus(await book(first.a), 201).appointment;
  await Appointment.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(ap._id) },
    { $unset: { scheduledEndAt: "", surgeonKey: "" } },
  );
  expectStatus(await book(second.a, { time: "12:00" }), 409);
  const { inspectAppointmentSchedule } =
    await import("../services/schedulingAuditService.js");
  const report = await inspectAppointmentSchedule();
  assert.equal(report.invalidIntervals, 1);
  assert.equal(report.overlappingResourceIntervals, null);
});
test("migration audit reports overlaps but never changes appointment history", async () => {
  const first = await allocation(),
    second = await allocation();
  expectStatus(await book(first.a), 201);
  const ap = expectStatus(
    await book(second.a, { time: "11:00" }),
    201,
  ).appointment;
  await Appointment.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(ap._id) },
    {
      $set: {
        scheduledAt: new Date("2030-06-15T04:00:00Z"),
        scheduledEndAt: new Date("2030-06-15T05:00:00Z"),
      },
    },
  );
  const { inspectAppointmentSchedule } =
    await import("../services/schedulingAuditService.js");
  const report = await inspectAppointmentSchedule();
  assert.equal(report.invalidIntervals, 0);
  assert.equal(report.overlappingResourceIntervals, 1);
  assert.equal(await Appointment.countDocuments(), 2);
});
