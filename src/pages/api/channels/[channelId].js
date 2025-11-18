import pool from "@/utils/db";
import { authenticateToken } from "@/utils/auth";

function sanitizeIdentifier(input, fallback) {
  const safe = (input || "").toString().replace(/[^a-zA-Z0-9_]/g, "");
  return safe.length > 0 ? safe : fallback;
}

async function getChannel(channelId) {
  const [rows] = await pool.execute(
    "SELECT id, name, slug, topic, is_private, created_by FROM channels WHERE id = ? LIMIT 1",
    [channelId]
  );
  return rows[0] || null;
}

async function getMembership(userId, channelId) {
  const [rows] = await pool.execute(
    "SELECT role FROM channel_members WHERE channel_id = ? AND user_id = ? LIMIT 1",
    [channelId, userId]
  );
  return rows[0] || null;
}

async function ensureSchema() {
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS channels (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, slug VARCHAR(120) NOT NULL UNIQUE, topic VARCHAR(255) NULL, is_private TINYINT(1) DEFAULT 0, created_by INT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB"
  );
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS channel_members (id INT AUTO_INCREMENT PRIMARY KEY, channel_id INT NOT NULL, user_id INT NOT NULL, role ENUM('owner','moderator','member') DEFAULT 'member', joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY unique_member (channel_id, user_id), KEY idx_user (user_id), CONSTRAINT fk_channel_members_channel FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE, CONSTRAINT fk_channel_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB"
  );
}

export default async function handler(req, res) {
  const user = authenticateToken(req, res);
  if (!user) return;

  const channelId = Number.parseInt(req.query.channelId, 10);
  if (!Number.isInteger(channelId) || channelId <= 0) {
    return res.status(400).json({ error: "Invalid channel id" });
  }

  try {
    await ensureSchema();
  } catch (error) {
    console.error("Channel schema ensure error:", error);
    return res.status(500).json({ error: "Failed to prepare channel schema" });
  }

  const channel = await getChannel(channelId);
  if (!channel) {
    return res.status(404).json({ error: "Channel not found" });
  }

  const membership = await getMembership(user.id, channelId);
  if (!membership) {
    return res.status(403).json({ error: "Not a member of this channel" });
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ...channel,
      role: membership.role,
    });
  }

  if (req.method === "PATCH") {
    const { name, topic, isPrivate } = req.body || {};
    const updates = [];
    const params = [];

    const isModeratorOrOwner = ["owner", "moderator"].includes(membership.role);

    if (!isModeratorOrOwner) {
      return res.status(403).json({ error: "Only channel moderators or owners can update settings" });
    }

    if (typeof name === "string") {
      const trimmed = name.trim();
      if (!trimmed) {
        return res.status(400).json({ error: "Channel name cannot be empty" });
      }
      updates.push("name = ?");
      params.push(trimmed);
    }

    if (typeof topic === "string") {
      const trimmedTopic = topic.trim();
      updates.push("topic = ?");
      params.push(trimmedTopic || null);
    }

    if (typeof isPrivate === "boolean") {
      updates.push("is_private = ?");
      params.push(isPrivate ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(200).json({
        ...channel,
        role: membership.role,
      });
    }

    params.push(channelId);

    try {
      await pool.execute(`UPDATE channels SET ${updates.join(", ")} WHERE id = ?`, params);
    } catch (error) {
      console.error("Update channel error:", error);
      return res.status(500).json({ error: "Failed to update channel" });
    }

    const updatedChannel = await getChannel(channelId);
    return res.status(200).json({
      ...updatedChannel,
      role: membership.role,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}


