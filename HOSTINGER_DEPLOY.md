# 🚀 Hostinger Deployment Guide - FIX for Build Errors

## Issue Fixed: DATABASE_URL Not Found During Build

The build was failing because Hostinger's build environment doesn't have access to the DATABASE_URL environment variable during the build step.

---

## ✅ Solution Applied

1. **Updated `src/lib/db.ts`:** Added fallback for DATABASE_URL during build
2. **Created `.env.production`:** Template for production environment variables
3. **Updated `.gitignore`:** Allow .env.production to be committed

---

## 📋 Deployment Steps for Hostinger

### **Step 1: Ensure .env File Exists on Server**

After pulling the code, create or verify the `.env` file on Hostinger:

```bash
# SSH into Hostinger or use File Manager Terminal
cd ~/public_html

# Create .env file
nano .env
```

Add this content:
```env
DATABASE_URL="file:./prisma/dev.db"
NODE_ENV="production"
```

Save and exit (Ctrl+X, then Y, then Enter)

---

### **Step 2: Install Dependencies**

```bash
npm install
```

---

### **Step 3: Generate Prisma Client**

```bash
npx prisma generate
```

---

### **Step 4: Apply Database Schema**

```bash
npx prisma db push
```

---

### **Step 5: Build the Application**

```bash
npm run build
```

This should now work without the DATABASE_URL error!

---

### **Step 6: Start the Application**

```bash
npm start
```

Or if using PM2:
```bash
pm2 start server.js --name tsfci
pm2 save
```

---

## 🎛️ Alternative: Build Locally, Upload Build

If building on Hostinger still fails (low memory on shared hosting):

### **On Your Local Machine:**

```powershell
# 1. Build locally
npm run build

# 2. Commit the .next folder (usually ignored)
# Temporarily remove .next from .gitignore
# Add and commit
git add .next
git commit -m "Add production build"
git push
```

### **On Hostinger:**

```bash
# Pull the build
git pull

# Install production dependencies only
npm install --production

# Start the app
npm start
```

---

## 🔍 Troubleshooting

### Problem: "ENOENT: no such file or directory, open 'prisma/dev.db'"

**Solution:**
```bash
# Ensure prisma directory exists
mkdir -p prisma
cd prisma
touch dev.db
cd ..

# Run schema push
npx prisma db push
```

---

### Problem: "Cannot find module '@prisma/client'"

**Solution:**
```bash
npx prisma generate
npm install
```

---

### Problem: Out of memory during build

**Solution:** Build locally and upload the `.next` folder (see Alternative method above)

---

### Problem: Port already in use

**Solution:**
```bash
# Kill existing process
pkill -f "node server.js"

# Or find and kill specific PID
lsof -ti:3000 | xargs kill -9

# Start again
npm start
```

---

## 📝 Quick Command Reference

```bash
# Full deployment from scratch
cd ~/public_html
git pull
npm install
npx prisma generate
npx prisma db push
npm run build
npm start

# Quick restart after code changes
cd ~/public_html
git pull
npm install
pm2 restart tsfci
```

---

## ✅ Verification

After successful deployment:

1. Visit: `https://tsf.ci/admin/sales`
2. Page should load in < 3 seconds
3. Products display correctly
4. Search works smoothly
5. No errors in console

---

## 🎯 Next Time You Deploy

Just run:
```bash
cd ~/public_html
git pull
npm install
pm2 restart tsfci
```

No need to rebuild unless you changed the build configuration!

---

## 📞 Still Having Issues?

Check:
1. Node.js version: `node --version` (should be v18+)
2. Environment variables: `cat .env`
3. Prisma client: `npx prisma version`
4. Logs: `tail -f ~/logs/nodejs.log`
