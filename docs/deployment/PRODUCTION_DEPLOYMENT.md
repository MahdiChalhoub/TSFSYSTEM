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

### Database Backup & Restore
**Always backup before deploying schema changes.**

**Create Snapshot:**
```bash
docker exec -t tsf_db pg_dump -U postgres -F c tsfci_db > /root/backups/tsfci_db_$(date +%Y%m%d_%H%M%S).dump
```

**Restore Snapshot (Disaster Recovery):**
```bash
# 1. Stop backend & frontend to prevent connections
docker-compose stop tsf_backend tsf_frontend
# 2. Drop and recreate DB
docker exec -it tsf_db psql -U postgres -c "DROP DATABASE tsfci_db;"
docker exec -it tsf_db psql -U postgres -c "CREATE DATABASE tsfci_db;"
# 3. Restore from dump
docker exec -i tsf_db pg_restore -U postgres -d tsfci_db < /root/backups/tsfci_db_YOUR_DATE.dump
# 4. Restart stack
docker-compose start
```

### Safe Migration Rollbacks
If a deployment introduces a bad migration, **do NOT delete migration files**. 
Use Django's built-in rollback to reverse the schema change safely:
```bash
# Example: Rollback 'sales' app to migration 0014
docker exec -it tsf_backend python manage.py migrate sales 0014
```

---
*Created by Agent-3 (Session #38152f) - Verified Stable on 2026-02-22*
