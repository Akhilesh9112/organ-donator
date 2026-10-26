import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-longer-than-32-characters";
process.env.MAIL_MODE = "disabled";
process.env.UPLOAD_DIR = await fs.mkdtemp(
  path.join(os.tmpdir(), "organsync-records-"),
);
const { default: app } = await import("../app.js");
const { default: User } = await import("../models/User.js");
const { default: MedicalRecord } = await import("../models/MedicalRecord.js");
const { default: OrganRequest } = await import("../models/OrganRequest.js");
const { default: Allocation } = await import("../models/Allocation.js");
const { default: Appointment } = await import("../models/Appointment.js");
const { default: Operation } = await import("../models/Operation.js");
const { default: Pledge } = await import("../models/Pledge.js");
const { default: MatchRecommendation } =
  await import("../models/MatchRecommendation.js");
let db;
const users = {},
  tokens = {};
const password = "TestPass123!";
let pledge, rec, caseId, allocationId, appointmentId;
const api = (method, url, role) => {
  const q = request(app)[method](url);
  return role ? q.auth(tokens[role], { type: "bearer" }) : q;
};
const ok = (r, status) => {
  assert.equal(r.status, status, JSON.stringify(r.body));
  return r.body;
};
function pdf() {
  const text = "BT /F1 12 Tf 50 750 Td (Blood Group: O+) Tj ET";
  const parts = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let s = "%PDF-1.4\n";
  const offsets = [0];
  parts.forEach((p, i) => {
    offsets.push(Buffer.byteLength(s));
    s += `${i + 1} 0 obj\n${p}\nendobj\n`;
  });
  const x = Buffer.byteLength(s);
  s +=
    `xref\n0 6\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(s);
}
before(
  async () => {
    db = await MongoMemoryReplSet.create({
      replSet: { count: 1, args: ["--nounixsocket"] },
      binary: { version: "7.0.24" },
    });
    await mongoose.connect(db.getUri(), { dbName: "regression" });
    for (const m of Object.values(mongoose.models)) await m.init();
    const hash = await bcrypt.hash(password, 10);
    for (const role of [
      "admin",
      "donor",
      "recipient",
      "hospital",
      "outsider",
      "recipient2",
    ]) {
      users[role] = await User.create({
        role:
          role === "outsider"
            ? "hospital"
            : role === "recipient2"
              ? "recipient"
              : role,
        fullName: `Test ${role}`,
        email: `${role}@example.test`,
        phone: "9876543210",
        password: hash,
        bloodGroup: "O+",
        organ: "Kidney",
        donationType: "Living",
        consent: true,
        license:
          role === "hospital" || role === "outsider"
            ? "TEST-LICENSE"
            : undefined,
        verificationState:
          role === "hospital" || role === "outsider" ? "Verified" : "Pending",
      });
      tokens[role] = ok(
        await api("post", "/api/users/login").send({
          email: `${role}@example.test`,
          password,
        }),
        200,
      ).token;
    }
  },
  { timeout: 120000 },
);
after(async () => {
  await mongoose.disconnect();
  if (db) await db.stop();
  await fs.rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
});
test("complete four-role workflow and access boundaries", async (t) => {
  await t.test("health, readiness and unknown endpoints", async () => {
    ok(await api("get", "/api/health"), 200);
    ok(await api("get", "/api/ready"), 200);
    ok(await api("get", "/api/not-here"), 404);
  });
  await t.test("anonymous users cannot list or read profiles", async () => {
    ok(await api("get", "/api/users"), 401);
    ok(await api("get", `/api/users/${users.donor.id}`), 401);
    ok(await api("get", `/api/users/${users.donor.id}`, "recipient"), 403);
  });
  await t.test(
    "registration validates data and preserves licence",
    async () => {
      const input = {
        role: "hospital",
        fullName: "New Hospital",
        email: "new@example.test",
        phone: "9876543210",
        password,
        consent: true,
      };
      ok(await api("post", "/api/users/register").send(input), 400);
      ok(
        await api("post", "/api/users/register").send({
          ...input,
          license: "LIC-1234",
        }),
        201,
      );
      assert.equal(
        (await User.findOne({ email: input.email })).license,
        "LIC-1234",
      );
      ok(
        await api("post", "/api/users/login").send({
          email: { $ne: null },
          password,
        }),
        400,
      );
      ok(
        await api("post", "/api/users/register").send({
          ...input,
          email: "other@example.test",
          role: "admin",
        }),
        400,
      );
    },
  );
  await t.test("unverified hospitals cannot access clinical work", async () => {
    const user = await User.findOne({ email: "new@example.test" });
    const token = ok(
      await api("post", "/api/users/login").send({
        email: user.email,
        password,
      }),
      200,
    ).token;
    ok(
      await request(app)
        .get("/api/medical-records/hospital/pending")
        .auth(token, { type: "bearer" }),
      403,
    );
  });
  await t.test("patients select a verified care hospital", async () => {
    for (const role of ["donor", "recipient", "recipient2"])
      ok(
        await api("patch", "/api/users/me/care-hospital", role).send({
          hospitalId: users.hospital.id,
        }),
        200,
      );
  });
  await t.test("spoofed uploads are rejected and removed", async () => {
    ok(
      await api(
        "post",
        `/api/medical-records/${users.donor.id}/upload`,
        "donor",
      )
        .field("documentType", "Blood Group Report")
        .attach("file", Buffer.from("not a pdf"), {
          filename: "fake.pdf",
          contentType: "application/pdf",
        }),
      400,
    );
    assert.equal((await fs.readdir(process.env.UPLOAD_DIR)).length, 0);
  });
  await t.test(
    "upload, extract and hospital-verify both participants",
    async () => {
      for (const role of ["donor", "recipient", "recipient2"]) {
        const uploaded = ok(
          await api(
            "post",
            `/api/medical-records/${users[role].id}/upload`,
            role,
          )
            .field("documentType", "Blood Group Report")
            .attach("file", pdf(), {
              filename: "synthetic-report.pdf",
              contentType: "application/pdf",
            }),
          201,
        );
        const id = uploaded.record.id;
        const own = await api("get", `/api/medical-records/file/${id}`, role);
        ok(own, 200);
        assert.match(own.headers["content-type"], /application\/pdf/);

        ok(
          await api("get", `/api/medical-records/file/${id}`, "outsider"),
          403,
        );
        ok(
          await api(
            "patch",
            `/api/medical-records/${id}/verify`,
            "outsider",
          ).send({
            status: "Verified",
            bloodGroup: "O+",
            confirmed: true,
            reviewNotes: "Reviewed original",
          }),
          403,
        );
        const analyzed = ok(
          await api("post", `/api/medical-records/${id}/analyze`, role),
          200,
        );
        assert.equal(analyzed.extractedData.bloodGroup, "O+");
        ok(
          await api(
            "patch",
            `/api/medical-records/${id}/verify`,
            "hospital",
          ).send({
            status: "Verified",
            bloodGroup: "O+",
            confirmed: true,
            reviewNotes: "Synthetic evidence reviewed",
          }),
          200,
        );
        ok(await api("post", `/api/medical-records/${id}/analyze`, role), 409);
        ok(await api("delete", `/api/medical-records/${id}`, role), 409);
      }
    },
  );
  await t.test(
    "unassigned hospital cannot list records or recipients",
    async () => {
      assert.equal(
        ok(
          await api(
            "get",
            `/api/medical-records/${users.donor.id}`,
            "outsider",
          ),
          200,
        ).length,
        0,
      );
      assert.equal(
        ok(await api("get", "/api/match/recipients/ready", "outsider"), 200)
          .length,
        0,
      );
    },
  );
  await t.test("donor pledge and concurrent duplicate protection", async () => {
    const responses = await Promise.all(
      [1, 2].map(() =>
        api("post", `/api/pledges/${users.donor.id}`, "donor").send({
          organ: "Kidney",
          donationType: "Living",
        }),
      ),
    );
    assert.equal(responses.filter((r) => r.status === 201).length, 1);
    pledge = responses.find((r) => r.status === 201).body.id;
    assert.equal(
      await Pledge.countDocuments({
        donorId: users.donor.id,
        organ: "Kidney",
        donationType: "Living",
      }),
      1,
    );
  });
  await t.test(
    "hospital screens verified evidence and recommends",
    async () => {
      const ready = ok(
        await api("get", "/api/match/recipients/ready", "hospital"),
        200,
      );
      assert.equal(ready.length, 2);
      const matches = ok(
        await api(
          "get",
          `/api/match/recipient/${users.recipient.id}`,
          "hospital",
        ),
        200,
      );
      assert.equal(matches.matches.length, 1);
      const body = ok(
        await api("post", "/api/match-recommendations", "hospital").send({
          recipientId: users.recipient.id,
          donorId: users.donor.id,
          pledgeId: pledge,
          organ: "Kidney",
          donationType: "Living",
          bloodGroup: "O+",
          dataCompleteness: 100,
        }),
        201,
      );
      rec = body.recommendation._id;
      assert.equal(body.recommendation.dataCompleteness, 0);
    },
  );
  await t.test(
    "recipient cannot skip recommendation or forge its donor",
    async () => {
      ok(
        await api("post", "/api/requests", "recipient").send({
          recipientId: users.recipient.id,
          organ: "Kidney",
          donationType: "Living",
          bloodGroup: "O+",
          pledgeId: pledge,
          donorId: users.donor.id,
        }),
        400,
      );
    },
  );
  await t.test(
    "recipient requests; recommendation and notification commit together",
    async () => {
      const body = ok(
        await api("post", "/api/requests", "recipient").send({
          recipientId: users.recipient.id,
          recommendationId: rec,
          organ: "Kidney",
          donationType: "Living",
          bloodGroup: "O+",
          pledgeId: pledge,
          donorId: users.donor.id,
        }),
        201,
      );
      caseId = body._id;
      assert.equal(
        (await MatchRecommendation.findById(rec)).status,
        "Request Sent",
      );
      ok(
        await api("post", "/api/requests", "recipient").send({
          recipientId: users.recipient.id,
          recommendationId: rec,
          organ: "Kidney",
          donationType: "Living",
          pledgeId: pledge,
          donorId: users.donor.id,
        }),
        409,
      );
      assert.ok(
        ok(await api("get", "/api/notifications", "donor"), 200).notifications
          .length > 0,
      );
    },
  );
  await t.test(
    "donor acceptance is atomic and cannot be repeated",
    async () => {
      const responses = await Promise.all(
        [1, 2].map(() =>
          api("patch", `/api/requests/${caseId}/status`, "donor").send({
            status: "Accepted",
          }),
        ),
      );
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
      assert.equal(
        (await Pledge.findById(pledge)).status,
        "Matched - Donor Accepted",
      );
    },
  );
  await t.test(
    "only assigned hospital can allocate; duplicate allocation denied",
    async () => {
      ok(
        await api("post", "/api/allocations", "outsider").send({
          requestId: caseId,
        }),
        409,
      );
      const responses = await Promise.all(
        [1, 2].map(() =>
          api("post", "/api/allocations", "hospital").send({
            requestId: caseId,
          }),
        ),
      );
      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
      allocationId = responses.find((r) => r.status === 201).body.allocation
        ._id;
    },
  );
  await t.test(
    "scheduling validates dates and requires clinical confirmation",
    async () => {
      const body = {
        allocationId,
        date: "2030-01-15",
        time: "10:00",
        surgeon: "Dr Test",
      };
      ok(
        await api("post", "/api/appointments", "hospital").send({
          ...body,
          date: "2020-01-01",
          clinicalApproval: true,
        }),
        400,
      );
      ok(await api("post", "/api/appointments", "hospital").send(body), 400);
      assert.equal(
        (await Allocation.findById(allocationId)).status,
        "Hospital Review",
      );
      const ap = ok(
        await api("post", "/api/appointments", "hospital").send({
          ...body,
          clinicalApproval: true,
        }),
        201,
      );
      appointmentId = ap.appointment._id;
    },
  );
  await t.test(
    "donor and recipient both see the appointment; outsider cannot mutate it",
    async () => {
      for (const role of ["donor", "recipient"])
        assert.equal(
          ok(
            await api("get", `/api/appointments/user/${users[role].id}`, role),
            200,
          ).length,
          1,
        );
      ok(
        await api(
          "patch",
          `/api/appointments/${appointmentId}`,
          "outsider",
        ).send({ status: "completed" }),
        404,
      );
    },
  );
  await t.test("future appointments cannot be marked complete", async () => {
    ok(
      await api("patch", `/api/appointments/${appointmentId}`, "hospital").send(
        { status: "completed" },
      ),
      409,
    );
  });
  await t.test(
    "completion synchronizes appointment, allocation, request, pledge and operation",
    async () => {
      await Appointment.updateOne(
        { _id: appointmentId },
        {
          $set: {
            scheduledAt: new Date(Date.now() - 7200000),
            scheduledEndAt: new Date(Date.now() - 3600000),
          },
        },
      );
      ok(
        await api(
          "patch",
          `/api/appointments/${appointmentId}`,
          "hospital",
        ).send({ status: "completed" }),
        200,
      );
      assert.equal(
        (await Allocation.findById(allocationId)).status,
        "Completed",
      );
      assert.equal((await OrganRequest.findById(caseId)).status, "Completed");
      assert.equal((await Pledge.findById(pledge)).status, "Completed");
      assert.equal(
        (await Operation.findOne({ appointmentId })).status,
        "Completed",
      );
      ok(
        await api(
          "patch",
          `/api/appointments/${appointmentId}`,
          "hospital",
        ).send({ status: "scheduled" }),
        409,
      );
    },
  );
  await t.test(
    "admin statistics and audit logs work; other roles denied",
    async () => {
      ok(await api("get", "/api/admin/stats", "admin"), 200);
      ok(await api("get", "/api/admin/users", "admin"), 200);
      ok(await api("get", "/api/admin/cases", "admin"), 200);
      assert.ok(
        ok(await api("get", "/api/admin/audit-logs", "admin"), 200).length > 0,
      );
      ok(await api("get", "/api/admin/users", "donor"), 403);
    },
  );
  await t.test("malformed route identifiers return 400", async () => {
    ok(await api("get", "/api/users/not-an-id", "admin"), 400);
    ok(
      await api("patch", "/api/requests/nope/status", "donor").send({
        status: "Accepted",
      }),
      400,
    );
  });
  await t.test("competing requests accept only one donor pledge", async () => {
    const p = await Pledge.create({
      donorId: users.donor.id,
      organ: "Kidney",
      donationType: "Living",
    });
    const qs = await OrganRequest.create(
      ["recipient", "recipient2"].map((role) => ({
        recipientId: users[role].id,
        donorId: users.donor.id,
        pledgeId: p._id,
        hospitalId: users.hospital.id,
        organ: "Kidney",
        donationType: "Living",
        bloodGroup: "O+",
      })),
    );
    const replies = await Promise.all(
      qs.map((q) =>
        api("patch", `/api/requests/${q.id}/status`, "donor").send({
          status: "Accepted",
        }),
      ),
    );
    assert.deepEqual(replies.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      await OrganRequest.countDocuments({ pledgeId: p.id, status: "Accepted" }),
      1,
    );
    assert.equal(
      await OrganRequest.countDocuments({ pledgeId: p.id, status: "Rejected" }),
      1,
    );
    const winner = await OrganRequest.findOne({
      pledgeId: p.id,
      status: "Accepted",
    });
    const al = ok(
      await api("post", "/api/allocations", "hospital").send({
        requestId: winner.id,
      }),
      201,
    ).allocation;
    const ap = ok(
      await api("post", "/api/appointments", "hospital").send({
        allocationId: al._id,
        date: "2030-02-15",
        time: "11:00",
        surgeon: "Dr Second",
        clinicalApproval: true,
      }),
      201,
    ).appointment;
    ok(
      await api("patch", `/api/appointments/${ap._id}`, "hospital").send({
        status: "canceled",
      }),
      400,
    );
    ok(
      await api("patch", `/api/appointments/${ap._id}`, "hospital").send({
        status: "canceled",
        cancellationReason: "Further assessment required",
      }),
      200,
    );
    assert.equal((await Allocation.findById(al._id)).status, "Cancelled");
    assert.equal((await OrganRequest.findById(winner.id)).status, "Cancelled");
    assert.equal((await Pledge.findById(p.id)).status, "Withdrawn");
    assert.equal(
      (await Operation.findOne({ appointmentId: ap._id })).status,
      "Cancelled",
    );
  });
  await t.test(
    "withdrawing a pledge preserves history and closes pending requests",
    async () => {
      const p = await Pledge.create({
        donorId: users.donor.id,
        organ: "Kidney",
        donationType: "Living",
      });
      const q = await OrganRequest.create({
        recipientId: users.recipient2.id,
        donorId: users.donor.id,
        pledgeId: p.id,
        hospitalId: users.hospital.id,
        organ: "Kidney",
        donationType: "Living",
        bloodGroup: "O+",
      });
      ok(
        await api("delete", `/api/pledges/${users.donor.id}/${p.id}`, "donor"),
        200,
      );
      assert.equal((await Pledge.findById(p.id)).status, "Withdrawn");
      assert.equal((await OrganRequest.findById(q.id)).status, "Cancelled");
    },
  );
  await t.test(
    "hospital appointment slot conflicts roll back the entire scheduling action",
    async () => {
      const donor = await User.findById(users.donor.id);
      const ps = await Pledge.create([
        {
          donorId: donor.id,
          organ: "Kidney",
          donationType: "Living",
          status: "Matched - Donor Accepted",
        },
        {
          donorId: donor.id,
          organ: "Liver",
          donationType: "Living",
          status: "Matched - Donor Accepted",
        },
      ]);
      const qs = await OrganRequest.create(
        ps.map((p) => ({
          recipientId: users.recipient2.id,
          donorId: donor.id,
          pledgeId: p.id,
          hospitalId: users.hospital.id,
          organ: p.organ,
          bloodGroup: "O+",
          status: "Hospital Review",
        })),
      );
      const als = await Allocation.create(
        qs.map((q) => ({
          requestId: q.id,
          recipientId: q.recipientId,
          donorId: q.donorId,
          pledgeId: q.pledgeId,
          hospitalId: users.hospital.id,
          organ: q.organ,
        })),
      );
      ok(
        await api("post", "/api/appointments", "hospital").send({
          allocationId: als[0].id,
          date: "2030-05-15",
          time: "09:00",
          surgeon: "Dr Shared",
          clinicalApproval: true,
        }),
        201,
      );
      ok(
        await api("post", "/api/appointments", "hospital").send({
          allocationId: als[1].id,
          date: "2030-05-15",
          time: "09:00",
          surgeon: "Dr Shared",
          clinicalApproval: true,
        }),
        409,
      );
      assert.equal(
        (await Allocation.findById(als[1].id)).status,
        "Hospital Review",
      );
    },
  );
  await t.test(
    "suspending an account immediately revokes access; archive preserves the account",
    async () => {
      ok(
        await api(
          "patch",
          `/api/admin/users/${users.recipient2.id}/status`,
          "admin",
        ).send({ status: "Suspended" }),
        200,
      );
      ok(await api("get", "/api/users/me", "recipient2"), 401);
      ok(
        await api("delete", `/api/admin/users/${users.recipient2.id}`, "admin"),
        409,
      );
      ok(
        await api("delete", `/api/admin/users/${users.outsider.id}`, "admin"),
        200,
      );
      assert.ok((await User.findById(users.outsider.id)).deletedAt);
    },
  );
  await t.test(
    "deceased pledges are future intent and cannot enter living-donor screening",
    async () => {
      ok(
        await api("post", `/api/pledges/${users.donor.id}`, "donor").send({
          organ: "Heart",
          donationType: "Living",
        }),
        400,
      );
      const p = ok(
        await api("post", `/api/pledges/${users.donor.id}`, "donor").send({
          organ: "Heart",
          donationType: "Deceased pledge",
        }),
        201,
      );
      await User.updateOne(
        { _id: users.recipient.id },
        { $set: { organ: "Heart" } },
      );
      const screening = ok(
        await api(
          "get",
          `/api/match/recipient/${users.recipient.id}`,
          "hospital",
        ),
        200,
      );
      assert.equal(screening.matches.length, 0);
      ok(
        await api("post", "/api/match-recommendations", "hospital").send({
          recipientId: users.recipient.id,
          donorId: users.donor.id,
          pledgeId: p.id,
          organ: "Heart",
          bloodGroup: "O+",
        }),
        400,
      );
    },
  );
  await t.test(
    "a donor can withdraw consent after scheduling and all linked records close",
    async () => {
      const active = await OrganRequest.findOne({
        donorId: users.donor.id,
        status: "Scheduled",
      });
      assert.ok(active);
      ok(
        await api("patch", `/api/requests/${active.id}/withdraw`, "donor").send(
          { withdrawalReason: "Consent withdrawn by donor" },
        ),
        200,
      );
      assert.equal(
        (await OrganRequest.findById(active.id)).status,
        "Cancelled",
      );
      assert.equal(
        (await Pledge.findById(active.pledgeId)).status,
        "Withdrawn",
      );
      assert.equal(
        (await Appointment.findOne({ requestId: active.id })).status,
        "canceled",
      );
    },
  );
  await t.test(
    "workflow emails use a durable outbox; SMTP failure retries without breaking care",
    async () => {
      const { default: Outbox } = await import("../models/EmailOutbox.js");
      const { default: Notification } =
        await import("../models/Notification.js");
      const { deliverNextEmail } = await import("../services/outboxService.js");
      assert.ok((await Outbox.countDocuments()) > 0);
      await Outbox.updateMany({}, { $set: { status: "Skipped" } });
      const notice = await Notification.create({
        userId: users.donor.id,
        title: "Test update",
        message: "Synthetic update",
      });
      const job = await Outbox.create({
        notificationId: notice.id,
        userId: users.donor.id,
      });
      process.env.MAIL_MODE = "smtp";
      delete process.env.MAIL_USER;
      delete process.env.MAIL_PASS;
      for (let i = 0; i < 5; i++) {
        await Outbox.updateOne(
          { _id: job.id },
          { $set: { nextAttemptAt: new Date(0) } },
        );
        assert.equal(await deliverNextEmail(), true);
      }
      assert.equal((await Outbox.findById(job.id)).status, "Failed");
      ok(await api("get", "/api/admin/delivery", "admin"), 200);
      ok(
        await api("post", `/api/admin/delivery/${job.id}/retry`, "admin").send(
          {},
        ),
        200,
      );
      process.env.MAIL_MODE = "disabled";
      await deliverNextEmail();
      assert.equal((await Outbox.findById(job.id)).status, "Skipped");
    },
  );
  await t.test(
    "password reset revokes existing sessions and is single-use",
    async () => {
      const crypto = await import("node:crypto");
      const token = "a".repeat(64);
      await User.updateOne(
        { _id: users.recipient.id },
        {
          $set: {
            resetPasswordToken: crypto
              .createHash("sha256")
              .update(token)
              .digest("hex"),
            resetPasswordExpires: new Date(Date.now() + 60000),
          },
        },
      );
      const responses = await Promise.all(
        [1, 2].map(() =>
          api("post", `/api/users/reset-password/${token}`).send({
            password: "NewTest123!",
          }),
        ),
      );
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 400]);
      ok(await api("get", "/api/users/me", "recipient"), 401);
      ok(
        await api("post", `/api/users/reset-password/${token}`).send({
          password: "NewTest123!",
        }),
        400,
      );
    },
  );
});
