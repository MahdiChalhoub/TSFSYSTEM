# Production Server Deployment Guide

**Production Server**: 91.99.186.183 (tsf.ci)
**Current Server**: 91.99.11.249 (development)

---

## Quick Deployment (5 minutes)

### Step 1: SSH to Production Server

```bash
ssh root@91.99.186.183
```

### Step 2: Navigate to Project Directory

```bash
cd /root/TSFSYSTEM
```

### Step 3: Pull Latest Code

```bash
git fetch origin main
git reset --hard origin/main
```

### Step 4: Install Dependencies

```bash
# Frontend dependencies
npm install

# Backend dependencies (if needed)
cd erp_backend
source venv/bin/activate || source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### Step 5: Build Frontend

```bash
npm run build
```

This will:
- Check kernel integrity
- Compile Next.js (should produce ~598 routes)
- Take about 30-60 seconds

**Expected output**:
```
✓ Compiled successfully in 25.0s
Route (app)
... (598 routes listed)
```

### Step 6: Restart Services

```bash
# Restart frontend
systemctl restart tsfsystem-frontend.service

# Restart backend (if needed)
systemctl restart tsfsystem.service

# Reload Nginx (graceful)
systemctl reload nginx
```

### Step 7: Verify Services

```bash
# Check frontend status
systemctl status tsfsystem-frontend.service

# Check backend status
systemctl status tsfsystem.service

# Test locally
curl -I http://localhost:3000/
```

### Step 8: Test Public Access

Wait 30 seconds, then visit:
- https://tsf.ci
- https://saas.tsf.ci

You should see the TSF System landing page.

---

## Alternative: One-Command Deployment

Create this script on the production server:

```bash
cat > /root/deploy-quick.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

cd /root/TSFSYSTEM

echo "📥 Pulling latest code..."
git fetch origin main
git reset --hard origin/main

echo "📦 Installing dependencies..."
npm install --no-audit --no-fund

echo "🔨 Building frontend..."
npm run build

echo "♻️  Restarting services..."
systemctl restart tsfsystem-frontend.service
systemctl reload nginx

echo "✅ Deployment complete!"
echo ""
echo "Test: curl -I http://localhost:3000/"
echo "Public: https://tsf.ci"
EOF

chmod +x /root/deploy-quick.sh
```

Then run:
```bash
bash /root/deploy-quick.sh
```

---

## Troubleshooting

### If build fails with "duplicate MCP routes"

```bash
cd /root/TSFSYSTEM
rm -rf src/app/\(privileged\)/mcp
npm run build
```

### If port 3000 is in use

```bash
# Check what's using port 3000
lsof -i :3000

# If it's PM2
pm2 delete all

# If it's old process
kill -9 $(lsof -t -i:3000)

# Then restart service
systemctl restart tsfsystem-frontend.service
```

### If frontend service fails to start

```bash
# Check logs
journalctl -u tsfsystem-frontend.service -n 50

# Check error log
tail -50 /var/log/tsfsystem-frontend-error.log

# Common issue: wrong working directory
cat /etc/systemd/system/tsfsystem-frontend.service
# Should have: WorkingDirectory=/root/current or /root/TSFSYSTEM
```

### Verify Cloudflare SSL Certificate

On production server, check certificate:
```bash
openssl x509 -in /etc/letsencrypt/live/tsf.ci/fullchain.pem -noout -issuer
```

**Should show**: `issuer=...CloudFlare...`

**If it shows self-signed**, install the Cloudflare Origin Certificate (see CLOUDFLARE_ORIGIN_CERT_SETUP.md).

---

## Post-Deployment Checklist

- [ ] Frontend service: `systemctl status tsfsystem-frontend.service` → Active
- [ ] Backend service: `systemctl status tsfsystem.service` → Active
- [ ] Nginx: `systemctl status nginx` → Active
- [ ] Local test: `curl -I http://localhost:3000/` → HTTP 200
- [ ] Backend test: `curl -I http://localhost:8000/api/auth/config/` → HTTP 200
- [ ] Public test: Visit https://tsf.ci → Should load TSF System page
- [ ] No console errors in browser DevTools

---

## Files to Sync from Dev to Prod (if needed)

If the production server is missing files that exist on dev:

```bash
# From DEV server (91.99.11.249), copy these files:
scp -i ~/.ssh/id_deploy /etc/letsencrypt/live/tsf.ci/fullchain.pem root@91.99.186.183:/etc/letsencrypt/live/tsf.ci/
scp -i ~/.ssh/id_deploy /etc/letsencrypt/live/tsf.ci/privkey.pem root@91.99.186.183:/etc/letsencrypt/live/tsf.ci/

# Or just copy the certificate content manually (see CLOUDFLARE_ORIGIN_CERT_SETUP.md)
```

---

## Important Notes

1. **Do NOT deploy on dev server (91.99.11.249)** - it's not where DNS points
2. **Production is at 91.99.186.183** - deploy there
3. **Always test locally first** before checking public URL
4. **Cloudflare cache** - may need to purge cache after deployment
5. **Build time** - expect 30-60 seconds for `npm run build`

---

## Need Help?

If deployment fails:
1. Check service logs: `journalctl -u tsfsystem-frontend.service -n 100`
2. Check build log: `tail -100 /root/TSFSYSTEM/.next/build.log`
3. Check Nginx logs: `tail -50 /var/log/nginx/error.log`
4. Verify ports: `ss -tulpn | grep -E ":3000|:8000"`

---

**Created**: 2026-03-07
**For**: Production deployment on 91.99.186.183
