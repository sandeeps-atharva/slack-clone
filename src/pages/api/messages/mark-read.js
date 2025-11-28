import pool from "@/utils/db";
import { authenticateToken } from "@/utils/auth";

// Get the socket.io instance
function getSocketIO(req) {
  if (!req.socket?.server?.io) {
    return null;
  }
  return req.socket.server.io;
}

async function tableExists(tableName) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return rows.length > 0;
}

async function ensureMessageReadsSchema() {
  try {
    if (!(await tableExists("message_reads"))) {
      await pool.execute(`
        CREATE TABLE message_reads (
          id INT AUTO_INCREMENT PRIMARY KEY,
          message_id INT NOT NULL,
          user_id INT NOT NULL,
          read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_message_read (message_id, user_id),
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
          INDEX idx_message_id (message_id),
          INDEX idx_user_id (user_id)
        )
      `);
    }
  } catch (error) {
    if (error.code !== "ER_TABLE_EXISTS_ERROR") {
      console.error("Message reads schema error:", error);
      throw error;
    }
  }
}

async function ensureMembership(userId, channelId) {
  const [membership] = await pool.execute(
    "SELECT role FROM channel_members WHERE channel_id = ? AND user_id = ? LIMIT 1",
    [channelId, userId]
  );
  return membership.length > 0 ? membership[0] : null;
}

export default async function handler(req, res) {
  const user = authenticateToken(req, res);
  if (!user) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await ensureMessageReadsSchema();
  } catch (error) {
    console.error("Message reads schema update failed:", error);
    return res.status(500).json({ error: "Failed to prepare message reads schema" });
  }

  const { messageIds, channelId } = req.body;

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ error: "messageIds array is required" });
  }

  if (!channelId || Number.isNaN(parseInt(channelId, 10))) {
    return res.status(400).json({ error: "channelId is required" });
  }

  // Verify user is a member of the channel
  const membership = await ensureMembership(user.id, parseInt(channelId, 10));
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this channel" });
  }

  try {
    // Mark messages as read (using INSERT IGNORE to handle duplicates)
    const placeholders = messageIds.map(() => "?").join(",");
    const values = [];
    messageIds.forEach((messageId) => {
      values.push(messageId, user.id);
    });

    await pool.execute(
      `INSERT IGNORE INTO message_reads (message_id, user_id, read_at)
       VALUES ${messageIds.map(() => "(?, ?, NOW())").join(", ")}`,
      values
    );

    // Emit socket event to notify all clients about read status update
    const io = getSocketIO(req);
    if (io) {
      io.emit("messages:read", {
        channelId: parseInt(channelId, 10),
        messageIds,
        readBy: user.id,
        readByUsername: user.username,
      });
    }

    return res.status(200).json({ success: true, markedCount: messageIds.length });
  } catch (error) {
    console.error("Mark messages as read error:", error);
    return res.status(500).json({ error: "Failed to mark messages as read" });
  }
}

