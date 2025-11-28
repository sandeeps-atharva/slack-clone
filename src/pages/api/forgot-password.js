import pool from "@/utils/db";
import crypto from "crypto";
import nodemailer from "nodemailer";

// Ensure users table has reset_token columns
async function ensureResetTokenColumns() {
  try {
    // Check if reset_token column exists
    const [columns] = await pool.execute(
      "SHOW COLUMNS FROM users LIKE 'reset_token'"
    );
    
    if (columns.length === 0) {
      // Add reset_token column
      await pool.execute(
        "ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL, ADD COLUMN reset_token_expires DATETIME NULL"
      );
    }
  } catch (error) {
    // Column might already exist or table doesn't exist yet
    console.error("Error ensuring reset_token columns:", error);
  }
}

// Create nodemailer transporter
const createTransporter = () => {
  // Support both EMAIL_USER/EMAIL_PASS and SMTP_USER/SMTP_PASS naming conventions
  const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
  const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || "587");
  const smtpSecure = process.env.SMTP_SECURE === "true" || process.env.EMAIL_SECURE === "true";
  const fromEmail = process.env.SMTP_FROM || process.env.EMAIL_FROM || emailUser;

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure, // true for 465, false for other ports
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Ensure database schema is up to date
    await ensureResetTokenColumns();

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if user exists
    const [users] = await pool.execute(
      "SELECT id, username, email FROM users WHERE email = ?",
      [email]
    );

    // Don't reveal if user exists or not (security best practice)
    if (users.length === 0) {
      return res.status(200).json({ 
        message: "If an account with that email exists, a password reset link has been sent." 
      });
    }

    const user = users[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

    // Update user with reset token
    await pool.execute(
      "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
      [resetToken, resetTokenExpires, user.id]
    );

    // Create reset URL
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

    // Send email
    try {
      const transporter = createTransporter();
      
      const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
      const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
      
      if (!emailUser || !emailPass) {
        console.error("Email credentials not configured. Email not sent.");
        // In development, log the reset URL
        console.log("Reset URL (dev only):", resetUrl);
        return res.status(200).json({ 
          message: "If an account with that email exists, a password reset link has been sent.",
          // Only include in development
          ...(process.env.NODE_ENV === "development" && { resetUrl })
        });
      }

      const fromEmail = process.env.SMTP_FROM || process.env.EMAIL_FROM || emailUser;
      
      await transporter.sendMail({
        from: fromEmail,
        to: user.email,
        subject: "Password Reset Request",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7c3aed;">Password Reset Request</h2>
            <p>Hello ${user.username},</p>
            <p>You requested a password reset for your account. Click the link below to reset your password:</p>
            <p>
              <a href="${resetUrl}" style="background-color: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </p>
            <p>Or copy and paste this URL into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });

      return res.status(200).json({ 
        message: "If an account with that email exists, a password reset link has been sent." 
      });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Still return success to not reveal if user exists
      return res.status(200).json({ 
        message: "If an account with that email exists, a password reset link has been sent." 
      });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

