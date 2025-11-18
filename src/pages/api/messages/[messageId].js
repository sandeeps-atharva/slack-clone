import pool from "@/utils/db";
import { authenticateToken } from "@/utils/auth";

async function getMessageWithMembership(messageId, userId) {
  const [rows] = await pool.execute(
    `SELECT m.id,
            m.user_id,
            m.username,
            m.message,
            m.message_type,
            m.file_url,
            m.file_name,
            m.mime_type,
            m.created_at,
            m.channel_id,
            m.thread_parent_id,
            m.client_id,
            cm.role AS membership_role
       FROM messages m
       JOIN channel_members cm
         ON cm.channel_id = m.channel_id
        AND cm.user_id = ?
      WHERE m.id = ?
      LIMIT 1`,
    [userId, messageId]
  );

  return rows[0] || null;
}

export default async function handler(req, res) {
  const user = authenticateToken(req, res);
  if (!user) return;

  const messageId = Number.parseInt(req.query.messageId, 10);
  if (!Number.isInteger(messageId) || messageId <= 0) {
    return res.status(400).json({ error: "Invalid message id" });
  }

  let message;
  try {
    message = await getMessageWithMembership(messageId, user.id);
  } catch (error) {
    console.error("Fetch message error:", error);
    return res.status(500).json({ error: "Failed to load message" });
  }

  if (!message) {
    return res.status(404).json({ error: "Message not found" });
  }

  if (req.method === "PATCH") {
    if (message.user_id !== user.id) {
      return res.status(403).json({ error: "You can only edit your own messages" });
    }

    const { message: newMessage, attachment, removeAttachment } = req.body || {};
    const trimmed = typeof newMessage === "string" ? newMessage.trim() : "";

    const wantsAttachment = attachment && attachment.fileUrl;
    const wantsRemoval = Boolean(removeAttachment);

    let nextFileUrl = message.file_url;
    let nextFileName = message.file_name;
    let nextMimeType = message.mime_type;
    let nextMessageType = message.message_type || "text";

    if (wantsAttachment) {
      nextFileUrl = attachment.fileUrl;
      nextFileName = attachment.fileName || null;
      nextMimeType = attachment.mimeType || null;
      if (attachment.mimeType?.startsWith("image/")) {
        nextMessageType = "image";
      } else if (attachment.mimeType?.startsWith("audio/")) {
        nextMessageType = "audio";
      } else {
        nextMessageType = "file";
      }
    } else if (wantsRemoval) {
      nextFileUrl = null;
      nextFileName = null;
      nextMimeType = null;
      nextMessageType = "text";
    } else if (!message.file_url) {
      nextMessageType = "text";
    }

    const finalHasAttachment = Boolean(nextFileUrl);
    if (!trimmed && !finalHasAttachment) {
      return res.status(400).json({ error: "Message text or attachment is required" });
    }

    try {
      await pool.execute(
        "UPDATE messages SET message = ?, message_type = ?, file_url = ?, file_name = ?, mime_type = ? WHERE id = ?",
        [trimmed || null, nextMessageType, nextFileUrl, nextFileName, nextMimeType, messageId]
      );
      return res.status(200).json({
        ...message,
        message: trimmed || null,
        message_type: nextMessageType,
        file_url: nextFileUrl,
        file_name: nextFileName,
        mime_type: nextMimeType,
      });
    } catch (error) {
      console.error("Update message error:", error);
      return res.status(500).json({ error: "Failed to update message" });
    }
  }

  if (req.method === "DELETE") {
    const canModerate = ["owner", "moderator"].includes(message.membership_role);
    const canDelete = message.user_id === user.id || canModerate;

    if (!canDelete) {
      return res.status(403).json({ error: "You do not have permission to delete this message" });
    }

    try {
      await pool.execute("DELETE FROM messages WHERE id = ?", [messageId]);
      return res.status(200).json({ success: true, id: messageId, channelId: message.channel_id });
    } catch (error) {
      console.error("Delete message error:", error);
      return res.status(500).json({ error: "Failed to delete message" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
