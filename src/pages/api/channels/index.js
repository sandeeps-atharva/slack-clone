import pool from "@/utils/db";
import { authenticateToken } from "@/utils/auth";

const CREATE_CHANNELS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS channels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    topic VARCHAR(255) NULL,
    is_private TINYINT(1) DEFAULT 0,
    created_by INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;
`;

const CREATE_CHANNEL_MEMBERS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS channel_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    channel_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('owner', 'moderator', 'member') DEFAULT 'member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_member (channel_id, user_id),
    KEY idx_user (user_id),
    CONSTRAINT fk_channel_members_channel
      FOREIGN KEY (channel_id) REFERENCES channels(id)
      ON DELETE CASCADE,
    CONSTRAINT fk_channel_members_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB;
`;

function sanitizeIdentifier(input, fallback) {
  const safe = (input || "").toString().replace(/[^a-zA-Z0-9_]/g, "");
  return safe.length > 0 ? safe : fallback;
}

async function columnExists(table, column) {
  const safeTable = sanitizeIdentifier(table, "messages");
  const safeColumn = sanitizeIdentifier(column, "id");
  const query = `SHOW COLUMNS FROM \`${safeTable}\` LIKE '${safeColumn}'`;
  const [rows] = await pool.query(query);
  return rows.length > 0;
}

async function constraintExists(table, constraint) {
  const safeTable = sanitizeIdentifier(table, "messages");
  const safeConstraint = sanitizeIdentifier(constraint, "fk_messages_channel");
  const query = `SELECT CONSTRAINT_NAME
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = '${safeTable}'
       AND CONSTRAINT_NAME = '${safeConstraint}'
     LIMIT 1`;
  const [rows] = await pool.query(query);
  return rows.length > 0;
}

async function ensureSchema() {
  await pool.execute(CREATE_CHANNELS_TABLE_SQL);
  await pool.execute(CREATE_CHANNEL_MEMBERS_TABLE_SQL);

  try {
    if (!(await columnExists("messages", "channel_id"))) {
      await pool.execute("ALTER TABLE messages ADD COLUMN channel_id INT NULL");
    }
    if (!(await columnExists("messages", "thread_parent_id"))) {
      await pool.execute("ALTER TABLE messages ADD COLUMN thread_parent_id INT NULL");
    }
    if (!(await columnExists("messages", "client_id"))) {
      await pool.execute("ALTER TABLE messages ADD COLUMN client_id VARCHAR(100) NULL");
    }

    if (!(await constraintExists("messages", "fk_messages_channel"))) {
      try {
        await pool.execute(
          "ALTER TABLE messages ADD CONSTRAINT fk_messages_channel FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE"
        );
      } catch (error) {
        if (
          error.code !== "ER_DUP_KEYNAME" &&
          error.code !== "ER_NO_REFERENCED_TABLE" &&
          error.code !== "ER_CANT_CREATE_TABLE" &&
          error.code !== "ER_CANNOT_ADD_FOREIGN"
        ) {
          throw error;
        }
      }
    }
  } catch (error) {
    if (
      error.code !== "ER_DUP_KEYNAME" &&
      error.code !== "ER_NO_REFERENCED_TABLE" &&
      error.code !== "ER_CANT_CREATE_TABLE" &&
      error.code !== "ER_CANNOT_ADD_FOREIGN"
    ) {
      throw error;
    }
  }
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

async function getOrCreateGeneralChannel(userId) {
  const membershipQuery = `
      SELECT c.id, c.name, c.slug, c.is_private, c.topic, cm.role
      FROM channel_members cm
      JOIN channels c ON cm.channel_id = c.id
      WHERE cm.user_id = ?
      ORDER BY c.created_at ASC
    `;
  const [existingMembership] = await pool.execute(membershipQuery, [userId]);

  if (existingMembership.length > 0) {
    return existingMembership;
  }

  const [existingGeneral] = await pool.execute(
    "SELECT id, name, slug, topic, is_private FROM channels WHERE slug = ? LIMIT 1",
    ["general"]
  );

  let channelId;
  let role = "member";

  if (existingGeneral.length === 0) {
    const defaultName = "General";
    const defaultTopic = "Company-wide announcements and watercooler chat";

    const [insertChannel] = await pool.execute(
      "INSERT INTO channels (name, slug, topic, is_private, created_by) VALUES (?, ?, ?, ?, ?)",
      [defaultName, "general", defaultTopic, 0, userId]
    );

    channelId = insertChannel.insertId;
    role = "owner";
  } else {
    channelId = existingGeneral[0].id;
  }

  await pool.execute(
    "INSERT IGNORE INTO channel_members (channel_id, user_id, role) VALUES (?, ?, ?)",
    [channelId, userId, role]
  );

  const [channels] = await pool.execute(membershipQuery, [userId]);
  return channels;
}

export default async function handler(req, res) {
  const user = authenticateToken(req, res);
  if (!user) return; // authenticateToken already handled response

  try {
    await ensureSchema();
  } catch (error) {
    console.error("Schema initialization error:", error);
    return res.status(500).json({ error: "Failed to initialize channel schema" });
  }

  if (req.method === "GET") {
    try {
      const channels = await getOrCreateGeneralChannel(user.id);
      return res.status(200).json(channels);
    } catch (error) {
      console.error("Fetch channels error:", error);
      return res.status(500).json({ error: "Failed to fetch channels" });
    }
  }

  if (req.method === "POST") {
    const { name, topic = "", isPrivate = false, memberIds = [] } = req.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Channel name is required" });
    }

    const normalizedMemberIds = Array.isArray(memberIds)
      ? [...new Set(
          memberIds
            .map((id) => Number.parseInt(id, 10))
            .filter((id) => Number.isInteger(id) && id > 0)
        )]
      : [];

    if (isPrivate && normalizedMemberIds.length === 0) {
      return res.status(400).json({ error: "Select at least one member for a private channel" });
    }

    const normalizedName = name.trim();
    let baseSlug = slugify(normalizedName);
    if (!baseSlug) {
      baseSlug = `channel-${Date.now()}`;
    }
    let slugCandidate = baseSlug;
    let counter = 1;
    let slugAvailable = false;

    while (!slugAvailable) {
      const [existingSlug] = await pool.execute(
        "SELECT id FROM channels WHERE slug = ? LIMIT 1",
        [slugCandidate]
      );

      if (existingSlug.length === 0) {
        slugAvailable = true;
      } else {
        slugCandidate = `${baseSlug}-${counter}`;
        counter += 1;
      }
    }

    try {
      const [result] = await pool.execute(
        "INSERT INTO channels (name, slug, topic, is_private, created_by) VALUES (?, ?, ?, ?, ?)",
        [normalizedName, slugCandidate, topic || null, isPrivate ? 1 : 0, user.id]
      );

      const channelId = result.insertId;

      // Add creator as owner
      await pool.execute(
        "INSERT INTO channel_members (channel_id, user_id, role) VALUES (?, ?, 'owner')",
        [channelId, user.id]
      );

      // Add other members if provided (ignore current user if included)
      if (Array.isArray(memberIds) && memberIds.length > 0) {
        const filteredMemberIds = normalizedMemberIds.filter((id) => id !== user.id);
        if (filteredMemberIds.length) {
          const values = filteredMemberIds.map((memberId) => [channelId, memberId, "member"]);
          await pool.query(
            "INSERT IGNORE INTO channel_members (channel_id, user_id, role) VALUES ?",
            [values]
          );
        }
      }

      return res.status(201).json({
        id: channelId,
        name: normalizedName,
        slug: slugCandidate,
        topic,
        is_private: isPrivate ? 1 : 0,
        role: "owner",
      });
    } catch (error) {
      console.error("Create channel error:", error);
      return res.status(500).json({ error: "Failed to create channel" });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}


