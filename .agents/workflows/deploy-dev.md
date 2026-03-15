---
description: How to deploy to the dev server 91.99.11.249 (developos.shop / saas.developos.shop)
---

# Deploy to Dev Server (91.99.11.249)

This server runs bare-metal: PM2 for the frontend, gunicorn for the backend, Nginx as the reverse proxy.

## Quick Deploy (Frontend + Backend)

// turbo-all

### Step 1: Sync source files to server
```bash
rsync -avz --update -e "ssh -i ~/.ssh/id_deploy" \
    --exclude node_modules --exclude .next --exclude .git --exclude venv \
    --exclude restored --exclude ARCHIVE --exclude _inventory_mode_src \
    --exclude .backups --exclude dist --exclude releases --exclude __pycache__ \
    /root/.gemini/antigravity/scratch/TSFSYSTEM/src/ \
    root@91.99.11.249:/root/current/src/ 2>&1 | tail -3 && \
rsync -avz --update -e "ssh -i ~/.ssh/id_deploy" \
    --exclude __pycache__ --exclude '*.pyc' \
    /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend/ \
    root@91.99.11.249:/root/current/erp_backend/ 2>&1 | tail -3
```

### Step 2: Build locally (safe — zero server CPU)
```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM && npm run build 2>&1 | tail -5
```

### Step 3: Deploy pre-built bundle to server
```bash
ssh -i ~/.ssh/id_deploy root@91.99.11.249 "pm2 delete tsf-frontend 2>/dev/null; echo stopped" && \
rsync -avz --delete -e "ssh -i ~/.ssh/id_deploy" \
    /root/.gemini/antigravity/scratch/TSFSYSTEM/.next/standalone/ \
    root@91.99.11.249:/root/current/.next/standalone/ 2>&1 | tail -3 && \
rsync -avz --delete -e "ssh -i ~/.ssh/id_deploy" \
    /root/.gemini/antigravity/scratch/TSFSYSTEM/.next/static/ \
    root@91.99.11.249:/root/current/.next/standalone/.next/static/ 2>&1 | tail -3 && \
ssh -i ~/.ssh/id_deploy root@91.99.11.249 "ln -sfn /root/current/public /root/current/.next/standalone/public && pm2 start /root/current/.next/standalone/server.js --name tsf-frontend --cwd /root/current && pm2 save && echo '=== FRONTEND DEPLOYED ==='" && \
ssh -i ~/.ssh/id_deploy root@91.99.11.249 'kill -HUP \$(pgrep -f "gunicorn.*core.wsgi" | head -1) && echo Gunicorn_reloaded || echo No_gunicorn_found'
```

### Step 4: Post-deploy health checks
```bash
echo "🔍 Running post-deploy health checks..." && \
echo "" && \
echo "── 1. PM2 Status ──" && \
ssh -i ~/.ssh/id_deploy root@91.99.11.249 "pm2 jlist 2>/dev/null | python3 -c \"
import json,sys
data=json.load(sys.stdin)
for p in data:
    name=p['name']
    status=p['pm2_env']['status']
    restarts=p['pm2_env']['restart_time']
    uptime=p['pm2_env'].get('pm_uptime',0)
    print(f'  {name}: {status} (restarts: {restarts})')
    if status != 'online': print(f'  ❌ FAIL: {name} is not online!')
    elif restarts > 10: print(f'  ⚠️  WARN: {name} has {restarts} restarts')
    else: print(f'  ✅ OK')
\"" && \
echo "" && \
echo "── 2. Frontend responds ──" && \
STATUS=$(curl -sk -o /dev/null -w '%{http_code}' https://saas.developos.shop/ 2>/dev/null) && \
if [ "$STATUS" = "200" ]; then echo "  ✅ Frontend: HTTP $STATUS"; else echo "  ❌ FAIL: Frontend returned HTTP $STATUS"; fi && \
echo "" && \
echo "── 3. Backend API responds ──" && \
STATUS=$(curl -sk -o /dev/null -w '%{http_code}' https://developos.shop/api/auth/login/ 2>/dev/null) && \
if [ "$STATUS" = "405" ] || [ "$STATUS" = "200" ]; then echo "  ✅ Backend API: HTTP $STATUS (expected)"; else echo "  ❌ FAIL: Backend API returned HTTP $STATUS"; fi && \
echo "" && \
echo "── 4. API Proxy routes to Next.js ──" && \
STATUS=$(curl -sk -o /dev/null -w '%{http_code}' https://developos.shop/api/proxy/auth/me/ 2>/dev/null) && \
if [ "$STATUS" = "200" ] || [ "$STATUS" = "401" ] || [ "$STATUS" = "308" ]; then echo "  ✅ API Proxy: HTTP $STATUS (routed to Next.js)"; else echo "  ❌ FAIL: API Proxy returned HTTP $STATUS (may still route to Django)"; fi && \
echo "" && \
echo "── 5. Backend error log (last 5 errors) ──" && \
ssh -i ~/.ssh/id_deploy root@91.99.11.249 "grep -i 'error\|traceback' /root/current/gunicorn-error.log 2>/dev/null | tail -5 || echo '  No errors found'" && \
echo "" && \
echo "── 6. Frontend error log (recent) ──" && \
ssh -i ~/.ssh/id_deploy root@91.99.11.249 "pm2 logs tsf-frontend --err --nostream --lines 5 2>/dev/null" && \
echo "" && \
echo "🏁 Health check complete."
```

## Backend-Only Deploy (fast — no frontend rebuild needed)
Use this when you only changed Python files in `erp_backend/`.

### Step 1: Sync backend files
```bash
rsync -avz --update -e "ssh -i ~/.ssh/id_deploy" \
    --exclude __pycache__ --exclude '*.pyc' \
    /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend/ \
    root@91.99.11.249:/root/current/erp_backend/ 2>&1 | tail -3
```

### Step 2: Reload gunicorn (zero-downtime)
```bash
ssh -i ~/.ssh/id_deploy root@91.99.11.249 'ps aux | grep "gunicorn.*core.wsgi" | grep -v grep | head -1 | awk "{print \$2}" | xargs kill -HUP && echo "Gunicorn reloaded"'
```

### Step 3: Quick backend health check
```bash
echo "🔍 Backend health check..." && \
STATUS=$(curl -sk -o /dev/null -w '%{http_code}' https://developos.shop/api/auth/login/ 2>/dev/null) && \
if [ "$STATUS" = "405" ] || [ "$STATUS" = "200" ]; then echo "  ✅ Backend API: HTTP $STATUS"; else echo "  ❌ FAIL: Backend returned HTTP $STATUS"; fi && \
ssh -i ~/.ssh/id_deploy root@91.99.11.249 "grep -i 'error\|traceback' /root/current/gunicorn-error.log 2>/dev/null | tail -3 || echo '  No errors'" && \
echo "🏁 Done."
```

## Frontend-Only Deploy
Use this when you only changed TypeScript/TSX/CSS files in `src/`.

### Step 1: Sync frontend files
```bash
rsync -avz --update -e "ssh -i ~/.ssh/id_deploy" \
    --exclude node_modules --exclude .next --exclude .git \
    /root/.gemini/antigravity/scratch/TSFSYSTEM/src/ \
    root@91.99.11.249:/root/current/src/ 2>&1 | tail -3
```

### Step 2: Rebuild and restart
```bash
ssh -i ~/.ssh/id_deploy -o ServerAliveInterval=30 root@91.99.11.249 "pm2 stop tsf-frontend 2>/dev/null; cd /root/current && rm -rf .next && npm run build 2>&1 | tail -5 && ln -sfn /root/current/.next/static /root/current/.next/standalone/.next/static && ln -sfn /root/current/public /root/current/.next/standalone/public && pm2 delete tsf-frontend 2>/dev/null; pm2 start /root/current/.next/standalone/server.js --name tsf-frontend --cwd /root/current && pm2 save && echo 'Frontend deployed'"
```

### Step 3: Quick frontend health check
```bash
echo "🔍 Frontend health check..." && \
STATUS=$(curl -sk -o /dev/null -w '%{http_code}' https://saas.developos.shop/ 2>/dev/null) && \
if [ "$STATUS" = "200" ]; then echo "  ✅ Frontend: HTTP $STATUS"; else echo "  ❌ FAIL: Frontend returned HTTP $STATUS"; fi && \
ssh -i ~/.ssh/id_deploy root@91.99.11.249 "pm2 jlist 2>/dev/null | python3 -c \"
import json,sys
d=json.load(sys.stdin)
for p in d:
    s=p['pm2_env']['status']
    r=p['pm2_env']['restart_time']
    print(f'  {p[\"name\"]}: {s} (restarts: {r})')
    print(f'  {\"✅ OK\" if s==\"online\" and r<10 else \"❌ ISSUE\"}'  )
\"" && \
echo "🏁 Done."
```

## Monitoring
```bash
# Check PM2 status
ssh -i ~/.ssh/id_deploy root@91.99.11.249 "pm2 status"

# Check frontend logs
ssh -i ~/.ssh/id_deploy root@91.99.11.249 "pm2 logs tsf-frontend --nostream --lines 20"

# Check backend logs
ssh -i ~/.ssh/id_deploy root@91.99.11.249 "tail -20 /root/current/gunicorn-error.log"
```
