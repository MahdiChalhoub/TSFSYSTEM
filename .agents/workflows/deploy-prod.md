---
description: "⛔ ARCHIVED — Do NOT use on this server. Production deploys happen on a separate production server only. Use /docker-dev instead."
---

# ⛔ Production Deployment — ARCHIVED

> **CRITICAL RULE**: Development and production MUST NEVER run on the same server.
> This workflow is archived. Production will be deployed to a dedicated production server in the future.

## Current Policy (Effective 2026-04-17)

1. **This server is DEVELOPMENT ONLY** — always use `/docker-dev` workflow
2. **Never run `./deploy.sh`** on this server — it causes 5-7 minute downtime per change
3. **Hot reload is mandatory** — all code changes must reflect instantly via Turbopack/Django auto-restart
4. **Production deployment** will be configured on a separate dedicated server

## For ALL Agents

- **DO NOT** use `docker-compose.prod.yml` on this server
- **DO NOT** run `./deploy.sh` in any form
- **ALWAYS** use `docker-compose.dev.yml` via the `/docker-dev` workflow
- If prod containers are running, stop them first: `docker compose -f docker-compose.prod.yml down`

## Future Production Server

When a dedicated production server is provisioned:
- This workflow will be updated with the new server's deployment instructions
- Production deploys will target that server only
- This development server will never serve production traffic

## Reference (for future prod server setup)

| Service        | Container              | Port  | Purpose                |
|-------------- |------------------------|-------|------------------------|
| PostgreSQL     | tsf_prod_postgres      | —     | Database (internal)    |
| Redis          | tsf_prod_redis         | —     | Cache/Celery (internal)|
| Django         | tsf_prod_backend       | 8000  | API (Gunicorn)         |
| Celery Worker  | tsf_prod_celery        | —     | Background tasks       |
| Celery Beat    | tsf_prod_celery_beat   | —     | Scheduled tasks        |
| Next.js        | tsf_prod_frontend      | 3000  | UI (standalone build)  |

## Key Files (kept for reference)
- `docker-compose.prod.yml` — Production compose (6 services)
- `Dockerfile.backend.prod` — Gunicorn backend
- `Dockerfile.frontend.prod` — Multi-stage Next.js build
- `.env.prod` — Production environment variables
- `deploy.sh` — One-command deploy script
