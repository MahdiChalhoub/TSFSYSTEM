# Production Deployment — tsf.ci

## Overview
The Blanc Engine (TSFSYSTEM) is deployed on a Hetzner VPS at `tsf.ci` (IP: 91.99.186.183).

## Architecture

```
Internet → Nginx (port 80/443 + SSL)
              ├── tsf.ci/ → Next.js (PM2, port 3000)
              └── tsf.ci/api/ → Django/Gunicorn (PM2, port 8000)
                              └── PostgreSQL 16 (port 5433)
```

## Server Details
| Component | Value |
|-----------|-------|
| **Server** | Hetzner VPS, Ubuntu 24.04 |
| **IP** | 91.99.186.183 |
| **Domain** | tsf.ci |
| **SSH Key** | `~/.ssh/id_deploy` |
| **App Path** | `/root/TSFSYSTEM` |
| **Node.js** | v22.22.0 |
| **Python** | 3.12.3 |
| **DB** | PostgreSQL 16, port 5433 |
| **SSL** | Let's Encrypt (auto-renews) |

## Services (PM2)
| Process | What | Port |
|---------|------|------|
| `nextjs` | Next.js frontend production build | 3000 |
| `django` | Gunicorn + Django REST backend | 8000 |

## Data Flow
- **Frontend reads from**: Backend API at `/api/`
- **Backend reads from**: PostgreSQL database `tsfci_db`
- **Backend saves to**: PostgreSQL database `tsfci_db`
- **Nginx**: Reverse proxies all traffic to the correct service
- **SSL**: Certbot auto-renews certificates via systemd timer

## Deploy Workflow
Use the `/deploy` workflow command to deploy:
1. Pre-deploy checks run locally (Django check + Next.js build)
2. SSH into server → git pull → npm build → restart PM2
3. Verify services with health check

## Files Modified / Created
- `.agent/workflows/deploy.md` — Deploy workflow
- `scripts/server_setup.sh` — Initial server setup script
- `scripts/nginx_tsf_ci.conf` — Nginx config template
- `scripts/fix_prod_migrations.sh` — Migration fix for fresh DB
- `SSH_PUBLIC_KEY.txt` — SSH deploy key (public)

## Database
- **Database name**: tsfci_db
- **User**: tsfci
- **Host**: localhost:5433
- **Tables**: Created via Django migrations (PascalCase from 0001-0030 migrations)
- **Migration state**: All migrations faked for fresh production DB

## Environment Files (on server)
- `/root/TSFSYSTEM/.env` — Frontend environment (NEXT_PUBLIC_API_URL)
- `/root/TSFSYSTEM/erp_backend/.env` — Backend environment (DB credentials, ALLOWED_HOSTS, CORS)

## Important Notes
- Docker was disabled to free port 80 for Nginx
- PM2 is configured to auto-start on server reboot via `pm2 startup`
- The production DB uses `core.settings` (not `erp_system.settings` like local dev)
