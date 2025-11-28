import pool from "@/utils/db";
import { authenticateToken } from "@/utils/auth";

async function tableExists(tableName) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME 
     FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = ?`,
    [tableName]
  );
  return rows.length > 0;
}

async function ensureReactionsSchema() {
  try {
    const tableName = "message_reactions";
    const exists = await tableExists(tableName);
    
    if (!exists) {
      await pool.execute(`
        CREATE TABLE message_reactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          message_id INT NOT NULL,
          user_id INT NOT NULL,
          emoji VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_reaction (message_id, user_id, emoji),
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
          INDEX idx_message_id (message_id),
          INDEX idx_user_id (user_id)
        )
      `);
    }
  } catch (error) {
    if (
      error.code !== "ER_DUP_KEYNAME" &&
      error.code !== "ER_TABLE_EXISTS_ERROR" &&
      error.code !== "ER_NO_REFERENCED_TABLE"
    ) {
      console.error("Reactions schema error:", error);
      throw error;
    }
  }
}

async function getMessageWithMembership(messageId, userId) {
  const [rows] = await pool.execute(
    `SELECT m.id, m.channel_id, cm.role AS membership_role
     FROM messages m
     JOIN channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = ?
     WHERE m.id = ?
     LIMIT 1`,
    [userId, messageId]
  );
  return rows[0] || null;
}

export default async function handler(req, res) {
  const user = authenticateToken(req, res);
  if (!user) return;

  try {
    await ensureReactionsSchema();
  } catch (error) {
    console.error("Reactions schema update failed:", error);
    return res.status(500).json({ error: "Failed to prepare reactions schema" });
  }

  const messageId = parseInt(req.query.messageId, 10);
  if (!messageId || Number.isNaN(messageId)) {
    return res.status(400).json({ error: "messageId is required" });
  }

  // Verify user has access to the message's channel
  const message = await getMessageWithMembership(messageId, user.id);
  if (!message) {
    return res.status(404).json({ error: "Message not found or access denied" });
  }

  if (req.method === "GET") {
    try {
      const [reactions] = await pool.execute(
        `SELECT mr.emoji, mr.user_id, u.username
         FROM message_reactions mr
         LEFT JOIN users u ON u.id = mr.user_id
         WHERE mr.message_id = ?
         ORDER BY mr.created_at ASC`,
        [messageId]
      );

      // Group reactions by emoji
      const grouped = {};
      reactions.forEach((reaction) => {
        if (!grouped[reaction.emoji]) {
          grouped[reaction.emoji] = {
            emoji: reaction.emoji,
            count: 0,
            users: [],
          };
        }
        grouped[reaction.emoji].count++;
        if (reaction.user_id === user.id) {
          grouped[reaction.emoji].users.push({
            id: reaction.user_id,
            username: reaction.username,
            isCurrentUser: true,
          });
        } else {
          grouped[reaction.emoji].users.push({
            id: reaction.user_id,
            username: reaction.username,
            isCurrentUser: false,
          });
        }
      });

      return res.json({
        messageId,
        reactions: Object.values(grouped),
      });
    } catch (error) {
      console.error("Fetch reactions error:", error);
      return res.status(500).json({ error: "Failed to load reactions" });
    }
  }

  if (req.method === "POST" || req.method === "PATCH") {
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== "string" || emoji.trim().length === 0) {
      return res.status(400).json({ error: "emoji is required" });
    }
console.log("emojiemoji" , emoji);

    const emojiValue = emoji.trim();
    console.log("emojiValue",emojiValue);
    

    try {
      // Check if reaction already exists
      const [existing] = await pool.execute(
        `SELECT id FROM message_reactions 
         WHERE message_id = ? AND user_id = ? AND emoji = ?`,
        [messageId, user.id, emojiValue]
      );

      if (existing.length > 0) {
        // Remove reaction (toggle off)
        await pool.execute(
          `DELETE FROM message_reactions 
           WHERE message_id = ? AND user_id = ? AND emoji = ?`,
          [messageId, user.id, emojiValue]
        );

        return res.json({
          messageId,
          emoji: emojiValue,
          action: "removed",
        });
      } else {
        // Add reaction (toggle on)
        await pool.execute(
          `INSERT INTO message_reactions (message_id, user_id, emoji)
           VALUES (?, ?, ?)`,
          [messageId, user.id, emojiValue]
        );

        return res.json({
          messageId,
          emoji: emojiValue,
          action: "added",
          user: {
            id: user.id,
            username: user.username,
          },
        });
      }
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        // Race condition - reaction already exists, treat as remove
        await pool.execute(
          `DELETE FROM message_reactions 
           WHERE message_id = ? AND user_id = ? AND emoji = ?`,
          [messageId, user.id, emojiValue]
        );
        return res.json({
          messageId,
          emoji: emojiValue,
          action: "removed",
        });
      }
      console.error("Toggle reaction error:", error);
      return res.status(500).json({ error: "Failed to toggle reaction" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

