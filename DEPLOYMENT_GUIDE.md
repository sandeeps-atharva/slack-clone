# 🚀 Deployment Guide - Next.js Chat App

This guide will help you deploy your chat application to **Vercel** (free) with a MySQL database on **Railway** (free tier).

## 📋 Prerequisites

- GitHub account (free)
- Vercel account (free)
- Railway account (free)

---

## 🗄️ Step 1: Set Up MySQL Database (Railway)

### 1.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project"

### 1.2 Add MySQL Database
1. Click "New" → "Database" → "Add MySQL"
2. Wait for database to provision (takes ~1 minute)
3. Click on the MySQL service
4. Go to "Variables" tab
5. Copy these values (you'll need them later):
   - `MYSQLHOST` (host)
   - `MYSQLUSER` (user)
   - `MYSQLPASSWORD` (password)
   - `MYSQLPORT` (port)
   - `MYSQLDATABASE` (database name)

### 1.3 Connect to Database and Create Tables
1. Go to "Connect" tab in Railway
2. Copy the connection string or use Railway CLI
3. Connect using MySQL client (MySQL Workbench, DBeaver, or command line)
4. Run this SQL to create the users table:

```sql
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

**Note:** Other tables (channels, messages, etc.) will be created automatically by your API routes.

---

## ☁️ Step 2: Set Up File Storage (Cloudinary - Optional but Recommended)

Since Vercel has limited file storage, use Cloudinary for file uploads.

### 2.1 Create Cloudinary Account
1. Go to [cloudinary.com](https://cloudinary.com)
2. Sign up for free account
3. Go to Dashboard
4. Copy these values:
   - `Cloud name`
   - `API Key`
   - `API Secret`

### 2.2 Configure Cloudinary
Your app already uses Cloudinary! Just add the environment variables to Vercel (see Step 3.4).

---

## 🚀 Step 3: Deploy to Vercel

### 3.1 Prepare Your Code
1. Make sure your code is committed to Git:
```bash
git add .
git commit -m "Ready for deployment"
```

2. Push to GitHub:
```bash
git push origin main
```

### 3.2 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "Add New" → "Project"

### 3.3 Import Your Repository
1. Select your GitHub repository
2. Click "Import"

### 3.4 Configure Environment Variables
Before deploying, add these environment variables in Vercel:

1. Go to "Environment Variables" section
2. Add these variables:

**Database (from Railway):**
```
DB_HOST=<Your Railway MYSQLHOST>
DB_USER=<Your Railway MYSQLUSER>
DB_PASSWORD=<Your Railway MYSQLPASSWORD>
DB_NAME=<Your Railway MYSQLDATABASE>
DB_PORT=<Your Railway MYSQLPORT>
```

**Authentication:**
```
JWT_SECRET=<Generate a random secret string, e.g., use: openssl rand -base64 32>
```

**Cloudinary (from Cloudinary Dashboard):**
```
CLOUDINARY_CLOUD_NAME=<Your Cloudinary Cloud Name>
CLOUDINARY_API_KEY=<Your Cloudinary API Key>
CLOUDINARY_API_SECRET=<Your Cloudinary API Secret>
```

**To generate JWT_SECRET:**
```bash
# On Mac/Linux:
openssl rand -base64 32

# Or use any random string generator online
```

### 3.5 Configure Build Settings
- **Framework Preset:** Next.js (auto-detected)
- **Build Command:** `npm run build` (default)
- **Output Directory:** `.next` (default)
- **Install Command:** `npm install` (default)

### 3.6 Deploy
1. Click "Deploy"
2. Wait for build to complete (~2-3 minutes)
3. Your app will be live at: `https://your-project-name.vercel.app`

---

## 📁 Step 4: File Uploads (Already Configured!)

Your app already uses Cloudinary for file uploads! Just make sure you've added the Cloudinary environment variables in Step 3.4.

Files will be stored in Cloudinary's cloud storage, which is perfect for production.

---

## 🔧 Step 5: Post-Deployment Setup

### 5.1 Test Your Deployment
1. Visit your Vercel URL
2. Register a new user
3. Test chat functionality
4. Test file uploads

### 5.2 Set Up Custom Domain (Optional)
1. In Vercel dashboard, go to "Settings" → "Domains"
2. Add your custom domain
3. Follow DNS configuration instructions

---

## 🐛 Troubleshooting

### Database Connection Issues
- Verify all environment variables are set correctly in Vercel
- Check Railway database is running
- Ensure Railway allows connections from Vercel IPs (should work by default)

### Socket.IO Not Working
- Vercel supports Socket.IO, but you may need to enable it
- Check `next.config.mjs` - your configuration looks good
- Ensure WebSocket connections are allowed

### File Upload Issues
- If using local storage, files won't persist
- Switch to Cloudinary or Vercel Blob Storage

### Build Errors
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Check Node.js version (Vercel uses Node 18+ by default)

---

## 📊 Alternative Free Platforms

### For Database:
1. **PlanetScale** (MySQL) - Free tier: 1 database, 1GB storage
2. **Supabase** (PostgreSQL) - Free tier: 500MB database
3. **Neon** (PostgreSQL) - Free tier: 0.5GB storage

### For Hosting:
1. **Render** - Free tier available (slower cold starts)
2. **Fly.io** - Free tier with 3 shared VMs
3. **Railway** - Can host both app and database (free tier limited)

---

## ✅ Checklist

- [ ] Railway MySQL database created
- [ ] Database connection details saved
- [ ] Users table created in database
- [ ] Code pushed to GitHub
- [ ] Vercel account created
- [ ] Project imported to Vercel
- [ ] Environment variables configured
- [ ] JWT_SECRET generated and added
- [ ] Build successful
- [ ] App tested and working
- [ ] File storage configured (Cloudinary/Vercel Blob)

---

## 🎉 You're Done!

Your chat app should now be live! Share your Vercel URL with others to test.

**Need Help?**
- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- Check Vercel build logs for errors

