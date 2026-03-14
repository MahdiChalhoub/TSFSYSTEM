# Server Systemd Services

## Goal
Ensure Django backend and Next.js frontend auto-restart on crash or server reboot.

## Services

### `tsfsystem.service`
- **Purpose**: Runs Django via Gunicorn on port 8000
- **Location**: `/etc/systemd/system/tsfsystem.service`
- **Working Dir**: `/root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend`
- **Executable**: `.venv/bin/gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 9 --timeout 120 --max-requests 1000 --max-requests-jitter 50`
- **Restart**: `always` with 5s delay
- **Logs**: `/var/log/tsfsystem-access.log`, `/var/log/tsfsystem-error.log`

### `tsfsystem-frontend.service`
- **Purpose**: Runs Next.js 16 production server on port 3000
- **Location**: `/etc/systemd/system/tsfsystem-frontend.service`
- **Working Dir**: `/root/.gemini/antigravity/scratch/TSFSYSTEM`
- **Executable**: `node_modules/.bin/next start --port 3000 --hostname 0.0.0.0`
- **Restart**: `always` with 5s delay
- **Env Vars**: `NODE_ENV=production`, `PORT=3000`
- **Note**: `DJANGO_URL` and `NEXT_PUBLIC_ROOT_DOMAIN` are loaded from `.env.production`

### Dependency Chain
```
PostgreSQL 16 (system service, port 5432)
    └── tsfsystem.service (Gunicorn on :8000, starts after PostgreSQL)
        └── tsfsystem-frontend.service (Next.js on :3000, starts after backend)
            └── Nginx (proxies: / → :3000, /api/ → :8000)
```

## Common Commands

| Command | Purpose |
|---------|---------|
| `systemctl status tsfsystem.service` | Check backend health |
| `systemctl status tsfsystem-frontend.service` | Check frontend health |
| `systemctl restart tsfsystem.service` | Restart backend |
| `systemctl restart tsfsystem-frontend.service` | Restart frontend |
| `journalctl -u tsfsystem.service -f` | Live backend logs |
| `journalctl -u tsfsystem-frontend.service -f` | Live frontend logs |
| `systemctl stop tsfsystem.service` | Stop backend |

## Auto-Restart Behavior
- If a service crashes, systemd restarts it after 5 seconds
- Rate-limited: max 5 restarts in 60 seconds to prevent crash loops
- Services are `enabled` — they auto-start on server reboot

## Where Data Is READ/SAVED
- Services are config files only — they don't read/save business data
- Backend reads/writes via PostgreSQL 16 (port 5432, database `tsfdb`)
- Frontend reads from backend API via `DJANGO_URL=http://127.0.0.1:8000`

## Step-by-Step Workflow
1. On server boot, systemd starts `tsfsystem.service` (Gunicorn on :8000)
2. After backend is ready, `tsfsystem-frontend.service` starts (Next.js on :3000)
3. Nginx proxies: `/api/` → :8000, everything else → :3000
4. If Gunicorn crashes, systemd detects exit and restarts after 5s
5. If Next.js crashes, same auto-restart behavior
