import pool from "@/utils/db";
import { authenticateToken } from "@/utils/auth";

function sanitizeIdentifier(input, fallback) {
  const safe = (input || "").toString().replace(/[^a-zA-Z0-9_]/g, "");
  return safe.length > 0 ? safe : fallback;
}

async function columnExists(table, column) {
  const safeTable = sanitizeIdentifier(table, "messages");
  const safeColumn = sanitizeIdentifier(column, "id");
  const query = `SHOW COLUMNS FROM \`${safeTable}\` LIKE '${safeColumn}'`;
  const [rows] = await pool.query(query);
  return rows.length > 0;
}

async function constraintExists(table, constraint) {
  const safeTable = sanitizeIdentifier(table, "messages");
  const safeConstraint = sanitizeIdentifier(constraint, "fk_messages_channel");
  const query = `SELECT CONSTRAINT_NAME
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = '${safeTable}'
       AND CONSTRAINT_NAME = '${safeConstraint}'
     LIMIT 1`;
  const [rows] = await pool.query(query);
  return rows.length > 0;
}

async function ensureMessageSchema() {
  try {
    if (!(await columnExists("messages", "channel_id"))) {
      await pool.execute("ALTER TABLE messages ADD COLUMN channel_id INT NULL");
    }
    if (!(await columnExists("messages", "thread_parent_id"))) {
      await pool.execute("ALTER TABLE messages ADD COLUMN thread_parent_id INT NULL");
    }
    if (!(await columnExists("messages", "client_id"))) {
      await pool.execute("ALTER TABLE messages ADD COLUMN client_id VARCHAR(100) NULL");
    }

    if (!(await constraintExists("messages", "fk_messages_channel"))) {
      try {
        await pool.execute(
          "ALTER TABLE messages ADD CONSTRAINT fk_messages_channel FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE"
        );
      } catch (error) {
        if (
          error.code !== "ER_DUP_KEYNAME" &&
          error.code !== "ER_NO_REFERENCED_TABLE" &&
          error.code !== "ER_CANT_CREATE_TABLE" &&
          error.code !== "ER_CANNOT_ADD_FOREIGN"
        ) {
          throw error;
        }
      }
    }
  } catch (error) {
    if (
      error.code !== "ER_DUP_KEYNAME" &&
      error.code !== "ER_NO_REFERENCED_TABLE" &&
      error.code !== "ER_CANT_CREATE_TABLE" &&
      error.code !== "ER_CANNOT_ADD_FOREIGN"
    ) {
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

async function ensureChannelExists(channelId) {
  const [channels] = await pool.execute(
    "SELECT id FROM channels WHERE id = ? LIMIT 1",
    [channelId]
  );
  return channels.length > 0;
}

export default async function handler(req, res) {
  const user = authenticateToken(req, res);
  if (!user) return;

  const channelId =
    req.method === "GET"
      ? parseInt(req.query.channelId, 10)
      : parseInt(req.body?.channelId, 10);

  if (!channelId || Number.isNaN(channelId)) {
    return res.status(400).json({ error: "channelId is required" });
  }

  try {
    await ensureMessageSchema();
  } catch (error) {
    console.error("Message schema update failed:", error);
    return res.status(500).json({ error: "Failed to prepare message schema" });
  }

  const channelExists = await ensureChannelExists(channelId);
  if (!channelExists) {
    return res.status(404).json({ error: "Channel not found" });
  }

  const membership = await ensureMembership(user.id, channelId);
  if (!membership) {
    return res.status(403).json({ error: "You are not a member of this channel" });
  }

  if (req.method === "GET") {
    try {
      // Check if user has cleared this chat
      let clearedAt = null;
      try {
        const [clearedRows] = await pool.execute(
          "SELECT cleared_at FROM cleared_chats WHERE user_id = ? AND channel_id = ?",
          [user.id, channelId]
        );
        if (clearedRows.length > 0 && clearedRows[0].cleared_at) {
          clearedAt = clearedRows[0].cleared_at;
        }
      } catch (error) {
        // If cleared_chats table doesn't exist yet, that's okay - just continue without filtering
      }

      // Build query with optional cleared_at filter
      let query = `SELECT id,
                          user_id,
                          username,
                          message,
                          message_type,
                          file_url,
                          file_name,
                          mime_type,
                          created_at,
                          channel_id,
                          thread_parent_id,
                          client_id
                   FROM messages
                   WHERE channel_id = ?`;
      
      const queryParams = [channelId];
      
      // Only show messages created after the clear timestamp
      if (clearedAt) {
        query += ` AND created_at > ?`;
        queryParams.push(clearedAt);
      }
      
      query += ` ORDER BY created_at ASC LIMIT 200`;

      const [rows] = await pool.execute(query, queryParams);

      // Fetch reactions for all messages
      const messageIds = rows.map((msg) => msg.id).filter(Boolean);
      let reactionsByMessage = {};

      if (messageIds.length > 0) {
        try {
          const placeholders = messageIds.map(() => "?").join(",");
          const [reactions] = await pool.execute(
            `SELECT mr.message_id, mr.emoji, mr.user_id, u.username
             FROM message_reactions mr
             LEFT JOIN users u ON u.id = mr.user_id
             WHERE mr.message_id IN (${placeholders})
             ORDER BY mr.created_at ASC`,
            messageIds
          );

          // Group reactions by message and emoji
          reactions.forEach((reaction) => {
            const msgId = reaction.message_id;
            if (!reactionsByMessage[msgId]) {
              reactionsByMessage[msgId] = {};
            }
            if (!reactionsByMessage[msgId][reaction.emoji]) {
              reactionsByMessage[msgId][reaction.emoji] = {
                emoji: reaction.emoji,
                count: 0,
                users: [],
              };
            }
            reactionsByMessage[msgId][reaction.emoji].count++;
            reactionsByMessage[msgId][reaction.emoji].users.push({
              id: reaction.user_id,
              username: reaction.username,
              isCurrentUser: reaction.user_id === user.id,
            });
          });
        } catch (error) {
          // If reactions table doesn't exist or query fails, just log and continue
          // Reactions are optional, so we don't want to break message loading
          console.error("Error fetching reactions:", error);
        }
      }

      // Attach reactions to messages
      const messagesWithReactions = rows.map((msg) => ({
        ...msg,
        reactions: reactionsByMessage[msg.id]
          ? Object.values(reactionsByMessage[msg.id])
          : [],
      }));

      return res.json(messagesWithReactions);
    } catch (error) {
      console.error("Fetch messages error:", error);
      return res.status(500).json({ error: "Failed to load messages" });
    }
  }

  if (req.method === "POST") {
    const { message, attachment, clientId = null, threadParentId = null, messageType: providedMessageType } = req.body;

    const trimmedMessage = typeof message === "string" ? message.trim() : "";
    const hasText = Boolean(trimmedMessage);
    const hasAttachment = attachment && attachment.fileUrl;

    // System messages (call_started, call_ended) don't need text or attachment
    const isSystemMessage = providedMessageType === "call_started" || providedMessageType === "call_ended";
    
    if (!isSystemMessage && !hasText && !hasAttachment) {
      return res
        .status(400)
        .json({ error: "Message text or attachment is required" });
    }

    // Check if messageType is provided (for system messages like call_started, call_ended)
    let messageType = providedMessageType || "text";
    
    // Only determine type from attachment if not a system message
    if (!req.body.messageType && hasAttachment) {
      if (attachment.mimeType?.startsWith("image/")) {
        messageType = "image";
      } else if (attachment.mimeType?.startsWith("audio/")) {
        messageType = "audio";
      } else {
        messageType = "file";
      }
    }
    const fileUrl = hasAttachment ? attachment.fileUrl : null;
    const fileName = hasAttachment ? attachment.fileName : null;
    const mimeType = hasAttachment ? attachment.mimeType : null;

    try {
      const [result] = await pool.execute(
        `INSERT INTO messages
            (user_id, username, message, message_type, file_url, file_name, mime_type, channel_id, thread_parent_id, client_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          user.username,
          hasText ? trimmedMessage : null,
          messageType,
          fileUrl,
          fileName,
          mimeType,
          channelId,
          threadParentId || null,
          clientId,
        ]
      );

      const newMessage = {
        id: result.insertId,
        user_id: user.id,
        username: user.username,
        message: hasText ? trimmedMessage : null,
        message_type: messageType,
        file_url: fileUrl,
        file_name: fileName,
        mime_type: mimeType,
        created_at: new Date(),
        channel_id: channelId,
        thread_parent_id: threadParentId,
        clientId: clientId || null,
      };

      return res.status(201).json(newMessage);
    } catch (error) {
      console.error("Create message error:", error);
      return res.status(500).json({ error: "Failed to send message" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}


