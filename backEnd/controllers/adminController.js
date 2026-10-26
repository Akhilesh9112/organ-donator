import MedicalRecord from "../models/MedicalRecord.js";
import User from "../models/User.js";
import Pledge from "../models/Pledge.js";
import OrganRequest from "../models/OrganRequest.js";
import Allocation from "../models/Allocation.js";
import Appointment from "../models/Appointment.js";
import Operation from "../models/Operation.js";
import bcrypt from "bcrypt";

import { createAuditLog } from "./auditLogController.js";

// =====================================================
// ADMIN DASHBOARD STATS
// GET /api/admin/stats
// =====================================================

export const getAdminStats = async (req, res) => {
  try {
    const [
      totalUsers,
      donors,
      recipients,
      hospitals,
      pendingHospitals,
      activePledges,
      pendingRequests,
      acceptedRequests,
      allocations,
      appointments,
      operations,
    ] = await Promise.all([
      User.countDocuments(),

      User.countDocuments({
        role: "donor",
      }),

      User.countDocuments({
        role: "recipient",
      }),

      User.countDocuments({
        role: "hospital",
        deletedAt: null,
      }),

      User.countDocuments({
        role: "hospital",
        verificationState: "Pending",
      }),

      Pledge.countDocuments({
        status: "Active & Pledged",
      }),

      OrganRequest.countDocuments({
        status: "Pending",
      }),

      OrganRequest.countDocuments({
        status: {
          $in: ["Accepted", "Hospital Review", "Scheduled"],
        },
      }),

      Allocation.countDocuments(),

      Appointment.countDocuments(),

      Operation.countDocuments(),
    ]);

    return res.status(200).json({
      totalUsers,
      donors,
      recipients,
      hospitals,
      pendingHospitals,
      activePledges,
      pendingRequests,
      acceptedCases: acceptedRequests,
      allocations,
      appointments,
      operations,
    });
  } catch (error) {
    console.error("Admin stats error:", error);

    return res.status(500).json({
      message: "Unable to load admin dashboard statistics",
    });
  }
};

// =====================================================
// ADMIN CREATE USER
// POST /api/admin/users
// =====================================================

export const createAdminUser = async (req, res) => {
  try {
    const {
      role,
      fullName,
      phone,
      email,
      password,
      bloodGroup,
      organ,
      license,
    } = req.body;

    const allowedRoles = ["donor", "recipient", "hospital"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Admin can create donor, recipient or hospital accounts only",
      });
    }

    if (!fullName || !phone || !email || !password) {
      return res.status(400).json({
        message: "Name, phone, email and password are required",
      });
    }

    if ((role === "donor" || role === "recipient") && !bloodGroup) {
      return res.status(400).json({
        message: "Blood group is required",
      });
    }

    if (role === "recipient" && !organ) {
      return res.status(400).json({
        message: "Required organ is required",
      });
    }

    if (role === "hospital" && !license) {
      return res.status(400).json({
        message: "Hospital license is required",
      });
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      !/^[6-9]\d{9}$/.test(phone.trim()) ||
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(
        password,
      ) ||
      Buffer.byteLength(password, "utf8") > 72 ||
      fullName.trim().length < 2
    )
      return res
        .status(400)
        .json({
          message:
            "Provide a valid name, email, Indian phone number and strong password",
        });
    if (req.body.consent !== true)
      return res
        .status(400)
        .json({ message: "Confirm consent before creating an account" });
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      role,

      fullName: fullName.trim(),

      phone: phone.trim(),

      email: normalizedEmail,

      password: hashedPassword,

      bloodGroup:
        role === "donor" || role === "recipient" ? bloodGroup : undefined,

      organ: role === "recipient" ? organ : undefined,

      license: role === "hospital" ? license : undefined,

      consent: true,

      accountStatus: "Active",

      verificationState: "Pending",
    });

    // ==============================
    // AUDIT LOG
    // ==============================

    await createAuditLog({
      actorId: req.user?._id || null,
      actorName: req.user?.fullName || "Administrator",
      actorRole: req.user?.role || "admin",

      action: "USER_CREATED",

      entityType: "User",
      entityId: newUser._id,
      entityName: newUser.fullName,

      message: `${newUser.fullName} account was created`,

      metadata: {
        role: newUser.role,
        email: newUser.email,
      },
    });

    const safeUser = newUser.toObject();

    delete safeUser.password;

    return res.status(201).json({
      message: "User created successfully",

      user: safeUser,
    });
  } catch (error) {
    console.error("Admin Create User Error:", error);

    return res.status(500).json({
      message: error.message || "Unable to create user",
    });
  }
};

// =====================================================
// ADMIN DELETE USER
// DELETE /api/admin/users/:userId
// =====================================================

export const deleteAdminUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if ((user.role || "").toLowerCase() === "admin") {
      return res.status(403).json({
        message: "Admin accounts cannot be deleted from this panel",
      });
    }

    // Save user information before deletion
    const deletedUser = {
      id: user._id,

      fullName: user.fullName,

      email: user.email,

      role: user.role,
    };

    const active = await OrganRequest.exists({
      $or: [
        { recipientId: userId },
        { donorId: userId },
        { hospitalId: userId },
      ],
      status: { $in: ["Pending", "Accepted", "Hospital Review", "Scheduled"] },
    });
    if (
      user.role === "hospital" &&
      (await MedicalRecord.exists({ hospitalId: userId }))
    )
      return res
        .status(409)
        .json({
          message:
            "Transfer or resolve retained clinical records before archiving this hospital",
        });
    if (active)
      return res
        .status(409)
        .json({
          message: "Resolve active cases before archiving this account",
        });
    user.deletedAt = new Date();
    user.accountStatus = "Suspended";
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();

    // ==============================
    // AUDIT LOG
    // ==============================

    await createAuditLog({
      actorId: req.user?._id || null,
      actorName: req.user?.fullName || "Administrator",
      actorRole: req.user?.role || "admin",

      action: "USER_DELETED",

      entityType: "User",
      entityId: deletedUser.id,
      entityName: deletedUser.fullName,

      message: `${deletedUser.fullName} account was deleted`,

      metadata: {
        role: deletedUser.role,
        email: deletedUser.email,
      },
    });

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Admin Delete User Error:", error);

    return res.status(500).json({
      message: "Unable to delete user",
    });
  }
};

// =====================================================
// ALL USERS
// GET /api/admin/users
// =====================================================

export const getAdminUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({
      createdAt: -1,
    });

    return res.status(200).json(users);
  } catch (error) {
    console.error("Admin users error:", error);

    return res.status(500).json({
      message: "Unable to load users",
    });
  }
};

// =====================================================
// UPDATE USER ACCOUNT STATUS
// PATCH /api/admin/users/:userId/status
// =====================================================

export const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const { status } = req.body;

    if (!["Active", "Suspended"].includes(status)) {
      return res.status(400).json({
        message: "Invalid account status",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if ((user.role || "").toLowerCase() === "admin") {
      return res.status(400).json({
        message: "Admin accounts cannot be suspended from this panel",
      });
    }

    user.accountStatus = status;
    user.sessionVersion = (user.sessionVersion || 0) + 1;

    await user.save();

    // ==============================
    // AUDIT LOG
    // ==============================

    await createAuditLog({
      actorId: req.user?._id || null,
      actorName: req.user?.fullName || "Administrator",
      actorRole: req.user?.role || "admin",

      action: status === "Suspended" ? "USER_SUSPENDED" : "USER_ACTIVATED",

      entityType: "User",
      entityId: user._id,
      entityName: user.fullName,

      message: `${user.fullName} account was ${status.toLowerCase()}`,

      metadata: {
        accountStatus: status,
        role: user.role,
      },
    });

    return res.status(200).json({
      message: `User account changed to ${status}`,

      user: {
        id: user._id,

        fullName: user.fullName,

        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    console.error("Update user status error:", error);

    return res.status(500).json({
      message: "Unable to update account status",
    });
  }
};

// =====================================================
// ADMIN HOSPITAL LIST
// GET /api/admin/hospitals
// =====================================================

export const getAdminHospitals = async (req, res) => {
  try {
    const hospitals = await User.find({
      role: "hospital",
      deletedAt: null,
    })
      .select("-password")
      .sort({
        createdAt: -1,
      });

    const result = hospitals.map((hospital) => ({
      id: hospital._id,

      fullName: hospital.fullName,

      email: hospital.email,

      phone: hospital.phone,

      license: hospital.license || "",

      verificationState: hospital.verificationState || "Pending",

      accountStatus: hospital.accountStatus || "Active",

      createdAt: hospital.createdAt,
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error("Admin hospital list error:", error);

    return res.status(500).json({
      message: "Unable to load hospitals",
    });
  }
};

// =====================================================
// VERIFY / REJECT HOSPITAL
// PATCH /api/admin/hospitals/:hospitalId/verification
// =====================================================

export const updateHospitalVerification = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    const { status } = req.body;

    if (!["Verified", "Rejected"].includes(status)) {
      return res.status(400).json({
        message: "Verification status must be Verified or Rejected",
      });
    }

    const hospital = await User.findOne({
      _id: hospitalId,

      role: "hospital",
    });

    if (!hospital) {
      return res.status(404).json({
        message: "Hospital not found",
      });
    }

    if (status === "Verified" && !hospital.license)
      return res.status(409).json({ message: "Hospital licence is required" });
    hospital.verificationState = status;

    await hospital.save();

    // ==============================
    // AUDIT LOG
    // ==============================
    await createAuditLog({
      actorId: req.user?._id || null,
      actorName: req.user?.fullName || "Administrator",
      actorRole: req.user?.role || "admin",

      action: status === "Verified" ? "HOSPITAL_VERIFIED" : "HOSPITAL_REJECTED",

      entityType: "Hospital",
      entityId: hospital._id,
      entityName: hospital.fullName,

      message:
        status === "Verified"
          ? `${hospital.fullName} was verified`
          : `${hospital.fullName} verification was rejected`,

      metadata: {
        verificationState: status,
        email: hospital.email,
      },
    });

    return res.status(200).json({
      message: `Hospital ${status}`,

      hospital: {
        id: hospital._id,

        fullName: hospital.fullName,

        verificationState: hospital.verificationState,
      },
    });
  } catch (error) {
    console.error("Hospital verification error:", error);

    return res.status(500).json({
      message: "Unable to update hospital verification",
    });
  }
};

// =====================================================
// ADMIN TRANSPLANT CASES
// GET /api/admin/cases
// =====================================================

export const getAdminCases = async (req, res) => {
  try {
    const requests = await OrganRequest.find()

      .populate("recipientId", "fullName email bloodGroup organ")

      .populate("donorId", "fullName email bloodGroup")

      .populate("pledgeId", "organ status")

      .sort({
        createdAt: -1,
      });

    const cases = requests.map((request) => ({
      id: request._id,

      recipientId: request.recipientId?._id,

      recipientName: request.recipientId?.fullName || "Unknown Recipient",

      donorId: request.donorId?._id,

      donorName: request.donorId?.fullName || "Unknown Donor",

      organ: request.organ || request.pledgeId?.organ || "—",

      bloodGroup: request.bloodGroup || request.recipientId?.bloodGroup || "—",

      hospital: request.hospital || "Not assigned",

      status: request.status || "Pending",

      createdAt: request.createdAt,
    }));

    return res.status(200).json(cases);
  } catch (error) {
    console.error("Admin cases error:", error);

    return res.status(500).json({
      message: "Unable to load transplant cases",
    });
  }
};
