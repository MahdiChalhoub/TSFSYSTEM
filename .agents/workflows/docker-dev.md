---
description: Start development environment with Docker (isolated, crash-safe)
---

# Docker Development Environment

## Start Everything
// turbo-all

1. Build and start all services (first time takes ~2-3 min, subsequent starts are instant):
```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM && docker compose -f docker-compose.dev.yml up --build -d
```

2. Check all services are healthy:
```bash
docker compose -f docker-compose.dev.yml ps
```

3. View logs (follow mode):
```bash
docker compose -f docker-compose.dev.yml logs -f frontend backend
```

## Common Operations

### Restart only frontend (after a crash or code issue):
```bash
docker compose -f docker-compose.dev.yml restart frontend
```

### Restart only backend:
```bash
docker compose -f docker-compose.dev.yml restart backend
```

### View frontend logs only:
```bash
docker compose -f docker-compose.dev.yml logs -f frontend
```

### Stop everything:
```bash
docker compose -f docker-compose.dev.yml down
```

### Full reset (including database):
```bash
docker compose -f docker-compose.dev.yml down -v
```

## Architecture

| Service    | Container   | Port | Memory Limit | Auto-Restart |
|------------|-------------|------|-------------|-------------|
| PostgreSQL | `db`        | 5432 | 512 MB      | ✅           |
| Django     | `backend`   | 8000 | 1 GB        | ✅           |
| Next.js    | `frontend`  | 3000 | 3 GB        | ✅           |
| Redis      | `redis`     | 6379 | 256 MB      | ✅           |

## Hot Reload
- **Frontend**: Edit any file in `src/` → Turbopack auto-recompiles
- **Backend**: Edit any file in `erp_backend/` → Django auto-restarts
- **No manual restart needed** for code changes

## Crash Isolation
- If frontend crashes → **only frontend container restarts**
- Backend + Database + Redis continue running unaffected
- POS terminals stay connected via backend
