import jwt from "jsonwebtoken";
import User from "../models/User.js";

// ==========================================
// VERIFY LOGGED-IN USER
// ==========================================
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Authentication token missing",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-password");

    if (
      !user ||
      user.deletedAt ||
      (decoded.sessionVersion || 0) !== (user.sessionVersion || 0)
    ) {
      return res.status(401).json({
        message: "User account no longer exists",
      });
    }

    if ((user.accountStatus || "Active") === "Suspended") {
      return res.status(403).json({
        message: "Your account has been suspended",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("Authentication Error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Session expired. Please login again.",
      });
    }

    return res.status(401).json({
      message: "Invalid authentication token",
    });
  }
};

// ==========================================
// ADMIN ONLY
// ==========================================
export const adminOnly = (req, res, next) => {
  if (!req.user || String(req.user.role).toLowerCase() !== "admin") {
    return res.status(403).json({
      message: "Administrator access required",
    });
  }

  next();
};

// ==========================================
// ALLOW SPECIFIC ROLES
// ==========================================
export const allowRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const role = String(req.user.role || "").toLowerCase();

    const normalizedRoles = allowedRoles.map((r) => String(r).toLowerCase());

    if (!normalizedRoles.includes(role)) {
      return res.status(403).json({
        message: "You are not authorized to perform this action",
      });
    }

    next();
  };
};

// ==========================================
// USER MUST MATCH URL PARAM
// Admin may optionally bypass
//
// Example:
// sameUserOrRole("userId", "admin")
// ==========================================
export const sameUserOrRole =
  (paramName, ...bypassRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const loggedInId = String(req.user._id);

    const requestedId = String(req.params[paramName] || "");

    const role = String(req.user.role || "").toLowerCase();

    const allowedBypass = bypassRoles
      .map((r) => String(r).toLowerCase())
      .includes(role);

    if (loggedInId !== requestedId && !allowedBypass) {
      return res.status(403).json({
        message: "You cannot access another user's data",
      });
    }

    next();
  };

// ==========================================
// VERIFIED HOSPITAL ONLY
// ==========================================
export const verifiedHospitalOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  if (String(req.user.role).toLowerCase() !== "hospital") {
    return res.status(403).json({
      message: "Hospital access required",
    });
  }

  if (req.user.verificationState !== "Verified") {
    return res.status(403).json({
      message: "Hospital verification is required",
    });
  }

  next();
};
