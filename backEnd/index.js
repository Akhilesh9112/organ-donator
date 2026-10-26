import "dotenv/config";
import mongoose from "mongoose";
import { startEmailWorker } from "./services/outboxService.js";
import app from "./app.js";
import connectDB from "./config/db.js";
if (
  !process.env.MONGO_URI ||
  !process.env.JWT_SECRET ||
  (process.env.JWT_SECRET.length < 32 || /replace-with|change-me/i.test(process.env.JWT_SECRET))
) {
  throw new Error(
    "MONGO_URI and JWT_SECRET (at least 32 characters) are required",
  );
}
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.FRONTEND_URL?.startsWith("https://") ||
    process.env.MAIL_MODE !== "smtp" || !process.env.MAIL_USER || !process.env.MAIL_PASS)
) {
  throw new Error("Production requires HTTPS FRONTEND_URL and MAIL_MODE=smtp");
}
await connectDB();
const stopEmailWorker = startEmailWorker();
const server = app.listen(process.env.PORT || 8080, () =>
  console.log("OrganSync API started"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopEmailWorker();
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
