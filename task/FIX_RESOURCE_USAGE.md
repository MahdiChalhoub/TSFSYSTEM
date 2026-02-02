# 🚨 FIXING 100% RESOURCE USAGE ON HOSTINGER

## Problem: Hitting Process/Resource Limits

**Symptoms:**
- Hostinger showing 100% resource usage
- "Max Processes" limit reached
- Application won't start
- Build fails with resource errors

---

## 🎯 ROOT CAUSE

**Next.js is TOO HEAVY for shared hosting!**

- **Build process uses:** 3-6 worker processes
- **Turbopack compiler:** Very memory intensive
- **Your limits:** 56 processes (very low)
- **Next.js needs:** 100+ processes to build comfortably

---

## ✅ SOLUTION: Build Locally, Deploy Pre-Built

### **DON'T BUILD ON HOSTINGER!**
### **BUILD ON YOUR COMPUTER INSTEAD!**

---

## 📋 STEP-BY-STEP FIX

### **Step 1: Kill All Processes on Hostinger**

SSH into Hostinger:
```bash
# Kill everything
pkill -9 node

# Verify nothing is running
ps aux | grep node

# Should return nothing or just the grep command itself
```

---

### **Step 2: Build Locally (On Your Computer)**

In PowerShell on your Windows machine:

```powershell
cd c:\tsfci

# Run the optimized deployment script
.\deploy-shared-hosting.ps1
```

This will:
1. ✅ Build on your powerful Windows PC
2. ✅ Create optimized production bundle
3. ✅ Commit the `.next` folder
4. ✅ Push everything to GitHub

---

### **Step 3: Deploy on Hostinger (NO BUILD NEEDED)**

SSH into Hostinger:

```bash
# Go to your directory
cd ~/public_html

# Pull the pre-built code
git pull origin main

# Install ONLY production dependencies
npm install --production

# Generate Prisma client
npx prisma generate

# Apply database schema
npx prisma db push

# Start the app
npm start
```

Or with PM2:
```bash
pm2 start server.js --name tsfci
pm2 save
pm2 startup
```

---

## 🎛️ ALTERNATIVE: Use PM2 Process Manager

### **Install PM2:**
```bash
npm install -g pm2
```

### **Start with PM2:**
```bash
pm2 start server.js --name tsfci
```

### **Useful PM2 Commands:**
```bash
pm2 list              # Show all processes
pm2 logs tsfci        # View logs
pm2 restart tsfci     # Restart app
pm2 stop tsfci        # Stop app
pm2 delete tsfci      # Remove from PM2
pm2 monit             # Monitor resources
```

---

## 🔍 MONITORING RESOURCE USAGE

### **Check Current Processes:**
```bash
ps aux | grep node
```

### **Check Resource Usage:**
```bash
top -u yourusername
```

Press `q` to quit.

### **Check PM2 Status:**
```bash
pm2 monit
```

---

## ⚠️ PREVENTION TIPS

### **1. Always Kill Old Processes**
Before deploying:
```bash
pkill -9 node
pm2 delete all
```

### **2. Never Run `npm run build` on Hostinger**
Always build locally!

### **3. Use Production Install**
```bash
npm install --production  # NOT npm install
```

### **4. Limit Development Server**
Don't run `npm run dev` on production server.

### **5. Monitor Regularly**
```bash
pm2 monit
```

---

## 🆘 TROUBLESHOOTING

### **Problem: Still at 100% after killing processes**

**Solution:**
```bash
# Force kill everything
pkill -9 -u yourusername node
killall -9 node

# Wait 30 seconds
sleep 30

# Check again
ps aux | grep node
```

---

### **Problem: Can't start application**

**Solution:**
```bash
# Check if port is in use
lsof -ti:3000 | xargs kill -9

# Or change port
PORT=3001 npm start
```

---

### **Problem: Out of memory during npm install**

**Solution:**
```bash
# Increase Node memory (if allowed)
export NODE_OPTIONS="--max-old-space-size=512"

# Or install in chunks
npm install --production --no-optional
```

---

## 🚀 RECOMMENDED WORKFLOW

### **Every Time You Deploy:**

#### **On Your Computer (Windows):**
```powershell
.\deploy-shared-hosting.ps1
```

#### **On Hostinger (SSH):**
```bash
# Kill old processes
pkill -9 node

# Update code
cd ~/public_html
git pull

# Update dependencies (only if package.json changed)
npm install --production

# Update Prisma
npx prisma generate
npx prisma db push

# Start/Restart
pm2 restart tsfci || pm2 start server.js --name tsfci
```

---

## 📊 RESOURCE OPTIMIZATION

### **.next Folder Size**

After building, check size:
```bash
du -sh .next
```

Should be ~100-300 MB. If larger, optimize:

1. Remove unused dependencies
2. Optimize images
3. Remove dev dependencies from build

---

## 💡 UPGRADE PATH (Future)

If you keep hitting limits, consider upgrading:

1. **Hostinger Business Plan** - More resources
2. **VPS Hosting** - Full control, more power
3. **Cloud Hosting** - Vercel, Railway, DigitalOcean

But for now, **building locally works perfectly!**

---

## ✅ VERIFICATION

After deployment:

- [ ] `ps aux | grep node` shows only 1-2 processes
- [ ] `pm2 list` shows app running
- [ ] `https://tsf.ci` loads successfully
- [ ] Resource usage < 50%
- [ ] No timeout errors

---

## 📞 QUICK REFERENCE

```bash
# Emergency: Kill everything
pkill -9 node

# Deploy: Update code
cd ~/public_html && git pull

# Start: Using PM2
pm2 restart tsfci || pm2 start server.js --name tsfci

# Monitor: Check status
pm2 monit

# Logs: View errors
pm2 logs tsfci
```

---

## 🎯 REMEMBER

**✅ DO:**
- Build on your local computer
- Use PM2 to manage processes
- Kill old processes before deploying
- Use `npm install --production`

**❌ DON'T:**
- Run `npm run build` on Hostinger
- Run `npm run dev` on production
- Leave zombie processes running
- Use `npm install` (use --production flag)

---

**Your app will run smoothly with < 10 processes when deployed this way!** 🚀
