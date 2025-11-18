import pool from "@/utils/db";
import { authenticateToken } from "@/utils/auth";

async function getMembership(userId, channelId) {
  const [rows] = await pool.execute(
    "SELECT role FROM channel_members WHERE channel_id = ? AND user_id = ? LIMIT 1",
    [channelId, userId]
  );
  return rows[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = authenticateToken(req, res);
  if (!user) return;

  const channelId = Number.parseInt(req.query.channelId, 10);
  if (!Number.isInteger(channelId) || channelId <= 0) {
    return res.status(400).json({ error: "Invalid channel id" });
  }

  const membership = await getMembership(user.id, channelId);
  if (!membership) {
    return res.status(404).json({ error: "You are not a member of this channel" });
  }

  if (membership.role === "owner") {
    const [owners] = await pool.execute(
      "SELECT COUNT(*) as count FROM channel_members WHERE channel_id = ? AND role = 'owner'",
      [channelId]
    );
    if (owners[0]?.count <= 1) {
      return res.status(400).json({ error: "Transfer ownership before leaving the channel" });
    }
  }

  try {
    await pool.execute(
      "DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?",
      [channelId, user.id]
    );
    return res.status(200).json({ channelId });
  } catch (error) {
    console.error("Leave channel error:", error);
    return res.status(500).json({ error: "Failed to leave channel" });
  }
}


