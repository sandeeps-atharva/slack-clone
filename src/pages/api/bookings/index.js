import pool from "@/utils/db";
import { authenticateToken } from "@/utils/auth";

// Helper function to convert ISO datetime string to MySQL DATETIME format
function formatDateTimeForMySQL(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  // Format: YYYY-MM-DD HH:MM:SS
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Create bookings table if it doesn't exist
const CREATE_BOOKINGS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    user_id INT NOT NULL,
    purpose VARCHAR(255) NOT NULL,
    description TEXT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    participants JSON NULL,
    status ENUM('confirmed', 'cancelled', 'completed') DEFAULT 'confirmed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_room (room_id),
    KEY idx_user (user_id),
    KEY idx_start_time (start_time),
    KEY idx_end_time (end_time),
    KEY idx_status (status),
    CONSTRAINT fk_bookings_room
      FOREIGN KEY (room_id) REFERENCES rooms(id)
      ON DELETE CASCADE,
    CONSTRAINT fk_bookings_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB;
`;

async function ensureBookingsSchema() {
  try {
    await pool.execute(CREATE_BOOKINGS_TABLE_SQL);
  } catch (error) {
    console.error("Error creating bookings table:", error);
    throw error;
  }
}

// Check if a room is available for a time slot
async function isRoomAvailable(roomId, startTime, endTime, excludeBookingId = null) {
  let query = `
    SELECT COUNT(*) as count 
    FROM bookings 
    WHERE room_id = ? 
      AND status = 'confirmed'
      AND (
        (start_time < ? AND end_time > ?) OR
        (start_time < ? AND end_time > ?) OR
        (start_time >= ? AND end_time <= ?)
      )
  `;
  
  const params = [roomId, endTime, startTime, endTime, startTime, startTime, endTime];
  
  if (excludeBookingId) {
    query += " AND id != ?";
    params.push(excludeBookingId);
  }
  
  const [result] = await pool.execute(query, params);
  return result[0].count === 0;
}

// Helper function to find or create a DM channel between two users
// Returns { channelId, isNew } where isNew indicates if the channel was just created
async function findOrCreateDMChannel(userId1, userId2, username1, username2) {
  // Find existing DM channel between these two users
  // Check both user orders to handle any existing DM
  const [existingDMs] = await pool.execute(
    `SELECT DISTINCT c.id, c.name, c.topic
     FROM channels c
     INNER JOIN channel_members cm1 ON c.id = cm1.channel_id AND cm1.user_id = ?
     INNER JOIN channel_members cm2 ON c.id = cm2.channel_id AND cm2.user_id = ?
     WHERE c.is_private = 1
       AND c.id = cm1.channel_id
       AND c.id = cm2.channel_id
       AND (
         SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id
       ) = 2
     LIMIT 1`,
    [userId1, userId2]
  );

  if (existingDMs.length > 0) {
    console.log(`Found existing DM channel ${existingDMs[0].id} between users ${userId1} and ${userId2}`);
    return { channelId: existingDMs[0].id, isNew: false };
  }

  // Create new DM channel
  const dmMetadata = {
    type: "dm",
    participants: [
      { id: userId1, username: username1 },
      { id: userId2, username: username2 },
    ],
  };

  const targetName = username2 || "Direct Message";
  // Use a deterministic slug based on user IDs to avoid duplicates
  const slug = `dm-${Math.min(userId1, userId2)}-${Math.max(userId1, userId2)}`;

  // Check if slug already exists (in case of race condition)
  const [existingSlug] = await pool.execute(
    "SELECT id FROM channels WHERE slug = ? LIMIT 1",
    [slug]
  );

  if (existingSlug.length > 0) {
    // Channel already exists, return it
    console.log(`Found existing DM channel ${existingSlug[0].id} by slug between users ${userId1} and ${userId2}`);
    return { channelId: existingSlug[0].id, isNew: false };
  }

  const [channelResult] = await pool.execute(
    "INSERT INTO channels (name, slug, topic, is_private, created_by) VALUES (?, ?, ?, ?, ?)",
    [targetName, slug, JSON.stringify(dmMetadata), 1, userId1]
  );

  const channelId = channelResult.insertId;

  // Add both users as members
  await pool.execute(
    "INSERT IGNORE INTO channel_members (channel_id, user_id, role) VALUES (?, ?, 'member')",
    [channelId, userId1]
  );
  await pool.execute(
    "INSERT IGNORE INTO channel_members (channel_id, user_id, role) VALUES (?, ?, 'member')",
    [channelId, userId2]
  );

  console.log(`Created new DM channel ${channelId} between users ${userId1} and ${userId2}`);
  return { channelId, isNew: true };
}

// Helper function to send booking notification to a DM channel
async function sendBookingNotification(io, channelId, booking, creator, participant) {
  try {
    if (!io) {
      console.error("sendBookingNotification: Socket.io instance not provided!");
      return;
    }

    if (!channelId) {
      console.error("sendBookingNotification: Channel ID not provided!");
      return;
    }

    console.log(`sendBookingNotification called: channelId=${channelId}, bookingId=${booking.id}, creator=${creator.username}`);

    // Format time for display
    const startDate = new Date(booking.start_time);
    const endDate = new Date(booking.end_time);
    
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    
    const startTimeStr = startDate.toLocaleTimeString('en-US', timeOptions);
    const endTimeStr = endDate.toLocaleTimeString('en-US', timeOptions);
    const dateStr = startDate.toLocaleDateString('en-GB', dateOptions);
    
    // Build participant mentions
    const allParticipants = booking.participantDetails || [];
    const participantMentions = allParticipants
      .filter(p => p && p.id && p.id !== creator.id && p.username)
      .map(p => `@${p.username}`)
      .join(' and ');

    // Create booking notification message
    const bookingMessage = {
      room_name: booking.room_name,
      booked_by: creator.username,
      purpose: booking.purpose,
      description: booking.description,
      start_time: startTimeStr,
      end_time: endTimeStr,
      date: dateStr,
      participants: participantMentions || '',
      booking_id: booking.id,
    };

    console.log(`Inserting booking message into database: channelId=${channelId}, bookingId=${booking.id}`);

    // Insert message into database
    const [messageResult] = await pool.execute(
      `INSERT INTO messages
          (user_id, username, message, message_type, channel_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        creator.id,
        creator.username,
        JSON.stringify(bookingMessage),
        "room_booking",
        channelId,
      ]
    );

    const messageId = messageResult.insertId;
    console.log(`Booking message inserted with ID: ${messageId}`);

    // Fetch the complete message
    const [messageRows] = await pool.execute(
      `SELECT id, user_id, username, message, message_type, channel_id, created_at
       FROM messages WHERE id = ? LIMIT 1`,
      [messageId]
    );

    if (messageRows.length > 0) {
      const message = messageRows[0];
      
      console.log(`Emitting receive_message event for booking message ${messageId} in channel ${channelId}`);
      
      // Broadcast the message via socket
      io.emit("receive_message", {
        ...message,
        channel_id: channelId,
        channelId: channelId,
      });
      
      console.log(`✓ Successfully sent booking notification message ${messageId}`);
    } else {
      console.error(`Failed to fetch inserted message ${messageId}`);
    }
  } catch (error) {
    console.error("Error sending booking notification:", error);
    console.error("Error stack:", error.stack);
    // Don't throw - notification failure shouldn't break booking creation
  }
}

export default async function handler(req, res) {
  const user = authenticateToken(req, res);
  if (!user) return;

  await ensureBookingsSchema();

  if (req.method === "GET") {
    try {
      const { room_id, user_id, status, start_date, end_date, upcoming_only } = req.query;
      
      let query = `
        SELECT b.*, r.name as room_name, r.floor, r.capacity,
               u.username as booked_by,
               b.participants as participants_json
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        JOIN users u ON b.user_id = u.id
        WHERE 1=1
      `;
      const params = [];

      if (room_id) {
        query += " AND b.room_id = ?";
        params.push(room_id);
      }

      if (user_id) {
        query += " AND b.user_id = ?";
        params.push(user_id);
      }

      if (status) {
        query += " AND b.status = ?";
        params.push(status);
      } else {
        // Default: exclude cancelled and completed
        query += " AND b.status = 'confirmed'";
      }

      if (start_date) {
        query += " AND b.end_time >= ?";
        params.push(start_date);
      }

      if (end_date) {
        query += " AND b.start_time <= ?";
        params.push(end_date);
      }

      if (upcoming_only === "true") {
        query += " AND b.start_time >= NOW()";
      }

      query += " ORDER BY b.start_time ASC";

      const [bookings] = await pool.execute(query, params);
      
      // Parse JSON fields and fetch participant details
      const parsedBookings = await Promise.all(
        bookings.map(async (booking) => {
          let participants = [];
          let participantDetails = [];
          
          // Parse participants JSON field
          if (booking.participants_json) {
            try {
              // Handle case where participants_json might already be an array or a string
              let parsed;
              if (typeof booking.participants_json === 'string') {
                parsed = JSON.parse(booking.participants_json);
              } else if (Array.isArray(booking.participants_json)) {
                parsed = booking.participants_json;
              } else {
                parsed = booking.participants_json;
              }
              
              if (Array.isArray(parsed)) {
                participants = parsed
                  .filter(id => id != null && !isNaN(id))
                  .map(id => Number(id))
                  .filter(id => id > 0);
              } else if (parsed != null) {
                const numId = Number(parsed);
                if (!isNaN(numId) && numId > 0) {
                  participants = [numId];
                }
              }
              
              // Fetch participant user details from users table
              if (participants.length > 0) {
                try {
                  const placeholders = participants.map(() => "?").join(",");
                  const [participantUsers] = await pool.execute(
                    `SELECT id, username, email FROM users WHERE id IN (${placeholders})`,
                    participants
                  );
                  participantDetails = Array.isArray(participantUsers) ? participantUsers : [];
                } catch (dbError) {
                  console.error("Error fetching participant details:", dbError);
                  participantDetails = [];
                }
              }
            } catch (e) {
              console.error("Error parsing participants JSON:", e, {
                participants_json: booking.participants_json,
                type: typeof booking.participants_json
              });
              // Set empty arrays on error
              participants = [];
              participantDetails = [];
            }
          }
          
          return {
            ...booking,
            participants: participants,
            participantDetails: participantDetails,
            amenities: booking.amenities ? (() => {
              try {
                return JSON.parse(booking.amenities);
              } catch {
                return null;
              }
            })() : null,
          };
        })
      );

      return res.status(200).json({ bookings: parsedBookings });
    } catch (error) {
      console.error("Fetch bookings error:", error);
      return res.status(500).json({ error: "Failed to fetch bookings" });
    }
  }

  if (req.method === "POST") {
    try {
      const { room_id, purpose, description, start_time, end_time, participants } = req.body;

      if (!room_id || !purpose || !start_time || !end_time) {
        return res.status(400).json({ error: "Room, purpose, start time, and end time are required" });
      }

      // Validate time range
      const start = new Date(start_time);
      const end = new Date(end_time);
      
      if (start >= end) {
        return res.status(400).json({ error: "End time must be after start time" });
      }

      if (start < new Date()) {
        return res.status(400).json({ error: "Cannot book rooms in the past" });
      }

      // Format datetime for MySQL
      const formattedStartTime = formatDateTimeForMySQL(start_time);
      const formattedEndTime = formatDateTimeForMySQL(end_time);

      // Check if room is available (use formatted times for comparison)
      const available = await isRoomAvailable(room_id, formattedStartTime, formattedEndTime);
      if (!available) {
        return res.status(400).json({ error: "Room is not available for the selected time slot" });
      }

      // Create booking
      const [result] = await pool.execute(
        `INSERT INTO bookings (room_id, user_id, purpose, description, start_time, end_time, participants)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          room_id,
          user.id,
          purpose,
          description || null,
          formattedStartTime,
          formattedEndTime,
          participants ? JSON.stringify(participants) : null,
        ]
      );

      const [newBooking] = await pool.execute(
        `SELECT b.*, r.name as room_name, r.floor, r.capacity,
                u.username as booked_by,
                b.participants as participants_json
         FROM bookings b
         JOIN rooms r ON b.room_id = r.id
         JOIN users u ON b.user_id = u.id
         WHERE b.id = ?`,
        [result.insertId]
      );

      const bookingData = newBooking[0];
      let parsedParticipants = [];
      let participantDetails = [];
      
      if (bookingData.participants_json) {
        try {
          const parsed = JSON.parse(bookingData.participants_json);
          // Ensure it's an array and convert all to numbers
          if (Array.isArray(parsed)) {
            parsedParticipants = parsed
              .map(id => Number(id))
              .filter(id => !isNaN(id) && id > 0);
          } else if (parsed != null) {
            parsedParticipants = [Number(parsed)].filter(id => !isNaN(id) && id > 0);
          }
          
          // Fetch participant user details from users table
          if (parsedParticipants.length > 0) {
            try {
              const placeholders = parsedParticipants.map(() => "?").join(",");
              const [participantUsers] = await pool.execute(
                `SELECT id, username, email FROM users WHERE id IN (${placeholders})`,
                parsedParticipants
              );
              participantDetails = Array.isArray(participantUsers) ? participantUsers : [];
            } catch (dbError) {
              console.error("Error fetching participant details:", dbError);
              participantDetails = [];
            }
          }
        } catch (e) {
          console.error("Error parsing participants JSON:", e, bookingData.participants_json);
        }
      }

      const booking = {
        ...bookingData,
        participants: parsedParticipants,
        participantDetails: participantDetails,
      };

      // Debug log to verify participant details are fetched
      console.log('Create Booking - Debug:', {
        bookingId: booking.id,
        participantIds: parsedParticipants,
        participantDetailsCount: participantDetails.length,
        participantDetails: participantDetails.map(p => ({ id: p.id, username: p.username })),
        hasSocketIO: !!res.socket?.server?.io
      });

      // Send booking notifications to all participants via DM
      // Always send notifications, even if there are no participants (send to creator's own DM)
      try {
        // Get socket.io instance - try both res and req
        const io = res.socket?.server?.io || req.socket?.server?.io;
        if (!io) {
          console.error("❌ Socket.io not available - booking notifications will not be sent!");
          console.error("Socket.io check:", {
            hasResSocket: !!res.socket,
            hasResServer: !!res.socket?.server,
            hasResIO: !!res.socket?.server?.io,
            hasReqSocket: !!req.socket,
            hasReqServer: !!req.socket?.server,
            hasReqIO: !!req.socket?.server?.io
          });
        } else {
          const creator = {
            id: user.id,
            username: user.username,
          };

          const processedDMs = new Set(); // To avoid sending duplicate messages in the same DM

          // If there are participants, send notification to each participant's DM
          if (parsedParticipants.length > 0) {
            // Retry fetching participant details if empty
            if (participantDetails.length === 0) {
              console.warn(`⚠️ ${parsedParticipants.length} participants specified but 0 participant details fetched. Retrying...`);
              try {
                const placeholders = parsedParticipants.map(() => "?").join(",");
                const [retryParticipantUsers] = await pool.execute(
                  `SELECT id, username, email FROM users WHERE id IN (${placeholders})`,
                  parsedParticipants
                );
                participantDetails = Array.isArray(retryParticipantUsers) ? retryParticipantUsers : [];
                console.log(`Retry fetched ${participantDetails.length} participant details`);
              } catch (retryError) {
                console.error("Retry fetch failed:", retryError);
              }
            }

            if (participantDetails.length > 0) {
              console.log(`✅ Sending booking notifications to ${participantDetails.length} participants`);

            // Send notification to each participant's DM with the creator
            for (const participant of participantDetails) {
              try {
                if (!participant || !participant.id || !participant.username) {
                  console.warn(`Skipping invalid participant:`, participant);
                  continue;
                }

                // Find or create DM channel between creator and participant
                const { channelId: dmChannelId, isNew: isNewChannel } = await findOrCreateDMChannel(
                  creator.id,
                  participant.id,
                  creator.username,
                  participant.username
                );

                if (!dmChannelId) {
                  console.error(`Failed to create/find DM channel for participant ${participant.id}`);
                  continue;
                }

                // If this is a new channel, broadcast the new channel to both users via socket
                if (isNewChannel) {
                  try {
                    // Fetch the complete channel data
                    const [channelData] = await pool.execute(
                      `SELECT c.*, 
                       (SELECT role FROM channel_members WHERE channel_id = c.id AND user_id = ?) as role
                       FROM channels c
                       WHERE c.id = ?`,
                      [creator.id, dmChannelId]
                    );

                    if (channelData.length > 0) {
                      const channel = channelData[0];
                      // Parse topic if it's a string
                      if (typeof channel.topic === 'string') {
                        try {
                          channel.topic = JSON.parse(channel.topic);
                        } catch (e) {
                          // Keep as string if parsing fails
                        }
                      }

                      // Get member IDs for this channel
                      const [memberRows] = await pool.execute(
                        "SELECT user_id FROM channel_members WHERE channel_id = ?",
                        [dmChannelId]
                      );
                      const memberIds = memberRows.map(row => row.user_id);

                      // Emit channel:created event to both users
                      io.emit("channel:created", {
                        channel: {
                          ...channel,
                          role: channel.role || 'member'
                        },
                        memberIds: memberIds,
                        userId: creator.id, // Emit to creator
                      });
                      io.emit("channel:created", {
                        channel: {
                          ...channel,
                          role: 'member' // Participant gets member role
                        },
                        memberIds: memberIds,
                        userId: participant.id, // Emit to participant
                      });

                      console.log(`✓ Broadcasted new DM channel ${dmChannelId} to users ${creator.id} and ${participant.id}`);
                    }
                  } catch (broadcastError) {
                    console.error(`Error broadcasting new channel ${dmChannelId}:`, broadcastError);
                    // Continue with sending booking message even if broadcast fails
                  }
                }

                // Send booking notification message (both users in DM will see it)
                // This works for both existing and newly created DMs
                if (!processedDMs.has(dmChannelId)) {
                  await sendBookingNotification(
                    io,
                    dmChannelId,
                    booking,
                    creator,
                    participant
                  );
                  processedDMs.add(dmChannelId);
                  console.log(`✓ Sent booking notification to participant ${participant.id} (${participant.username}) in DM channel ${dmChannelId}${isNewChannel ? ' (new channel)' : ' (existing channel)'}`);
                } else {
                  console.log(`Skipping duplicate notification for channel ${dmChannelId}`);
                }
              } catch (dmError) {
                console.error(`Error processing participant ${participant.id}:`, dmError);
                console.error("DM Error details:", {
                  participant: participant,
                  error: dmError.message,
                  stack: dmError.stack
                });
                // Continue with other participants even if one fails
              }
            }
            } else {
              console.error(`❌ Cannot send notifications: ${parsedParticipants.length} participants specified but 0 participant details available after retry`);
            }
          } else {
            console.log(`ℹ️ No participants specified for booking ${booking.id}`);
          }

          // Note: We don't send to creator's own DM anymore since the booking message
          // is already sent to all participant DMs (which the creator is part of)
        }
      } catch (notificationError) {
        console.error("Error sending booking notifications:", notificationError);
        console.error("Notification error stack:", notificationError.stack);
        // Don't fail the booking creation if notifications fail
      }

      return res.status(201).json({ booking });
    } catch (error) {
      console.error("Create booking error:", error);
      return res.status(500).json({ error: "Failed to create booking" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

