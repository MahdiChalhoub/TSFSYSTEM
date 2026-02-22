# 🚀 TSFSYSTEM: Definitive Production Deployment Guide

This guide details the authoritative workflows for deploying and maintaining the **TSFSYSTEM Intelligence Console** on the production server.

## 🖥️ Server Environment
- **Public IP**: `91.99.186.183`
- **Domain**: `tsf.ci`
- **Architecture**: Docker-based Microservices
- **OS**: Ubuntu 24.04 LTS

---

## 🏗️ The Production Stack
The system operates as a unified Docker stack orchestrated via `docker-compose`:

| Service | Technology | Internal Port | External Visibility |
| :--- | :--- | :--- | :--- |
| **Gateway** | Nginx | 80 / 443 | Entry Point |
| **Frontend** | Next.js 16 | 3000 | `/` |
| **Backend** | Django 5.1 | 8000 | `/api` |
| **Database** | PostgreSQL 16 | 5432 | Internal Only |
| **Cache** | Redis | 6379 | Internal Only |

---

## 🚀 Deployment Workflows

### 1. Full Stack Deployment (Recommended)
Use this command for major updates, infrastructure changes, or fresh installations. It rebuilds all containers and applies migrations.

**Command (on server):**
```bash
cd /root/TSFSYSTEM
chmod +x deploy_production.sh
./deploy_production.sh
```

**What it does:**
- Pulls latest code from `main`
- Rebuilds Docker images (Frontend build included)
- Applies Django database migrations
- Collects static files
- Performs a container health check

### 2. Fast Intelligence Iteration (SSH)
Use this for rapid code-only updates from your local machine. This bypasses the full Docker rebuild and updates the running containers or PM2 processes.

**Command (local):**
```bash
# Using the Smart Deploy workflow
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "cd /root/TSFSYSTEM && git pull origin main && ./deploy_production.sh"
```

---

## 🛠️ Maintenance & Operations

### Viewing Logs
To monitor the real-time heartbeat of the system:
```bash
# All services
docker-compose logs -f

# Specific services
docker-compose logs -f frontend
docker-compose logs -f backend
```

### Database Management
Access the production database directly:
```bash
docker exec -it tsf_db psql -U postgres -d tsfdb
```

### Health Check Diagnostic
If the site is slow or unresponsive, run:
```bash
# Check container status
docker ps

# Check host resource usage
htop
```

---

## 🔐 Security & Access
- **SSH Access**: Restricted to `id_deploy` key.
- **Environment**: Managed via `/root/TSFSYSTEM/.env` (Production secrets).
- **SSL**: Automated renewal via Certbot container.

---

> [!IMPORTANT]
> Always verify `npm run build` locally before pushing to `main` to prevent production downtime.
