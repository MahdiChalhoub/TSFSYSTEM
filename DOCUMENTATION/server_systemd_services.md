# Server Systemd Services

## Goal
Ensure Django backend and Next.js frontend auto-restart on crash or server reboot.

## Services

### `tsf-backend.service`
- **Purpose**: Runs Django via Gunicorn on port 8000
- **Location**: `/etc/systemd/system/tsf-backend.service`
- **Working Dir**: `/root/TSFSYSTEM/erp_backend`
- **Executable**: `/root/TSFSYSTEM/erp_backend/venv/bin/gunicorn core.wsgi:application --bind 127.0.0.1:8000 --workers 3`
- **Restart**: `always` with 5s delay
- **Logs**: `/var/log/tsf-backend-access.log`, `/var/log/tsf-backend-error.log`

### `tsf-frontend.service`
- **Purpose**: Runs Next.js production server on port 3000
- **Location**: `/etc/systemd/system/tsf-frontend.service`
- **Working Dir**: `/root/TSFSYSTEM`
- **Executable**: `/usr/bin/node node_modules/.bin/next start -p 3000`
- **Restart**: `always` with 5s delay
- **Env Vars**: `NEXT_PUBLIC_ROOT_DOMAIN=tsf.ci`, `DJANGO_URL=http://127.0.0.1:8000`

### Dependency Chain
```
tsf-backend.service (starts first)
    └── tsf-frontend.service (starts after backend, Wants=tsf-backend)
        └── nginx (proxies to both)
```

## Common Commands

| Command | Purpose |
|---------|---------|
| `systemctl status tsf-backend.service` | Check backend health |
| `systemctl status tsf-frontend.service` | Check frontend health |
| `systemctl restart tsf-backend.service` | Restart backend |
| `systemctl restart tsf-frontend.service` | Restart frontend |
| `journalctl -u tsf-backend.service -f` | Live backend logs |
| `journalctl -u tsf-frontend.service -f` | Live frontend logs |
| `systemctl stop tsf-backend.service` | Stop backend |

## Auto-Restart Behavior
- If a service crashes, systemd restarts it after 5 seconds
- Rate-limited: max 5 restarts in 60 seconds to prevent crash loops
- Services are `enabled` — they auto-start on server reboot

## Where Data Is READ/SAVED
- Services are config files only — they don't read/save business data
- Backend reads/writes via PostgreSQL
- Frontend reads from backend API

## Step-by-Step Workflow
1. On server boot, systemd starts `tsf-backend.service` (gunicorn on :8000)
2. After backend is ready, `tsf-frontend.service` starts (Next.js on :3000)
3. Nginx proxies: `/api/` → :8000, everything else → :3000
4. If gunicorn crashes, systemd detects exit and restarts after 5s
5. If Next.js crashes, same auto-restart behavior
