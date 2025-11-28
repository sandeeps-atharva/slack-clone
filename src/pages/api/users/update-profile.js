import pool from "@/utils/db";
import { authenticateToken } from "@/utils/auth";
import bcrypt from "bcrypt";

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = authenticateToken(req, res);
  if (!user) return;

  try {
    const { username, email, currentPassword, newPassword } = req.body;

    // Validate inputs
    if (!username || username.trim().length === 0) {
      return res.status(400).json({ error: "Username is required" });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters" });
    }
    if (username.length > 50) {
      return res.status(400).json({ error: "Username must be less than 50 characters" });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: "Username can only contain letters, numbers, and underscores" });
    }

    if (!email || email.trim().length === 0) {
      return res.status(400).json({ error: "Email is required" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }

    // Check if username or email is already taken by another user
    const [existingUsers] = await pool.execute(
      "SELECT id, username, email FROM users WHERE (username = ? OR email = ?) AND id != ?",
      [username, email, user.id]
    );

    if (existingUsers.length > 0) {
      if (existingUsers[0].username === username) {
        return res.status(400).json({ error: "Username already taken" });
      }
      if (existingUsers[0].email === email) {
        return res.status(400).json({ error: "Email already taken" });
      }
    }

    // Get current user data
    const [currentUser] = await pool.execute(
      "SELECT username, email, password FROM users WHERE id = ?",
      [user.id]
    );

    if (currentUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const updateData = {};
    const updateFields = [];

    // Update username if changed
    if (username !== currentUser[0].username) {
      updateData.username = username;
      updateFields.push("username = ?");
    }

    // Update email if changed
    if (email !== currentUser[0].email) {
      updateData.email = email;
      updateFields.push("email = ?");
    }

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required to change password" });
      }

      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, currentUser[0].password);
      if (!validPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updateData.password = hashedPassword;
      updateFields.push("password = ?");
    }

    // If nothing to update
    if (updateFields.length === 0) {
      return res.status(200).json({ message: "No changes made", user: { id: user.id, username, email } });
    }

    // Build update query
    const values = Object.values(updateData);
    values.push(user.id);
    const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;

    await pool.execute(query, values);

    // Return updated user info
    return res.status(200).json({
      message: "Profile updated successfully",
      user: { id: user.id, username, email },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Username or email already exists" });
    }
    return res.status(500).json({ error: "Server error" });
  }
}

