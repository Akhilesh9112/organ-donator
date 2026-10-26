import nodemailer from "nodemailer";
// Disabled mode is only for local development/test; never logs message bodies or reset tokens.
export async function sendEmail({ to, subject, html }) {
  if (
    process.env.MAIL_MODE === "disabled" &&
    process.env.NODE_ENV !== "production"
  )
    return { skipped: true };
  if (!to || !process.env.MAIL_USER || !process.env.MAIL_PASS)
    throw new Error("Email delivery is not configured");
  const transport = nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.MAIL_PORT || 465),
    secure: process.env.MAIL_SECURE !== "false",
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  return transport.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to,
    subject,
    html,
  });
}
export function notifyEmail(message) {
  return sendEmail(message).catch(() =>
    console.error("Email delivery failed; review delivery configuration"),
  );
}
