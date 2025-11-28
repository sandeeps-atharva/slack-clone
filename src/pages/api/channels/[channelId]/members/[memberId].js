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

  const isRemovingOwner = targetMembership.role === "owner";

  try {
    // Get the target user's username for the system message
    const [targetUserRows] = await pool.execute(
      "SELECT username FROM users WHERE id = ? LIMIT 1",
      [memberId]
    );
    const targetUsername = targetUserRows[0]?.username || "Unknown user";

    let newOwnerId = null;
    let newOwnerUsername = null;

    // If removing an owner, find a new owner to transfer ownership to
    if (isRemovingOwner) {
      // First, check if there are other owners
      const [otherOwners] = await pool.execute(
        "SELECT user_id FROM channel_members WHERE channel_id = ? AND role = 'owner' AND user_id != ? LIMIT 1",
        [channelId, memberId]
      );

      if (otherOwners.length > 0) {
        // There are other owners, no need to transfer
        newOwnerId = null;
      } else {
        // No other owners, need to transfer ownership
        // Priority: moderator > member (by joined_at, oldest first)
        const [newOwnerCandidate] = await pool.execute(
          `SELECT user_id, role FROM channel_members 
           WHERE channel_id = ? AND user_id != ? 
           ORDER BY CASE role WHEN 'moderator' THEN 0 WHEN 'member' THEN 1 ELSE 2 END, joined_at ASC 
           LIMIT 1`,
          [channelId, memberId]
        );

        if (newOwnerCandidate.length > 0) {
          newOwnerId = newOwnerCandidate[0].user_id;
          
          // Update the new owner's role
          await pool.execute(
            "UPDATE channel_members SET role = 'owner' WHERE channel_id = ? AND user_id = ?",
            [channelId, newOwnerId]
          );

          // Get the new owner's username
          const [newOwnerUserRows] = await pool.execute(
            "SELECT username FROM users WHERE id = ? LIMIT 1",
            [newOwnerId]
          );
          newOwnerUsername = newOwnerUserRows[0]?.username || "Unknown user";
        }
      }
    }

    // Create system message before removing the user
    try {
      let systemMessage;
      if (isRemovingOwner && newOwnerId) {
        systemMessage = `${targetUsername} was removed by ${user.username}. Ownership transferred to ${newOwnerUsername}`;
      } else {
        systemMessage = `${targetUsername} was removed by ${user.username}`;
      }
      
      // Insert system message into database
      const [messageResult] = await pool.execute(
        `INSERT INTO messages
            (user_id, username, message, message_type, channel_id)
         VALUES (?, ?, ?, ?, ?)`,
        [user.id, user.username, systemMessage, "member_removed", channelId]
      );

      const messageId = messageResult.insertId;

      // Fetch the complete message with timestamp
      const [messageRows] = await pool.execute(
        `SELECT id, user_id, username, message, message_type, channel_id, created_at
         FROM messages WHERE id = ? LIMIT 1`,
        [messageId]
      );

      if (messageRows.length > 0) {
        const systemMsg = messageRows[0];
        
        // Broadcast the system message via socket
        const io = res.socket.server.io;
        if (io) {
          io.emit("receive_message", {
            ...systemMsg,
            channel_id: channelId,
            channelId: channelId,
          });
        }
      }
    } catch (messageError) {
      console.error("Failed to create system message for member removal:", messageError);
      // Don't fail the request if message creation fails
    }

    // Remove the user from the channel
    await pool.execute(
      "DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?",
      [channelId, memberId]
    );

    // If ownership was transferred, emit socket event
    if (isRemovingOwner && newOwnerId) {
      try {
        const io = res.socket.server.io;
        if (io) {
          // Get all members to notify them of the ownership transfer
          const [allMembers] = await pool.execute(
            "SELECT user_id, role FROM channel_members WHERE channel_id = ?",
            [channelId]
          );

          // Emit ownership transfer event to all members
          allMembers.forEach((member) => {
            io.emit("channel:ownership_transferred", {
              channelId,
              previousOwnerId: memberId,
              previousOwnerUsername: targetUsername,
              newOwnerId,
              newOwnerUsername,
              userId: member.user_id,
            });
          });
        }
      } catch (socketError) {
        console.error("Failed to emit channel:ownership_transferred event:", socketError);
      }
    }

    // Emit socket event to notify other members that this user was removed
    try {
      const io = res.socket.server.io;
      if (io) {
        io.emit("member:left_channel", {
          channelId,
          userId: memberId,
          username: targetUsername,
        });
      }
    } catch (socketError) {
      console.error("Failed to emit member:left_channel event:", socketError);
      // Don't fail the request if socket emission fails
    }

    return res.status(200).json({ channelId, userId: memberId });
  } catch (error) {
    console.error("Remove channel member error:", error);
    return res.status(500).json({ error: "Failed to remove member" });
  }
}


