import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "@/utils/db";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: "All fields required" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword]
    );

    const token = jwt.sign(
      { id: result.insertId, username, email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res
      .status(201)
      .json({ token, user: { id: result.insertId, username, email } });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      res.status(400).json({ error: "Username or email exists" });
    else res.status(500).json({ error: "Server error" });
  }
}
