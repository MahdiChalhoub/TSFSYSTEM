# 🚀 Zero-Downtime Deployment System

## Goal
Eliminate downtime during system updates. The application remains **Always Online** for users, with automatic rollback if a deployment fails.

## 🏗️ Architecture

### Atomic Symlink Swap
Instead of updating files in-place (which causes brief breakage), we:
1. Build the new version in an isolated `/root/releases/<timestamp>/` directory.
2. Atomically swap a `/root/current` symlink to point to the new release.
3. Gracefully reload workers so they pick up the new code.

### Graceful Gunicorn Restart
- **SIGHUP** to the master process tells it to spawn new workers with the new code.
- Old workers finish their in-flight requests before exiting.
- Result: **Zero dropped requests** during deployment.

## 📁 Files

| File | Purpose |
|------|---------|
| `scripts/deploy_atomic.sh` | Server-side atomic deployment pipeline (7-step) |
| `scripts/deploy_zero_downtime.ps1` | Local PowerShell deployment wrapper |
| `erp_backend/gunicorn.conf.py` | Production Gunicorn config with graceful hooks |
| `erp_backend/erp/middleware_maintenance.py` | 503 "Optimizing" middleware for long migrations |

## 🔄 Workflow

### Standard Deploy (from local machine)
```powershell
.\scripts\deploy_zero_downtime.ps1
```

### Rollback
```powershell
.\scripts\deploy_zero_downtime.ps1 -Rollback
```

### Health Check Only
```powershell
.\scripts\deploy_zero_downtime.ps1 -HealthOnly
```

### Dry Run (Preview)
```powershell
.\scripts\deploy_zero_downtime.ps1 -DryRun
```

## 🛡️ Auto-Rollback

After each deployment, the system pings `/api/health/` for 30 seconds.
- ✅ **HTTP 200**: Deploy is confirmed, old releases are cleaned up.
- ❌ **No 200 after 30s**: Symlink is automatically rolled back to the previous release.

## ⚙️ Gunicorn Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| `workers` | `min(CPU*2+1, 4)` | Optimal concurrency |
| `worker_class` | `gthread` | Thread-based workers for I/O |
| `graceful_timeout` | `30s` | Time for workers to finish in-flight requests |
| `max_requests` | `1000` | Auto-recycle workers to prevent memory leaks |
| `preload_app` | `True` | Shared memory across workers |

## 🔧 Maintenance Mode

For deployments that require long database migrations:
1. The deploy script touches `/tmp/tsf_maintenance`.
2. The `MaintenanceModeMiddleware` returns a 503 with a friendly JSON message.
3. The frontend shows a brief "Optimizing Experience" overlay.
4. After migration completes, the flag is removed and traffic flows normally.

## 📊 Data Flow

```
Local Machine → git push → Server pulls code → Build in /releases/TIMESTAMP/
→ Pre-flight check → Atomic symlink swap → SIGHUP Gunicorn
→ Health check → Success? → Confirm | Auto-Rollback
```

## 📁 Affected Tables / Models
- None (infrastructure only, no database changes)

## 📖 Pages That Read/Write
- `/api/health/` — Read by health check system
