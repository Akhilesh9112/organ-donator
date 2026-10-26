import EmailOutbox from "../models/EmailOutbox.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendEmail } from "./mailService.js";
export async function enqueueEmails(notifications, session) {
  if (!notifications.length) return;
  await EmailOutbox.create(
    notifications.map((n) => ({ notificationId: n._id, userId: n.userId })),
    { session, ordered: true },
  );
}
export async function deliverNextEmail() {
  const now = new Date();
  const job = await EmailOutbox.findOneAndUpdate(
    {
      $or: [
        { status: "Pending", nextAttemptAt: { $lte: now } },
        { status: "Sending", lockedUntil: { $lt: now } },
      ],
    },
    {
      $set: { status: "Sending", lockedUntil: new Date(Date.now() + 60000) },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after", sort: { createdAt: 1 } },
  );
  if (!job) return false;
  try {
    const user = await User.findById(job.userId),
      notice = await Notification.findById(job.notificationId);
    if (
      !user ||
      !notice ||
      user.deletedAt ||
      user.accountStatus !== "Active" ||
      process.env.MAIL_MODE === "disabled"
    )
      job.status = "Skipped";
    else {
      await sendEmail({
        to: user.email,
        subject: "OrganSync: a care update is waiting",
        html: "<p>You have a new care update in OrganSync. Sign in to your care workspace to review it.</p>",
      });
      job.status = "Sent";
      job.sentAt = new Date();
    }
  } catch {
    job.status = job.attempts >= 5 ? "Failed" : "Pending";
    job.nextAttemptAt = new Date(
      Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts),
    );
  }
  job.lockedUntil = null;
  await job.save();
  return true;
}
export function startEmailWorker() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      for (let i = 0; i < 10; i++) {
        if (!(await deliverNextEmail())) break;
      }
    } catch {
      console.error("Email worker failed; jobs remain recoverable");
    } finally {
      running = false;
    }
  }, 5000);
  timer.unref();
  return () => clearInterval(timer);
}
