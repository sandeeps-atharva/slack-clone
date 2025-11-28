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

export default async function handler(req, res) {
  const user = authenticateToken(req, res);
  if (!user) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  try {
    const { room_id, start_time, end_time, date } = req.query;

    if (!start_time || !end_time) {
      return res.status(400).json({ error: "Start time and end time are required" });
    }

    // Format datetime for MySQL
    const formattedStartTime = formatDateTimeForMySQL(start_time);
    const formattedEndTime = formatDateTimeForMySQL(end_time);

    // If room_id is provided, check that specific room
    if (room_id) {
      const query = `
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
      
      const [result] = await pool.execute(query, [
        room_id,
        formattedEndTime, formattedStartTime,
        formattedEndTime, formattedStartTime,
        formattedStartTime, formattedEndTime,
      ]);

      return res.status(200).json({ 
        available: result[0].count === 0,
        conflicting_bookings: result[0].count 
      });
    }

    // If no room_id, check all rooms for the time slot
    const query = `
      SELECT r.id, r.name, r.capacity, r.floor,
             COUNT(b.id) as booking_count
      FROM rooms r
      LEFT JOIN bookings b ON r.id = b.room_id 
        AND b.status = 'confirmed'
        AND (
          (b.start_time < ? AND b.end_time > ?) OR
          (b.start_time < ? AND b.end_time > ?) OR
          (b.start_time >= ? AND b.end_time <= ?)
        )
      WHERE r.is_active = 1
      GROUP BY r.id, r.name, r.capacity, r.floor
      HAVING booking_count = 0
      ORDER BY r.name ASC
    `;

    const [availableRooms] = await pool.execute(query, [
      formattedEndTime, formattedStartTime,
      formattedEndTime, formattedStartTime,
      formattedStartTime, formattedEndTime,
    ]);

    return res.status(200).json({ 
      available_rooms: availableRooms,
      total_available: availableRooms.length 
    });
  } catch (error) {
    console.error("Check availability error:", error);
    return res.status(500).json({ error: "Failed to check availability" });
  }
}
