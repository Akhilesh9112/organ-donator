import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

// ==========================================
// CREATE AUDIT LOG
// Internal helper
// ==========================================
export const createAuditLog = async ({
  actorId = null,
  actorName = "System",
  actorRole = "system",
  action,
  entityType,
  entityId = null,
  entityName = "",
  message,
  metadata = {},
}) => {
  try {
    if (actorId && actorName === "System") {
      const actor = await User.findById(actorId).select("fullName").lean();
      actorName = actor?.fullName || "Archived account";
    }
    await AuditLog.create({
      actorId,
      actorName,
      actorRole,
      action,
      entityType,
      entityId,
      entityName,
      message,
      metadata,
    });
  } catch (error) {
    // Audit failure should not break
    // the original application action
    console.error("Create Audit Log Error:", error);
  }
};

// ==========================================
// GET AUDIT LOGS
// GET /api/admin/audit-logs
// ==========================================
export const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json(logs);
  } catch (error) {
    console.error("Get Audit Logs Error:", error);

    return res.status(500).json({
      message: "Unable to load audit logs",
    });
  }
};
