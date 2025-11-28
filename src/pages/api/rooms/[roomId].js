import pool from "@/utils/db";
import { authenticateToken } from "@/utils/auth";

// Helper function to update booking messages when room details change
async function updateRoomBookingMessages(io, roomId, roomData) {
  try {
    if (!roomId) return;

    // Find all bookings for this room
    const [bookings] = await pool.execute(
      `SELECT b.*, r.name as room_name, r.floor, r.capacity,
              u.username as booked_by,
              b.participants as participants_json
       FROM bookings b
       JOIN rooms r ON b.room_id = r.id
       JOIN users u ON b.user_id = u.id
       WHERE b.room_id = ? AND b.status = 'confirmed'`,
      [roomId]
    );

    if (bookings.length === 0) {
      return; // No bookings to update
    }

    // Get updated room info
    const [updatedRoom] = await pool.execute(
      "SELECT * FROM rooms WHERE id = ?",
      [roomId]
    );
    
    if (updatedRoom.length === 0) return;
    
    const room = updatedRoom[0];
    const newRoomName = room.name;
    const newFloor = room.floor;
    const newCapacity = room.capacity;

    // Find all messages with room_booking type for this room's bookings
    const [allBookingMessages] = await pool.execute(
      `SELECT id, channel_id, message, user_id, username
       FROM messages
       WHERE message_type = 'room_booking'`
    );

    // Process each booking
    for (const booking of bookings) {
      const bookingIdNum = Number(booking.id);
      
      // Filter messages that contain this booking_id
      const bookingMessages = allBookingMessages.filter((msg) => {
        try {
          const messageData = typeof msg.message === 'string' 
            ? JSON.parse(msg.message) 
            : msg.message;
          if (!messageData || messageData.booking_id == null) return false;
          const msgBookingId = Number(messageData.booking_id);
          return !isNaN(msgBookingId) && !isNaN(bookingIdNum) && msgBookingId === bookingIdNum;
        } catch (e) {
          return false;
        }
      });

      if (bookingMessages.length === 0) continue;

      // Parse participant details
      let participantDetails = [];
      if (booking.participants_json) {
        try {
          const parsed = JSON.parse(booking.participants_json);
          const participantIds = Array.isArray(parsed) 
            ? parsed.filter(id => id != null && !isNaN(id)).map(id => Number(id))
            : [Number(parsed)].filter(id => !isNaN(id));
          
          if (participantIds.length > 0) {
            const placeholders = participantIds.map(() => "?").join(",");
            const [participantUsers] = await pool.execute(
              `SELECT id, username, email FROM users WHERE id IN (${placeholders})`,
              participantIds
            );
            participantDetails = Array.isArray(participantUsers) ? participantUsers : [];
          }
        } catch (e) {
          console.error("Error parsing participants:", e);
        }
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
      const creator = { id: booking.user_id, username: booking.booked_by };
      const participantMentions = participantDetails
        .filter(p => p.id !== creator.id)
        .map(p => `@${p.username}`)
        .join(' and ');

      // Create updated booking notification message
      const updatedBookingMessage = {
        room_name: newRoomName,
        booked_by: booking.booked_by,
        purpose: booking.purpose,
        description: booking.description,
        start_time: startTimeStr,
        end_time: endTimeStr,
        date: dateStr,
        participants: participantMentions,
        booking_id: booking.id,
      };

      // Update each message
      for (const msg of bookingMessages) {
        try {
          // Update the message in database
          await pool.execute(
            `UPDATE messages SET message = ? WHERE id = ?`,
            [JSON.stringify(updatedBookingMessage), msg.id]
          );

          // Fetch the updated message
          const [updatedMsg] = await pool.execute(
            `SELECT id, user_id, username, message, message_type, channel_id, created_at
             FROM messages WHERE id = ? LIMIT 1`,
            [msg.id]
          );

          // Emit socket event to update the message in real-time
          if (io && updatedMsg.length > 0) {
            const updatedMessage = updatedMsg[0];
            // Emit message:edit event (same as booking updates) to trigger client-side update
            io.emit("message:edit", {
              ...updatedMessage,
              channel_id: updatedMessage.channel_id,
              channelId: updatedMessage.channel_id,
            });
          }
        } catch (msgError) {
          console.error(`Error updating booking message ${msg.id}:`, msgError);
          // Continue with other messages even if one fails
        }
      }
    }
  } catch (error) {
    console.error("Error updating room booking messages:", error);
  }
}

export default async function handler(req, res) {
  const user = authenticateToken(req, res);
  if (!user) return;

  const { roomId } = req.query;

  if (req.method === "GET") {
    try {
      const [rooms] = await pool.execute("SELECT * FROM rooms WHERE id = ?", [roomId]);
      if (rooms.length === 0) {
        return res.status(404).json({ error: "Room not found" });
      }
      return res.status(200).json({ room: rooms[0] });
    } catch (error) {
      console.error("Fetch room error:", error);
      return res.status(500).json({ error: "Failed to fetch room" });
    }
  }

  if (req.method === "PUT") {
    try {
      const { name, description, capacity, amenities, floor, is_active } = req.body;

      const [existing] = await pool.execute("SELECT * FROM rooms WHERE id = ?", [roomId]);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Room not found" });
      }

      const updateFields = [];
      const updateValues = [];

      if (name !== undefined) {
        updateFields.push("name = ?");
        updateValues.push(name);
      }
      if (description !== undefined) {
        updateFields.push("description = ?");
        updateValues.push(description);
      }
      if (capacity !== undefined) {
        updateFields.push("capacity = ?");
        updateValues.push(capacity);
      }
      if (amenities !== undefined) {
        updateFields.push("amenities = ?");
        updateValues.push(amenities ? JSON.stringify(amenities) : null);
      }
      if (floor !== undefined) {
        updateFields.push("floor = ?");
        updateValues.push(floor);
      }
      if (is_active !== undefined) {
        updateFields.push("is_active = ?");
        updateValues.push(is_active ? 1 : 0);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      updateValues.push(roomId);
      await pool.execute(
        `UPDATE rooms SET ${updateFields.join(", ")} WHERE id = ?`,
        updateValues
      );

      const [updated] = await pool.execute("SELECT * FROM rooms WHERE id = ?", [roomId]);
      const updatedRoom = updated[0];

      // Update booking messages if room name, floor, or capacity changed
      const oldRoom = existing[0];
      const roomNameChanged = name !== undefined && name !== oldRoom.name;
      const floorChanged = floor !== undefined && floor !== oldRoom.floor;
      const capacityChanged = capacity !== undefined && capacity !== oldRoom.capacity;

      if (roomNameChanged || floorChanged || capacityChanged) {
        try {
          const io = res.socket?.server?.io;
          if (io) {
            await updateRoomBookingMessages(io, roomId, updatedRoom);
          }
        } catch (messageUpdateError) {
          console.error("Error updating booking messages:", messageUpdateError);
          // Don't fail the room update if message update fails
        }
      }

      return res.status(200).json({ room: updatedRoom });
    } catch (error) {
      console.error("Update room error:", error);
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ error: "Room name already exists" });
      }
      return res.status(500).json({ error: "Failed to update room" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const [existing] = await pool.execute("SELECT * FROM rooms WHERE id = ?", [roomId]);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Room not found" });
      }

      // Check for active bookings
      const [activeBookings] = await pool.execute(
        `SELECT COUNT(*) as count FROM bookings 
         WHERE room_id = ? AND status = 'confirmed' 
         AND end_time > NOW()`,
        [roomId]
      );

      const hasActiveBookings = activeBookings[0].count > 0;

      if (hasActiveBookings) {
        // Cancel all future bookings for this room
        await pool.execute(
          `UPDATE bookings SET status = 'cancelled' 
           WHERE room_id = ? AND status = 'confirmed' AND end_time > NOW()`,
          [roomId]
        );

        // Update booking messages to reflect cancellation
        try {
          const io = res.socket?.server?.io;
          if (io) {
            // Import the delete booking messages function logic or call it
            const [bookings] = await pool.execute(
              `SELECT id FROM bookings WHERE room_id = ? AND status = 'cancelled' AND end_time > NOW()`,
              [roomId]
            );
            
            for (const booking of bookings) {
              // Find and delete booking messages
              const [allBookingMessages] = await pool.execute(
                `SELECT id, channel_id FROM messages WHERE message_type = 'room_booking'`
              );
              
              const bookingIdNum = Number(booking.id);
              const messagesToDelete = allBookingMessages.filter((msg) => {
                try {
                  const messageData = typeof msg.message === 'string' 
                    ? JSON.parse(msg.message) 
                    : msg.message;
                  if (!messageData || messageData.booking_id == null) return false;
                  const msgBookingId = Number(messageData.booking_id);
                  return !isNaN(msgBookingId) && !isNaN(bookingIdNum) && msgBookingId === bookingIdNum;
                } catch (e) {
                  return false;
                }
              });

              for (const msg of messagesToDelete) {
                // Delete thread messages first
                await pool.execute(
                  `DELETE FROM messages WHERE thread_parent_id = ?`,
                  [msg.id]
                );
                // Delete the booking message
                await pool.execute(`DELETE FROM messages WHERE id = ?`, [msg.id]);
                
                // Emit socket event
                if (io) {
                  io.to(`channel:${msg.channel_id}`).emit("message:deleted", {
                    messageId: msg.id,
                    channelId: msg.channel_id,
                  });
                }
              }
            }
          }
        } catch (messageError) {
          console.error("Error deleting booking messages:", messageError);
          // Continue with room deletion even if message deletion fails
        }
      }

      // Soft delete by setting is_active to 0
      await pool.execute("UPDATE rooms SET is_active = 0 WHERE id = ?", [roomId]);
      
      return res.status(200).json({ 
        message: hasActiveBookings 
          ? "Room deactivated and future bookings cancelled" 
          : "Room deactivated successfully" 
      });
    } catch (error) {
      console.error("Delete room error:", error);
      return res.status(500).json({ error: "Failed to delete room" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

