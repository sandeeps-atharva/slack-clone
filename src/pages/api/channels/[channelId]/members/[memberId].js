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
  const memberId = Number.parseInt(req.query.memberId, 10);

  if (!Number.isInteger(channelId) || channelId <= 0) {
    return res.status(400).json({ error: "Invalid channel id" });
  }
  if (!Number.isInteger(memberId) || memberId <= 0) {
    return res.status(400).json({ error: "Invalid member id" });
  }

  if (memberId === user.id) {
    return res.status(400).json({ error: "Use the leave endpoint to remove yourself" });
  }

  const requesterMembership = await getMembership(user.id, channelId);
  if (!requesterMembership) {
    return res.status(403).json({ error: "Not a member of this channel" });
  }
  if (requesterMembership.role !== "owner") {
    return res.status(403).json({ error: "Only channel owners can remove members" });
  }

  const targetMembership = await getMembership(memberId, channelId);
  if (!targetMembership) {
    return res.status(404).json({ error: "Target user is not part of this channel" });
  }

  if (targetMembership.role === "owner") {
    return res.status(400).json({ error: "Cannot remove another owner" });
  }

  try {
    await pool.execute(
      "DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?",
      [channelId, memberId]
    );
    return res.status(200).json({ channelId, userId: memberId });
  } catch (error) {
    console.error("Remove channel member error:", error);
    return res.status(500).json({ error: "Failed to remove member" });
  }
}


