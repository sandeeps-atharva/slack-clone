import pool from "@/utils/db";
import { authenticateToken } from "@/utils/auth";

// Create rooms table if it doesn't exist
const CREATE_ROOMS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NULL,
    capacity INT DEFAULT 10,
    amenities JSON NULL,
    floor VARCHAR(50) NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_is_active (is_active)
  ) ENGINE=InnoDB;
`;

async function ensureRoomsSchema() {
  try {
    await pool.execute(CREATE_ROOMS_TABLE_SQL);
    
    // Initialize with 10 default rooms if table is empty
    const [existingRooms] = await pool.execute("SELECT COUNT(*) as count FROM rooms");
    if (existingRooms[0].count === 0) {
      const defaultRooms = [
        { name: "Conference Room A", description: "Large conference room with projector", capacity: 20, floor: "1st Floor" },
        { name: "Conference Room B", description: "Medium conference room", capacity: 15, floor: "1st Floor" },
        { name: "Meeting Room 1", description: "Small meeting room", capacity: 8, floor: "2nd Floor" },
        { name: "Meeting Room 2", description: "Small meeting room", capacity: 8, floor: "2nd Floor" },
        { name: "Board Room", description: "Executive board room", capacity: 12, floor: "3rd Floor" },
        { name: "Training Room", description: "Training and workshop space", capacity: 30, floor: "1st Floor" },
        { name: "Client Meeting Room", description: "Dedicated client meeting space", capacity: 10, floor: "2nd Floor" },
        { name: "Collaboration Space", description: "Open collaboration area", capacity: 6, floor: "2nd Floor" },
        { name: "Quiet Room", description: "Quiet workspace", capacity: 4, floor: "3rd Floor" },
        { name: "Video Conference Room", description: "Equipped for video calls", capacity: 12, floor: "1st Floor" },
      ];
      
      for (const room of defaultRooms) {
        await pool.execute(
          "INSERT INTO rooms (name, description, capacity, floor) VALUES (?, ?, ?, ?)",
          [room.name, room.description, room.capacity, room.floor]
        );
      }
    }
  } catch (error) {
    console.error("Error ensuring rooms schema:", error);
    throw error;
  }
}

export default async function handler(req, res) {
  const user = authenticateToken(req, res);
  if (!user) return;

  await ensureRoomsSchema();

  if (req.method === "GET") {
    try {
      const { active_only } = req.query;
      let query = "SELECT * FROM rooms";
      const params = [];

      if (active_only === "true") {
        query += " WHERE is_active = 1";
      }

      query += " ORDER BY name ASC";

      const [rooms] = await pool.execute(query, params);
      return res.status(200).json({ rooms });
    } catch (error) {
      console.error("Fetch rooms error:", error);
      return res.status(500).json({ error: "Failed to fetch rooms" });
    }
  }

  if (req.method === "POST") {
    try {
      const { name, description, capacity, amenities, floor } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Room name is required" });
      }

      const [result] = await pool.execute(
        "INSERT INTO rooms (name, description, capacity, amenities, floor) VALUES (?, ?, ?, ?, ?)",
        [
          name,
          description || null,
          capacity || 10,
          amenities ? JSON.stringify(amenities) : null,
          floor || null,
        ]
      );

      const [newRoom] = await pool.execute("SELECT * FROM rooms WHERE id = ?", [result.insertId]);
      return res.status(201).json({ room: newRoom[0] });
    } catch (error) {
      console.error("Create room error:", error);
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ error: "Room name already exists" });
      }
      return res.status(500).json({ error: "Failed to create room" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

