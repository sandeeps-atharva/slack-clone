import pool from "@/utils/db";
import { authenticateToken } from "@/utils/auth";

async function ensureClearedChatsSchema() {
  try {
    // Check if table exists
    const [tables] = await pool.execute(
      "SHOW TABLES LIKE 'cleared_chats'"
    );
    
    if (tables.length === 0) {
      // Create the cleared_chats table
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS cleared_chats (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          channel_id INT NOT NULL,
          cleared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_channel (user_id, channel_id),
          KEY idx_user (user_id),
          KEY idx_channel (channel_id),
          KEY idx_cleared_at (cleared_at),
          CONSTRAINT fk_cleared_chats_user 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT fk_cleared_chats_channel 
            FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
    }
  } catch (error) {
    // If table already exists or foreign key constraints fail, that's okay
    if (
      error.code !== "ER_TABLE_EXISTS_ERROR" &&
      error.code !== "ER_NO_REFERENCED_TABLE" &&
      error.code !== "ER_CANNOT_ADD_FOREIGN"
    ) {
      console.error("Error ensuring cleared_chats schema:", error);
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

  const channelId = parseInt(req.query.channelId, 10);
  if (!channelId || Number.isNaN(channelId)) {
    return res.status(400).json({ error: "Invalid channel ID" });
  }

  try {
    // Ensure schema exists
    await ensureClearedChatsSchema();

    // Check if user is a member of the channel
    const membership = await ensureMembership(user.id, channelId);
    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this channel" });
    }

    // Insert or update the cleared_at timestamp
    await pool.execute(
      `INSERT INTO cleared_chats (user_id, channel_id, cleared_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE cleared_at = NOW()`,
      [user.id, channelId]
    );

    // Get the cleared_at timestamp
    const [result] = await pool.execute(
      "SELECT cleared_at FROM cleared_chats WHERE user_id = ? AND channel_id = ?",
      [user.id, channelId]
    );

    return res.json({
      success: true,
      channelId,
      clearedAt: result[0]?.cleared_at,
    });
  } catch (error) {
    console.error("Clear chat error:", error);
    return res.status(500).json({ error: "Failed to clear chat" });
  }
}

