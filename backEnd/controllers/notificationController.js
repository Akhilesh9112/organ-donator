import Notification from "../models/Notification.js";

// ==========================================
// GET /api/notifications
// Current user's latest notifications
// ==========================================
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.status(200).json({
      notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    res.status(500).json({
      message: "Unable to load notifications",
    });
  }
};

// ==========================================
// GET /api/notifications/unread-count
// ==========================================
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false,
    });

    res.status(200).json({
      count,
    });
  } catch (error) {
    console.error("Unread notification count error:", error);

    res.status(500).json({
      message: "Unable to load unread count",
    });
  }
};

// ==========================================
// PATCH /api/notifications/:id/read
// Mark ONE notification as read
// ==========================================
export const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,

      // Important:
      // user can modify only own notification
      userId: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();

      await notification.save();
    }

    res.status(200).json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("Mark notification read error:", error);

    res.status(500).json({
      message: "Unable to update notification",
    });
  }
};

// ==========================================
// PATCH /api/notifications/read-all
// Mark current user's notifications read
// ==========================================
export const markAllNotificationsRead = async (req, res) => {
  try {
    const now = new Date();

    await Notification.updateMany(
      {
        userId: req.user._id,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: now,
        },
      },
    );

    res.status(200).json({
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);

    res.status(500).json({
      message: "Unable to update notifications",
    });
  }
};
