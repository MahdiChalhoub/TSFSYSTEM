---
description: Deploy TSFSYSTEM to production (tsf.ci) using Docker containers
---

# Production Deployment (tsf.ci)

## Architecture
// turbo-all

All services run in Docker containers. Host nginx handles SSL termination and routing.

| Service        | Container              | Port  | Purpose                |
|-------------- |------------------------|-------|------------------------|
| PostgreSQL     | tsf_prod_postgres      | —     | Database (internal)    |
| Redis          | tsf_prod_redis         | —     | Cache/Celery (internal)|
| Django         | tsf_prod_backend       | 8000  | API (Gunicorn)         |
| Celery Worker  | tsf_prod_celery        | —     | Background tasks       |
| Celery Beat    | tsf_prod_celery_beat   | —     | Scheduled tasks        |
| Next.js        | tsf_prod_frontend      | 3000  | UI (standalone build)  |

Host nginx (`/etc/nginx/sites-enabled/tsf_ci.conf`) routes:
- `/ → localhost:3000` (Next.js)
- `/api/ → localhost:8000` (Django)

## Full Deploy (first time or major update)

1. Run the deploy script with DB migration:
```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM && ./deploy.sh --migrate-db
```

## Quick Deploy (code changes only)

2. Rebuild and restart only backend + frontend:
```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM && ./deploy.sh --quick
```

## Common Operations

3. View logs:
```bash
docker compose -f docker-compose.prod.yml logs -f backend frontend
```

4. Restart backend only:
```bash
docker compose -f docker-compose.prod.yml restart backend
```

5. Check status:
```bash
docker compose -f docker-compose.prod.yml ps
```

6. Stop everything:
```bash
docker compose -f docker-compose.prod.yml down
```

## Switch to Dev Environment

7. Stop prod, start dev:
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.dev.yml up --build -d
```

## Key Files
- `docker-compose.prod.yml` — Production compose (6 services)
- `Dockerfile.backend.prod` — Gunicorn backend
- `Dockerfile.frontend.prod` — Multi-stage Next.js build
- `.env.prod` — Production environment variables
- `deploy.sh` — One-command deploy script
- `/etc/nginx/sites-enabled/tsf_ci.conf` — Host nginx (DO NOT MODIFY via Docker)
