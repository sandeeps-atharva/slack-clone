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

  const isOwnerLeaving = membership.role === "owner";
  let newOwnerId = null;
  let newOwnerUsername = null;

  // If owner is leaving, check if we need to transfer ownership
  if (isOwnerLeaving) {
    const [owners] = await pool.execute(
      "SELECT COUNT(*) as count FROM channel_members WHERE channel_id = ? AND role = 'owner'",
      [channelId]
    );
    
    if (owners[0]?.count <= 1) {
      // This is the last owner, need to transfer ownership
      // Priority: moderator > member (by joined_at, oldest first)
      const [newOwnerCandidate] = await pool.execute(
        `SELECT user_id, role FROM channel_members 
         WHERE channel_id = ? AND user_id != ? 
         ORDER BY CASE role WHEN 'moderator' THEN 0 WHEN 'member' THEN 1 ELSE 2 END, joined_at ASC 
         LIMIT 1`,
        [channelId, user.id]
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
      } else {
        // No other members to transfer ownership to
        return res.status(400).json({ error: "Cannot leave channel as the only member" });
      }
    }
  }

  try {
    // Create system message before removing the user
    try {
      let systemMessage;
      if (isOwnerLeaving && newOwnerId) {
        systemMessage = `${user.username} left the channel. Ownership transferred to ${newOwnerUsername}`;
      } else {
        systemMessage = `${user.username} left the channel`;
      }
      
      // Insert system message into database
      const [messageResult] = await pool.execute(
        `INSERT INTO messages
            (user_id, username, message, message_type, channel_id)
         VALUES (?, ?, ?, ?, ?)`,
        [user.id, user.username, systemMessage, "member_left", channelId]
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
      console.error("Failed to create system message for member leaving:", messageError);
      // Don't fail the request if message creation fails
    }

    // Remove the user from the channel
    await pool.execute(
      "DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?",
      [channelId, user.id]
    );

    // If ownership was transferred, emit socket event
    if (isOwnerLeaving && newOwnerId) {
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
              previousOwnerId: user.id,
              previousOwnerUsername: user.username,
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

    // Emit socket event to notify other members that this user left
    try {
      const io = res.socket.server.io;
      if (io) {
        io.emit("member:left_channel", {
          channelId,
          userId: user.id,
          username: user.username,
        });
      }
    } catch (socketError) {
      console.error("Failed to emit member:left_channel event:", socketError);
      // Don't fail the request if socket emission fails
    }

    return res.status(200).json({ channelId });
  } catch (error) {
    console.error("Leave channel error:", error);
    return res.status(500).json({ error: "Failed to leave channel" });
  }
}


