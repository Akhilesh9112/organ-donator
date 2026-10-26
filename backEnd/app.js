import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { validateRequest, safeErrors } from "./middleware/validation.js";
import cors from "cors";

import userRoutes from "./routes/userRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import medicalRecordRoutes from "./routes/medicalRecordRoutes.js";
import requestRoutes from "./routes/requestRoutes.js";
import pledgeRoutes from "./routes/pledgeRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import hospitalRoutes from "./routes/hospitalRoutes.js";
import allocationRoutes from "./routes/allocationRoutes.js";
import matchRecommendationRoutes from "./routes/matchRecommendationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import auditLogRoutes from "./routes/auditLogRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

const app = express();

app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = (
        process.env.FRONTEND_URL || "http://localhost:3000"
      ).split(",");
      cb(null, !origin || allowed.includes(origin));
    },
  }),
);
app.use(express.json({ limit: "64kb" }));
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(validateRequest);
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 1000 : 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
["login", "register", "forgot-password", "reset-password"].forEach((path) =>
  app.use(`/api/users/${path}`, authLimit),
);
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.get("/api/ready", (req, res) =>
  res
    .status(mongoose.connection.readyState === 1 ? 200 : 503)
    .json({
      status: mongoose.connection.readyState === 1 ? "ready" : "unavailable",
    }),
);

// Matching
app.use("/api", matchRoutes);
// Admin
app.use("/api", adminRoutes);

// Audit Logs
app.use("/api", auditLogRoutes);

// Hospital
app.use("/api/hospitals", hospitalRoutes);

// Allocation
app.use("/api", allocationRoutes);

// Users
app.use("/api/users", userRoutes);

// Appointments
app.use("/api/appointments", appointmentRoutes);

// Medical records
app.use("/api/medical-records", medicalRecordRoutes);
// Match Recommendations

app.use("/api", matchRecommendationRoutes);

// Requests
app.use("/api", requestRoutes);

// Pledges
app.use("/api", pledgeRoutes);

// Notifications
app.use("/api/notifications", notificationRoutes);

app.use((req, res) => res.status(404).json({ message: "Endpoint not found" }));
app.use(safeErrors);
export default app;
