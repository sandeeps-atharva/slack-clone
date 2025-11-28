import pool from "@/utils/db";
import { authenticateToken } from "@/utils/auth";

// Helper function to find or create a DM channel between two users
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
    return existingDMs[0].id;
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
    return existingSlug[0].id;
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

  return channelId;
}

// Helper function to send booking notification to a DM channel
async function sendBookingNotification(io, channelId, booking, creator, participant) {
  try {
    // Format time for display
    const startDate = new Date(booking.start_time);
    const endDate = new Date(booking.end_time);
    
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    
    const startTimeStr = startDate.toLocaleTimeString('en-US', timeOptions);
    const endTimeStr = endDate.toLocaleTimeString('en-US', timeOptions);
    const dateStr = startDate.toLocaleDateString('en-GB', dateOptions);
    
    // Build participant mentions (excluding the current participant and creator)
    const allParticipants = booking.participantDetails || [];
    const participantMentions = allParticipants
      .filter(p => p.id !== creator.id && p.id !== participant.id)
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
      participants: participantMentions,
      booking_id: booking.id,
    };

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

    // Fetch the complete message
    const [messageRows] = await pool.execute(
      `SELECT id, user_id, username, message, message_type, channel_id, created_at
       FROM messages WHERE id = ? LIMIT 1`,
      [messageId]
    );

    if (messageRows.length > 0) {
      const message = messageRows[0];
      
      // Broadcast the message via socket
      if (io) {
        io.emit("receive_message", {
          ...message,
          channel_id: channelId,
          channelId: channelId,
        });
      }
    }
  } catch (error) {
    console.error("Error sending booking notification:", error);
    // Don't throw - notification failure shouldn't break booking update
  }
}

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

// Helper function to delete booking notification messages from chat
async function deleteBookingMessages(io, bookingId) {
  try {
    if (!bookingId) return;

    // Find all messages with room_booking type
    const [allBookingMessages] = await pool.execute(
      `SELECT id, channel_id, message
       FROM messages
       WHERE message_type = 'room_booking'`
    );

    // Filter messages that contain this booking_id
    const bookingIdNum = Number(bookingId);
    const bookingMessages = allBookingMessages.filter((msg) => {
      try {
        const messageData = typeof msg.message === 'string' 
          ? JSON.parse(msg.message) 
          : msg.message;
        if (!messageData || messageData.booking_id == null) return false;
        // Compare as numbers to handle type mismatches
        const msgBookingId = Number(messageData.booking_id);
        return !isNaN(msgBookingId) && !isNaN(bookingIdNum) && msgBookingId === bookingIdNum;
      } catch (e) {
        return false;
      }
    });

    if (bookingMessages.length === 0) {
      return; // No messages to delete
    }

    // Delete each message and broadcast deletion
    for (const msg of bookingMessages) {
      try {
        // First, find and delete any thread messages (replies) to this booking message
        const [threadMessages] = await pool.execute(
          "SELECT id, channel_id FROM messages WHERE thread_parent_id = ?",
          [msg.id]
        );

        // Delete thread messages first
        for (const threadMsg of threadMessages) {
          try {
            await pool.execute("DELETE FROM messages WHERE id = ?", [threadMsg.id]);
            // Broadcast thread message deletion
            if (io) {
              io.emit("message:delete", {
                id: threadMsg.id,
                channelId: threadMsg.channel_id,
                channel_id: threadMsg.channel_id,
              });
            }
          } catch (threadError) {
            console.error(`Error deleting thread message ${threadMsg.id}:`, threadError);
          }
        }

        // Delete the booking notification message
        await pool.execute("DELETE FROM messages WHERE id = ?", [msg.id]);

        // Broadcast the deletion via socket
        if (io) {
          io.emit("message:delete", {
            id: msg.id,
            channelId: msg.channel_id,
            channel_id: msg.channel_id,
          });
        }
      } catch (msgError) {
        console.error(`Error deleting booking message ${msg.id}:`, msgError);
        // Continue with other messages even if one fails
      }
    }
  } catch (error) {
    console.error("Error deleting booking messages:", error);
    // Don't throw - message deletion failure shouldn't break booking deletion
  }
}

// Helper function to update booking notification messages in chat
async function updateBookingMessages(io, booking, creator) {
  try {
    if (!booking || !booking.id) return;

    // Find all messages with room_booking type
    // We'll filter by booking_id after parsing the JSON
    const [allBookingMessages] = await pool.execute(
      `SELECT id, channel_id, message, user_id, username
       FROM messages
       WHERE message_type = 'room_booking'`
    );

    // Filter messages that contain this booking_id
    const bookingIdNum = Number(booking.id);
    const bookingMessages = allBookingMessages.filter((msg) => {
      try {
        const messageData = typeof msg.message === 'string' 
          ? JSON.parse(msg.message) 
          : msg.message;
        if (!messageData || messageData.booking_id == null) return false;
        // Compare as numbers to handle type mismatches
        const msgBookingId = Number(messageData.booking_id);
        return !isNaN(msgBookingId) && !isNaN(bookingIdNum) && msgBookingId === bookingIdNum;
      } catch (e) {
        return false;
      }
    });

    if (bookingMessages.length === 0) {
      return; // No messages to update
    }

    // Format time for display
    const startDate = new Date(booking.start_time);
    const endDate = new Date(booking.end_time);
    
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    
    const startTimeStr = startDate.toLocaleTimeString('en-US', timeOptions);
    const endTimeStr = endDate.toLocaleTimeString('en-US', timeOptions);
    const dateStr = startDate.toLocaleDateString('en-GB', dateOptions);
    
    // Build participant mentions
    // Ensure participantDetails is an array and has valid data
    let allParticipants = [];
    
    // Check if participantDetails is provided directly (preferred)
    if (Array.isArray(booking.participantDetails) && booking.participantDetails.length > 0) {
      allParticipants = booking.participantDetails;
      console.log('Using participantDetails from booking object:', allParticipants.length);
    } 
    // If participantDetails is not provided, fetch them from participants_json
    else if (booking.participants_json) {
      try {
        let parsed = booking.participants_json;
        // If it's a string, parse it
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
        
        // Handle both array and single value
        const participantIds = Array.isArray(parsed) 
          ? parsed.filter(id => id != null && !isNaN(id)).map(id => Number(id))
          : parsed != null ? [Number(parsed)].filter(id => !isNaN(id)) : [];
        
        console.log('Fetched participant IDs from participants_json:', participantIds);
        
        if (participantIds.length > 0) {
          const placeholders = participantIds.map(() => "?").join(",");
          const [participantUsers] = await pool.execute(
            `SELECT id, username, email FROM users WHERE id IN (${placeholders})`,
            participantIds
          );
          allParticipants = Array.isArray(participantUsers) ? participantUsers : [];
          console.log('Fetched participant details from database:', allParticipants.length);
        }
      } catch (e) {
        console.error("Error parsing participants_json in updateBookingMessages:", e, booking.participants_json);
      }
    }
    
    // Debug log to see what participants we have
    console.log('Update Booking Messages - Final Debug:', {
      bookingId: booking.id,
      hasParticipantDetails: !!booking.participantDetails,
      participantDetailsType: typeof booking.participantDetails,
      participantDetailsIsArray: Array.isArray(booking.participantDetails),
      hasParticipantsJson: !!booking.participants_json,
      participantsJsonType: typeof booking.participants_json,
      participantCount: allParticipants.length,
      participants: allParticipants.map(p => ({ id: p.id, username: p.username })),
      creatorId: creator.id,
      creatorUsername: creator.username
    });
    
    // Filter out the creator and build mentions
    const filteredParticipants = allParticipants.filter(p => {
      const isValid = p && p.id && p.id !== creator.id && p.username;
      if (!isValid && p) {
        console.log('Filtered out participant:', { id: p.id, username: p.username, reason: !p.id ? 'no id' : p.id === creator.id ? 'is creator' : !p.username ? 'no username' : 'unknown' });
      }
      return isValid;
    });
    
    const participantMentions = filteredParticipants
      .map(p => `@${p.username}`)
      .join(' and ');
    
    console.log('Update Booking Messages - Participant Mentions Result:', {
      filteredCount: filteredParticipants.length,
      mentions: participantMentions || '(none)',
      mentionString: participantMentions
    });

    // Create updated booking notification message
    const updatedBookingMessage = {
      room_name: booking.room_name,
      booked_by: creator.username,
      purpose: booking.purpose,
      description: booking.description,
      start_time: startTimeStr,
      end_time: endTimeStr,
      date: dateStr,
      participants: participantMentions || '', // Ensure it's always a string, even if empty
      booking_id: booking.id,
    };

    console.log('Updated Booking Message Object:', {
      participants: updatedBookingMessage.participants,
      participantsLength: updatedBookingMessage.participants.length,
      participantsType: typeof updatedBookingMessage.participants,
      allKeys: Object.keys(updatedBookingMessage)
    });

    // Update each message
    for (const msg of bookingMessages) {
      try {
        const messageJson = JSON.stringify(updatedBookingMessage);
        console.log(`Updating message ${msg.id} with JSON:`, messageJson);
        
        // Update the message in database
        await pool.execute(
          `UPDATE messages
           SET message = ?
           WHERE id = ?`,
          [messageJson, msg.id]
        );

        // Verify the update was successful
        const [verifyMsg] = await pool.execute(
          `SELECT message FROM messages WHERE id = ?`,
          [msg.id]
        );
        
        if (verifyMsg.length > 0) {
          let savedMessage = verifyMsg[0].message;
          if (typeof savedMessage === 'string') {
            try {
              savedMessage = JSON.parse(savedMessage);
            } catch (e) {
              console.error(`Error parsing saved message for ${msg.id}:`, e);
            }
          }
          console.log(`Verified saved message ${msg.id} participants:`, savedMessage?.participants || 'N/A');
        }

        // Fetch the updated message with all fields
        const [updatedMsg] = await pool.execute(
          `SELECT id, user_id, username, message, message_type, channel_id, created_at
           FROM messages WHERE id = ? LIMIT 1`,
          [msg.id]
        );

        if (updatedMsg.length > 0 && io) {
          const updatedMessage = updatedMsg[0];
          
          // Parse the message field if it's a string (for JSON booking data)
          let parsedMessage = updatedMessage.message;
          if (typeof parsedMessage === 'string') {
            try {
              parsedMessage = JSON.parse(parsedMessage);
              console.log(`Parsed message ${msg.id} participants:`, parsedMessage?.participants || 'N/A');
            } catch (e) {
              console.error(`Error parsing message ${msg.id}:`, e);
              // If parsing fails, keep the string
            }
          }
          
          // Broadcast the updated message via socket with parsed message
          const channelId = updatedMessage.channel_id;
          
          // Ensure the parsed message has the correct structure
          const socketMessage = {
            ...updatedMessage,
            message: parsedMessage,
            message_type: updatedMessage.message_type || 'room_booking',
            channel_id: channelId,
            channelId: channelId,
          };
          
          console.log(`Emitting message:edit for message ${msg.id}:`, {
            channelId: channelId,
            participants: parsedMessage?.participants || '(none)',
            participantsType: typeof parsedMessage?.participants,
            messageType: socketMessage.message_type
          });
          
          // Emit to the specific channel to ensure all users in that channel receive the update
          io.to(`channel:${channelId}`).emit("message:edit", socketMessage);
          
          // Also emit globally as fallback (some clients might not be in the channel room)
          io.emit("message:edit", socketMessage);
        }
      } catch (msgError) {
        console.error(`Error updating booking message ${msg.id}:`, msgError);
        // Continue with other messages even if one fails
      }
    }
  } catch (error) {
    console.error("Error updating booking messages:", error);
    // Don't throw - message update failure shouldn't break booking update
  }
}

export default async function handler(req, res) {
  const user = authenticateToken(req, res);
  if (!user) return;

  const { bookingId } = req.query;

  if (req.method === "GET") {
    try {
      const [bookings] = await pool.execute(
        `SELECT b.*, r.name as room_name, r.floor, r.capacity,
                u.username as booked_by,
                b.participants as participants_json
         FROM bookings b
         JOIN rooms r ON b.room_id = r.id
         JOIN users u ON b.user_id = u.id
         WHERE b.id = ?`,
        [bookingId]
      );

      if (bookings.length === 0) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const bookingData = bookings[0];
      let participants = [];
      let participantDetails = [];
      
      if (bookingData.participants_json) {
        try {
          participants = JSON.parse(bookingData.participants_json);
          if (Array.isArray(participants) && participants.length > 0) {
            // Fetch participant user details
            const placeholders = participants.map(() => "?").join(",");
            const [participantUsers] = await pool.execute(
              `SELECT id, username, email FROM users WHERE id IN (${placeholders})`,
              participants
            );
            participantDetails = participantUsers;
          }
        } catch (e) {
          console.error("Error parsing participants:", e);
        }
      }

      const booking = {
        ...bookingData,
        participants: participants,
        participantDetails: participantDetails,
      };

      return res.status(200).json({ booking });
    } catch (error) {
      console.error("Fetch booking error:", error);
      return res.status(500).json({ error: "Failed to fetch booking" });
    }
  }

  if (req.method === "PUT") {
    try {
      const { room_id, purpose, description, start_time, end_time, participants, status } = req.body;

      // Get existing booking
      const [existing] = await pool.execute("SELECT * FROM bookings WHERE id = ?", [bookingId]);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const booking = existing[0];

      // Check if user owns the booking or is admin (you can add admin check later)
      if (booking.user_id !== user.id) {
        return res.status(403).json({ error: "You can only edit your own bookings" });
      }

      // Get old participants to detect newly added ones
      let oldParticipantIds = [];
      if (booking.participants) {
        try {
          const parsed = JSON.parse(booking.participants);
          oldParticipantIds = Array.isArray(parsed) 
            ? parsed.map(id => Number(id)).filter(id => !isNaN(id))
            : parsed != null ? [Number(parsed)].filter(id => !isNaN(id)) : [];
        } catch (e) {
          console.error("Error parsing old participants:", e);
        }
      }

      // If updating time or room, check availability
      if ((start_time || end_time || room_id) && status !== "cancelled") {
        const checkRoomId = room_id || booking.room_id;
        const checkStartTime = start_time || booking.start_time;
        const checkEndTime = end_time || booking.end_time;

        const start = new Date(checkStartTime);
        const end = new Date(checkEndTime);
        const now = new Date();
        
        if (start >= end) {
          return res.status(400).json({ error: "End time must be after start time" });
        }

        // Only validate "cannot book in past" if start time is being changed
        // Allow extending meetings (updating only end time) even if start time is in the past
        const isStartTimeChanged = start_time && 
          new Date(booking.start_time).getTime() !== start.getTime();
        
        if (isStartTimeChanged && start < now) {
          return res.status(400).json({ error: "Cannot book rooms in the past" });
        }
        
        // If only extending (end time changed), ensure end time is in the future
        if (!isStartTimeChanged && end_time && end < now) {
          return res.status(400).json({ error: "End time must be in the future" });
        }

        // Format datetime for MySQL
        const formattedStartTime = formatDateTimeForMySQL(checkStartTime);
        const formattedEndTime = formatDateTimeForMySQL(checkEndTime);

        const available = await isRoomAvailable(checkRoomId, formattedStartTime, formattedEndTime, bookingId);
        if (!available) {
          return res.status(400).json({ error: "Room is not available for the selected time slot" });
        }
      }

      // Build update query
      const updateFields = [];
      const updateValues = [];

      if (room_id !== undefined) {
        updateFields.push("room_id = ?");
        updateValues.push(room_id);
      }
      if (purpose !== undefined) {
        updateFields.push("purpose = ?");
        updateValues.push(purpose);
      }
      if (description !== undefined) {
        updateFields.push("description = ?");
        updateValues.push(description);
      }
      if (start_time !== undefined) {
        updateFields.push("start_time = ?");
        updateValues.push(formatDateTimeForMySQL(start_time));
      }
      if (end_time !== undefined) {
        updateFields.push("end_time = ?");
        updateValues.push(formatDateTimeForMySQL(end_time));
      }
      if (participants !== undefined) {
        updateFields.push("participants = ?");
        updateValues.push(participants ? JSON.stringify(participants) : null);
      }
      if (status !== undefined) {
        updateFields.push("status = ?");
        updateValues.push(status);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      updateValues.push(bookingId);
      await pool.execute(
        `UPDATE bookings SET ${updateFields.join(", ")} WHERE id = ?`,
        updateValues
      );

      const [updated] = await pool.execute(
        `SELECT b.*, r.name as room_name, r.floor, r.capacity,
                u.username as booked_by,
                b.participants as participants_json
         FROM bookings b
         JOIN rooms r ON b.room_id = r.id
         JOIN users u ON b.user_id = u.id
         WHERE b.id = ?`,
        [bookingId]
      );

      const updatedData = updated[0];
      let parsedParticipants = [];
      let participantDetails = [];
      
      if (updatedData.participants_json) {
        try {
          const parsed = JSON.parse(updatedData.participants_json);
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
          console.error("Error parsing participants JSON:", e, updatedData.participants_json);
        }
      }

      const updatedBooking = {
        ...updatedData,
        participants: parsedParticipants,
        participantDetails: participantDetails,
      };

      // Debug log to verify participant details are fetched
      console.log('Update Booking - Full Debug:', {
        bookingId: bookingId,
        parsedParticipants: parsedParticipants,
        participantDetailsCount: participantDetails.length,
        participantDetails: participantDetails,
        hasParticipantDetails: !!participantDetails,
        participantDetailsType: typeof participantDetails,
        participantDetailsIsArray: Array.isArray(participantDetails)
      });

      // Detect newly added participants (only if participants were updated)
      const newParticipantIds = participants !== undefined 
        ? (Array.isArray(participants) 
            ? participants.map(id => Number(id)).filter(id => !isNaN(id) && id > 0)
            : [])
        : oldParticipantIds; // If participants weren't updated, use old list
      
      const newlyAddedParticipantIds = participants !== undefined
        ? newParticipantIds.filter(newId => !oldParticipantIds.includes(newId))
        : [];

      console.log('Participant Changes:', {
        oldParticipantIds,
        newParticipantIds,
        newlyAddedParticipantIds,
        participantsWereUpdated: participants !== undefined
      });

      // Update booking notification messages in chat
      try {
        const io = res.socket?.server?.io;
        if (io) {
          const creator = {
            id: user.id,
            username: user.username,
          };
          // Ensure participantDetails is passed correctly
          console.log('Calling updateBookingMessages with:', {
            bookingId: updatedBooking.id,
            participantDetails: updatedBooking.participantDetails,
            participantDetailsLength: updatedBooking.participantDetails?.length || 0
          });
          await updateBookingMessages(io, updatedBooking, creator);

          // Send booking notification messages to newly added participants
          if (newlyAddedParticipantIds.length > 0 && participantDetails.length > 0) {
            const newlyAddedParticipants = participantDetails.filter(p => 
              newlyAddedParticipantIds.includes(Number(p.id))
            );

            console.log('Sending notifications to newly added participants:', {
              count: newlyAddedParticipants.length,
              participants: newlyAddedParticipants.map(p => ({ id: p.id, username: p.username }))
            });

            // Send notification to each newly added participant
            for (const newParticipant of newlyAddedParticipants) {
              try {
                // Create or find DM channel between creator and new participant
                const dmChannelId = await findOrCreateDMChannel(
                  creator.id,
                  newParticipant.id,
                  creator.username,
                  newParticipant.username
                );

                if (dmChannelId) {
                  // Send booking notification to the DM
                  await sendBookingNotification(
                    io,
                    dmChannelId,
                    updatedBooking,
                    creator,
                    newParticipant
                  );
                  console.log(`Sent booking notification to participant ${newParticipant.id} (${newParticipant.username}) in DM channel ${dmChannelId}`);
                }
              } catch (notifError) {
                console.error(`Error sending notification to participant ${newParticipant.id}:`, notifError);
                // Continue with other participants even if one fails
              }
            }
          }
        }
      } catch (messageUpdateError) {
        console.error("Error updating booking messages:", messageUpdateError);
        // Don't fail the booking update if message update fails
      }

      return res.status(200).json({ booking: updatedBooking });
    } catch (error) {
      console.error("Update booking error:", error);
      return res.status(500).json({ error: "Failed to update booking" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const [existing] = await pool.execute("SELECT * FROM bookings WHERE id = ?", [bookingId]);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const booking = existing[0];

      // Check if user owns the booking
      if (booking.user_id !== user.id) {
        return res.status(403).json({ error: "You can only cancel your own bookings" });
      }

      // Soft delete by setting status to cancelled
      await pool.execute("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [bookingId]);

      // Delete booking notification messages from chat
      try {
        const io = res.socket?.server?.io;
        if (io) {
          await deleteBookingMessages(io, bookingId);
        }
      } catch (messageDeleteError) {
        console.error("Error deleting booking messages:", messageDeleteError);
        // Don't fail the booking deletion if message deletion fails
      }

      return res.status(200).json({ message: "Booking cancelled successfully" });
    } catch (error) {
      console.error("Cancel booking error:", error);
      return res.status(500).json({ error: "Failed to cancel booking" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

