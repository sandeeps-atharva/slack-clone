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

      // Create system messages for each newly added member
      try {
        for (const newMember of newMembers) {
          const systemMessage = `${newMember.username} was added by ${user.username}`;
          
          // Insert system message into database
          const [messageResult] = await pool.execute(
            `INSERT INTO messages
                (user_id, username, message, message_type, channel_id)
             VALUES (?, ?, ?, ?, ?)`,
            [user.id, user.username, systemMessage, "member_added", channelId]
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
        }
      } catch (messageError) {
        console.error("Failed to create system message for member addition:", messageError);
        // Don't fail the request if message creation fails
      }

      // Emit socket event to notify newly added members about the channel
      try {
        const io = res.socket.server.io;
        if (io) {
          // Fetch the channel data
          const [channelRows] = await pool.execute(
            "SELECT id, name, slug, topic, is_private FROM channels WHERE id = ? LIMIT 1",
            [channelId]
          );
          
          if (channelRows.length > 0) {
            const channel = channelRows[0];
            
            // Ensure topic is a string (not null) to avoid parsing issues
            // For regular channels (non-DM), ensure topic is empty string if null
            // This prevents them from being misidentified as DMs
            let topic = channel.topic;
            if (topic == null) {
              topic = "";
            }
            
            // Validate: If channel has a name, it's a regular channel, not a DM
            // Ensure topic doesn't contain DM metadata for regular channels
            if (channel.name && channel.name.trim() !== "") {
              // This is a regular channel - ensure topic doesn't have DM metadata
              try {
                const parsed = topic ? JSON.parse(topic) : null;
                if (parsed && parsed.type === "dm") {
                  // Topic incorrectly has DM metadata - clear it
                  topic = "";
                }
              } catch (e) {
                // Topic is not valid JSON, which is fine for regular channels
                // Keep it as is (might be plain text)
              }
            }
            
            // Get the role for each newly added member
            const [memberRoles] = await pool.execute(
              `SELECT user_id, role FROM channel_members WHERE channel_id = ? AND user_id IN (${newIds.map(() => "?").join(",")})`,
              [channelId, ...newIds]
            );
            
            const roleMap = new Map(memberRoles.map((row) => [row.user_id, row.role]));
            
            // Emit event to each newly added member with their role
            newIds.forEach((userId) => {
              // Ensure all required fields are present and properly formatted
              const channelWithRole = {
                id: channel.id,
                name: channel.name || "", // Ensure name is always a string
                slug: channel.slug || "",
                topic: topic, // Ensure topic is always a string (empty string if null)
                is_private: channel.is_private || 0, // Ensure is_private is a number
                role: roleMap.get(userId) || "member",
              };
              
              io.emit("member:added_to_channel", {
                channel: channelWithRole,
                userId,
              });
            });
          }
        }
      } catch (socketError) {
        console.error("Failed to emit member:added_to_channel event:", socketError);
        // Don't fail the request if socket emission fails
      }

      return res.status(201).json(newMembers);
    } catch (error) {
      console.error("Add channel members error:", error);
      return res.status(500).json({ error: "Failed to add members" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
