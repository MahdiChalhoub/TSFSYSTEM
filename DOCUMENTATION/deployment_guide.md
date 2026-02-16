# 🚀 Deployment Guide — Getting Started

## Quick Reference

You have **3 deploy options** depending on what changed:

| What changed | Command |
|---|---|
| Frontend only | `/deploy-frontend` |
| Backend only | `/deploy-backend` |
| Both (or migrations) | `/deploy` |
| Auto-detect | `/deploy-smart` |

---

## Step-by-Step: Deploy Current Changes

Since we have both **frontend** (vouchers page) and **backend** (model/viewset changes + migrations), you need a **full deploy**.

### Step 1: Commit & Push (Local)
```powershell
# Check what's pending
git status

# Stage and commit
git add .
git commit -m "[v2.10.0-b002] FINANCE: TaxGroup serializer + uncommitted POS changes"
git push origin main
```

### Step 2: Build Check (Local)
```powershell
npx next build
```
> If this fails, do NOT deploy. Fix errors first.

### Step 3: Deploy to Server
```powershell
# Full deploy (frontend + backend + migrations)
ssh -i $env:USERPROFILE\.ssh\id_deploy root@91.99.186.183 "cd /root/TSFSYSTEM && git stash && git pull origin main && npm install && npm run build && cd erp_backend && source venv/bin/activate && pip install -r requirements.txt && python manage.py migrate --no-input && python manage.py collectstatic --noinput && pm2 restart all"
```

### Step 4: Verify
```powershell
# Check services are running
ssh -i $env:USERPROFILE\.ssh\id_deploy root@91.99.186.183 "pm2 status && curl -s -o /dev/null -w 'Frontend: HTTP %{http_code}\n' https://tsf.ci && curl -s -o /dev/null -w 'Backend: HTTP %{http_code}\n' https://tsf.ci/api/"
```
> Expected: pm2 shows "online", Frontend: HTTP 200, Backend: HTTP 200/401

---

## Or Use Smart Deploy (Automatic)
```powershell
.\scripts\deploy-agent.ps1          # Auto-detect changes
.\scripts\deploy-agent.ps1 -DryRun  # Preview without deploying
```

---

## ⚠️ Important for THIS Deploy

The Voucher model migration needs database changes:
- `lifecycle_status` column added (replaces `status`)
- `locked_by`, `locked_at`, `current_verification_level` columns from `VerifiableModel`
- `is_posted` boolean column added
- Old `status` column removed

The `python manage.py migrate` in Step 3 handles this automatically.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| SSH fails | Check `~/.ssh/id_deploy` exists |
| Build fails on server | Run the build command separately |
| Migration fails | SSH in manually and run `python manage.py makemigrations finance` first |
| pm2 won't restart | `pm2 delete all` then re-run start_django.sh |
| Site shows 502 | Wait 30s for services to boot, then check `pm2 logs` |
