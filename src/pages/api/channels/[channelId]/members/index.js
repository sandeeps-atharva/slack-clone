import pool from "@/utils/db";
import { authenticateToken } from "@/utils/auth";

async function getMembership(userId, channelId) {
  const [rows] = await pool.execute(
    "SELECT role FROM channel_members WHERE channel_id = ? AND user_id = ? LIMIT 1",
    [channelId, userId]
  );
  return rows[0] || null;
}

function uniquePositiveIds(ids) {
  if (!Array.isArray(ids)) return [];
  const set = new Set();
  ids.forEach((value) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      set.add(parsed);
    }
  });
  return [...set];
}

export default async function handler(req, res) {
  const user = authenticateToken(req, res);
  if (!user) return;

  const channelId = Number.parseInt(req.query.channelId, 10);
  if (!Number.isInteger(channelId) || channelId <= 0) {
    return res.status(400).json({ error: "Invalid channel id" });
  }

  const membership = await getMembership(user.id, channelId);
  if (!membership) {
    return res.status(403).json({ error: "Not a member of this channel" });
  }

  if (req.method === "GET") {
    try {
      const [members] = await pool.execute(
        `SELECT u.id, u.username, u.email, cm.role, cm.joined_at
         FROM channel_members cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.channel_id = ?
         ORDER BY
           CASE cm.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END,
           u.username ASC`,
        [channelId]
      );

      return res.status(200).json(members);
    } catch (error) {
      console.error("Fetch channel members error:", error);
      return res.status(500).json({ error: "Failed to load channel members" });
    }
  }

  if (req.method === "POST") {
    if (membership.role !== "owner") {
      return res.status(403).json({ error: "Only the channel owner can invite members" });
    }

    const { memberIds } = req.body || {};
    const sanitizedIds = uniquePositiveIds(memberIds).filter((id) => id !== user.id);

    if (sanitizedIds.length === 0) {
      return res.status(400).json({ error: "Select at least one user to invite" });
    }

    try {
      const [existingRows] = await pool.query(
        `SELECT user_id FROM channel_members WHERE channel_id = ? AND user_id IN (${sanitizedIds
          .map(() => "?")
          .join(",")})`,
        [channelId, ...sanitizedIds]
      );
      const existingIds = new Set(existingRows.map((row) => row.user_id));
      const newIds = sanitizedIds.filter((id) => !existingIds.has(id));

      if (newIds.length === 0) {
        return res.status(200).json([]);
      }

      const insertValues = newIds.map((id) => [channelId, id, "member"]);
      await pool.query(
        "INSERT IGNORE INTO channel_members (channel_id, user_id, role) VALUES ?",
        [insertValues]
      );

      const [newMembers] = await pool.query(
        `SELECT u.id, u.username, u.email, cm.role, cm.joined_at
         FROM channel_members cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.channel_id = ? AND cm.user_id IN (${newIds.map(() => "?").join(",")})
         ORDER BY u.username ASC`,
        [channelId, ...newIds]
      );

      return res.status(201).json(newMembers);
    } catch (error) {
      console.error("Add channel members error:", error);
      return res.status(500).json({ error: "Failed to add members" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
