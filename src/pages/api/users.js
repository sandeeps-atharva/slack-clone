import pool from "@/utils/db";
import { authenticateToken } from "@/utils/auth";

function clampLimit(value) {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num) || num <= 0) return 20;
  return Math.min(num, 50);
}

function escapeLike(value) {
  return value.replace(/[%_]/g, "\\$&");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = authenticateToken(req, res);
  if (!user) return;

  const search = (req.query.query || "").toString().trim();
  const limit = clampLimit(req.query.limit);

  try {
    if (search.length === 0) {
      const query = `SELECT id, username, email
                     FROM users
                     WHERE id != ?
                     ORDER BY username ASC
                     LIMIT ${limit}`;
      const [rows] = await pool.query(query, [user.id]);
      return res.status(200).json(rows);
    }

    const like = `%${escapeLike(search)}%`;
    const query = `SELECT id, username, email
                   FROM users
                   WHERE id != ?
                     AND (username LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')
                   ORDER BY username ASC
                   LIMIT ${limit}`;
    const [rows] = await pool.query(query, [user.id, like, like]);
    return res.status(200).json(rows);
  } catch (error) {
    console.error("User search error:", error);
    return res.status(500).json({ error: "Failed to load users" });
  }
}
