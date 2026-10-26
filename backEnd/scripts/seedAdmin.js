import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/User.js";
const {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_NAME = "Administrator",
  ADMIN_PHONE,
} = process.env;
if (
  !ADMIN_EMAIL ||
  !ADMIN_PHONE ||
  !/^[6-9]\d{9}$/.test(ADMIN_PHONE) ||
  !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(
    ADMIN_PASSWORD || "",
  ) ||
  Buffer.byteLength(ADMIN_PASSWORD, "utf8") > 72
)
  throw new Error(
    "Set ADMIN_EMAIL, ADMIN_PHONE and a strong ADMIN_PASSWORD of at least 12 characters",
  );
await mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DATABASE,
});
try {
  if (await User.exists({ email: ADMIN_EMAIL.trim().toLowerCase() }))
    throw new Error("Account already exists; no changes made");
  await User.create({
    role: "admin",
    fullName: ADMIN_NAME,
    phone: ADMIN_PHONE,
    email: ADMIN_EMAIL.trim().toLowerCase(),
    password: await bcrypt.hash(ADMIN_PASSWORD, 12),
    consent: true,
  });
  console.log("Administrator created");
} finally {
  await mongoose.disconnect();
}
