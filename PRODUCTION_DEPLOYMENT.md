# Production Deployment & Maintenance Guide

This guide defines the authoritative deployment and maintenance procedures for the TSF ERP production environment.

## 🏗️ System Architecture
- **Domain**: [tsf.ci](https://tsf.ci)
- **Primary IP**: `91.99.186.183`
- **Stack**: Docker-Compose orchestrating:
  - **Gateway**: Nginx (handling SSL via Certbot)
  - **Frontend**: Next.js (Port 3000)
  - **Backend**: Django/Gunicorn (Port 8000)
  - **Database**: PostgreSQL 16 (Port 5432)
  - **Cache/Queue**: Redis

## 🚀 Deployment Procedures

### 1. Atomic Automated Deployment (Preferred)
Use the smart deployment workflow to bridge local changes to the server:
```bash
# From local workspace
./deploy-module.sh [module_name]
```
*Note: This script handles SSH authentication via `id_deploy` and executes atomic migrations.*

### 2. Manual Server Recovery
If the stack is down, use the consolidated Docker command:
```bash
ssh -i ~/.ssh/id_deploy root@91.99.186.183
cd /root/TSFSYSTEM
docker-compose up -d --build
```

### 🔒 The Mutex Rule (Crucial)
Before executing any deployment that affects the database:
1. Check [MASTER_HUB.md](file:///root/TSFSYSTEM/MASTER_HUB.md) for the **Deployment Lock**.
2. If `IDLE`, acquire the lock by writing `[DEPLOYING BY SESSION #XXXX]`.
3. Release the lock to `IDLE` only after successful health checks.

## 🛠️ Maintenance & Troubleshooting

### View Logs
```bash
docker logs -f tsf_backend
docker logs -f tsf_gateway
```

### Database Access
```bash
docker exec -it tsf_db psql -U postgres -d tsfci_db
```

### Resetting Migrations (Disaster Recovery Only)
If migrations become inconsistent:
1. Stop the stack.
2. Delete all `00*.py` files in app migration folders.
3. Run `makemigrations` and `migrate` sequentially in an isolated container.
4. Verify schema via `docker exec tsf_backend python manage.py migrate --check`.

---
*Created by Agent-3 (Session #38152f) - Verified Stable on 2026-02-22*
