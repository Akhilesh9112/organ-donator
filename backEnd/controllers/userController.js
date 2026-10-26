import MedicalRecord from "../models/MedicalRecord.js";
import User from "../models/User.js";
import bcrypt from "bcrypt";
import Pledge from "../models/Pledge.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendEmail } from "../services/mailService.js";
import { asyncRoute, fail } from "../middleware/validation.js";
import OrganRequest from "../models/OrganRequest.js";
// ==========================================
// GET ALL USERS
// ==========================================
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({
      error: "Unable to complete the request",
    });
  }
};

// ==========================================
// CREATE USER / REGISTER
// ==========================================

export const createUser = async (req, res) => {
  try {
    const {
      role,
      fullName,
      phone,
      email,
      password,
      bloodGroup,
      organ,
      consent,
      license,
    } = req.body;

    // ========================================
    // NORMALIZE INPUT
    // ========================================

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    const normalizedPhone = String(phone || "")
      .replace(/\s+/g, "")
      .replace(/^\+91/, "");

    const normalizedRole = String(role || "")
      .trim()
      .toLowerCase();

    const normalizedName = String(fullName || "").trim();

    // ========================================
    // REQUIRED FIELDS
    // ========================================

    if (!normalizedName) {
      return res.status(400).json({
        message: "Full name is required",
      });
    }

    if (!normalizedEmail) {
      return res.status(400).json({
        message: "Email address is required",
      });
    }

    if (!normalizedPhone) {
      return res.status(400).json({
        message: "Phone number is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        message: "Password is required",
      });
    }

    // ========================================
    // ROLE VALIDATION
    // ========================================

    const allowedRoles = ["donor", "recipient", "hospital"];

    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        message: "Please select a valid account role",
      });
    }

    // ========================================
    // EMAIL VALIDATION
    // ========================================

    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address",
      });
    }

    // ========================================
    // INDIAN MOBILE NUMBER VALIDATION
    // ========================================

    const PHONE_PATTERN = /^[6-9]\d{9}$/;

    if (!PHONE_PATTERN.test(normalizedPhone)) {
      return res.status(400).json({
        message: "Enter a valid 10-digit Indian mobile number",
      });
    }

    // ========================================
    // PASSWORD VALIDATION
    // ========================================

    const PASSWORD_PATTERN =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!PASSWORD_PATTERN.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number and special character",
      });
    }

    // ========================================
    // DONOR / RECIPIENT VALIDATION
    // ========================================

    if (normalizedRole === "donor" || normalizedRole === "recipient") {
      if (!bloodGroup) {
        return res.status(400).json({
          message: "Please select your blood group",
        });
      }

      if (!organ) {
        return res.status(400).json({
          message:
            normalizedRole === "donor"
              ? "Please select an organ to pledge"
              : "Please select the required organ",
        });
      }
    }

    // ========================================
    // CONSENT VALIDATION
    // ========================================

    if (consent !== true) {
      return res.status(400).json({
        message: "You must accept the consent agreement",
      });
    }

    // ========================================
    // CHECK EXISTING EMAIL
    // ========================================

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account already exists with this email",
      });
    }

    // ========================================
    // HASH PASSWORD
    // ========================================

    if (
      normalizedRole === "hospital" &&
      (typeof license !== "string" || license.trim().length < 4)
    )
      return res
        .status(400)
        .json({ message: "A valid hospital licence is required" });
    if (Buffer.byteLength(password, "utf8") > 72)
      return res
        .status(400)
        .json({ message: "Password must be at most 72 UTF-8 bytes" });
    const hashedPassword = await bcrypt.hash(password, 10);

    // ========================================
    // CREATE USER
    // ========================================

    const user = await User.create({
      role: normalizedRole,

      fullName: normalizedName,

      phone: normalizedPhone,

      email: normalizedEmail,

      password: hashedPassword,

      bloodGroup: normalizedRole === "hospital" ? "" : bloodGroup,

      organ: normalizedRole === "hospital" ? "" : organ,

      consent: true,
      license: normalizedRole === "hospital" ? license.trim() : undefined,
    });

    // ========================================
    // SUCCESS RESPONSE
    // ========================================

    return res.status(201).json({
      message: "Registration successful",

      user: {
        id: user._id,
        role: user.role,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        bloodGroup: user.bloodGroup,
        organ: user.organ,
        consent: user.consent,
      },
    });
  } catch (error) {
    console.error("Registration Error:", error);

    return res.status(error.code === 11000 ? 409 : 500).json({
      message:
        error.code === 11000
          ? "Email already registered"
          : "Registration failed",
    });
  }
};

const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    // Prevent account enumeration.
    const successMessage =
      "If an account exists for this email, a reset link has been sent.";

    if (!user || user.deletedAt) {
      return res.status(200).json({
        message: successMessage,
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);

    await user.save({
      validateBeforeSave: false,
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    const resetUrl = `${frontendUrl}/?page=reset-password&token=${resetToken}`;

    await sendEmail({
      from: `"OrganSync" <${process.env.MAIL_USER}>`,
      to: user.email,
      subject: "Reset your OrganSync password",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2 style="color:#0f2d63">Reset your password</h2>
          <p>Hello ${String(user.fullName || "User").replace(/[&<>"']/g, "")},</p>
          <p>Use the button below to reset your OrganSync password.</p>
          <p>
            <a
              href="${resetUrl}"
              style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px"
            >
              Reset Password
            </a>
          </p>
          <p>This link expires in 15 minutes.</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({
      message: successMessage,
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);

    return res
      .status(200)
      .json({
        message:
          "If an account exists for this email, a reset link has been sent.",
      });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        message: "New password is required",
      });
    }

    if (!PASSWORD_PATTERN.test(password)) {
      return res.status(400).json({
        message:
          "Password must have at least 8 characters, uppercase, lowercase, number and special character",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    if (Buffer.byteLength(password, "utf8") > 72)
      return res
        .status(400)
        .json({ message: "Password must be at most 72 UTF-8 bytes" });
    const user = await User.findOneAndUpdate(
      {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: new Date() },
        deletedAt: null,
      },
      {
        $set: {
          password: await bcrypt.hash(password, 10),
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
        $inc: { sessionVersion: 1 },
      },
      { returnDocument: "after" },
    );
    if (!user)
      return res
        .status(400)
        .json({
          message: "This password-reset link is invalid or has expired",
        });

    return res.status(200).json({
      message: "Password changed successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);

    return res.status(500).json({
      message: "Unable to reset password",
    });
  }
};

// ==========================================
// LOGIN
// ==========================================
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user || user.deletedAt) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if ((user.accountStatus || "Active") === "Suspended") {
      return res.status(403).json({
        message:
          "Your account has been suspended. Please contact the administrator.",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing from .env");

      return res.status(500).json({
        message: "Authentication configuration error",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
        sessionVersion: user.sessionVersion || 0,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      },
    );

    return res.status(200).json({
      message: "Login successful",

      userId: user._id,
      fullName: user.fullName,
      role: user.role,
      email: user.email,
      phone: user.phone,
      bloodGroup: user.bloodGroup,
      organ: user.organ,

      accountStatus: user.accountStatus || "Active",

      verificationState: user.verificationState || "Pending",

      token,
    });
  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      message: "Unable to login",
    });
  }
};

// ==========================================
// GET USER BY ID
// ==========================================
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      error: "Unable to complete the request",
    });
  }
};

// ==========================================
// FIND COMPATIBLE DONOR FROM PLEDGES
// ==========================================
export const findCompatibleDonor = async (req, res) => {
  try {
    const { organ, bloodGroup } = req.query;

    console.log("Matching Request:", {
      organ,
      bloodGroup,
    });

    if (!organ || !bloodGroup) {
      return res.status(400).json({
        message: "Organ and blood group are required",
      });
    }

    // Search ACTUAL active donor pledges
    const pledges = await Pledge.find({
      organ: organ,
      status: "Active & Pledged",
    }).populate("donorId", "fullName email phone bloodGroup role");

    console.log("Active pledges found:", pledges.length);

    const matchedPledge = pledges.find(
      (pledge) =>
        pledge.donorId &&
        pledge.donorId.role === "donor" &&
        pledge.donorId.bloodGroup === bloodGroup,
    );

    if (!matchedPledge) {
      return res.status(200).json({
        matched: false,
        message: `No donor currently available for ${organ} with blood group ${bloodGroup}.`,
      });
    }

    const donor = matchedPledge.donorId;

    return res.status(200).json({
      matched: true,

      message: "Compatible active donor pledge found",

      organ: matchedPledge.organ,

      bloodGroup: donor.bloodGroup,

      donorId: donor._id,

      pledgeId: matchedPledge._id,

      donorName: donor.fullName,

      hospital: "Assigned Hospital",

      // No fake compatibility percentage
    });
  } catch (error) {
    console.error("Matching Error:", error);

    res.status(500).json({
      message: "Unable to complete the request",
    });
  }
};
export const assignCareHospital = asyncRoute(async (req, res) => {
  const { hospitalId } = req.body;
  const hospital = await User.findOne({
    _id: hospitalId,
    role: "hospital",
    verificationState: "Verified",
    accountStatus: "Active",
    deletedAt: null,
  });
  if (!hospital) fail(400, "Choose a verified hospital");
  if (
    req.user.careHospitalId &&
    String(req.user.careHospitalId) !== hospitalId
  ) {
    const active = await OrganRequest.exists({
      $or: [{ recipientId: req.user._id }, { donorId: req.user._id }],
      status: { $in: ["Pending", "Accepted", "Hospital Review", "Scheduled"] },
    });
    if (active || (await MedicalRecord.exists({ user: req.user._id })))
      fail(409, "Contact your coordinator to transfer an active case");
  }
  req.user.careHospitalId = hospitalId;
  await req.user.save();
  res.json({ message: "Care hospital selected", hospitalId });
});
