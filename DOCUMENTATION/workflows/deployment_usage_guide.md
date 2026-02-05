# Deployment & Server Usage Guide

This guide details how to deploy and manage the TSF ERP system on the production server.

## 🖥️ Server Information
- **Public IP**: `91.99.186.183`
- **Operating System**: Linux (Ubuntu/Debian)
- **Architecture**: Docker-based (Nginx Gateway, Next.js Frontend, Django Backend, PostgreSQL)

---

## 🚀 Deployment Methods

### 1. Automated Setup (Recommended)
The system includes a `setup_server.sh` script that automates the entire process:
- Pulls the latest code from the `engine-stable` branch.
- Cleans up existing Docker containers.
- Resolves Port 80 conflicts (stops Apache/Nginx if running).
- Builds and starts the application stack.
- Provides interactive database initialization (Migration, Superuser creation, Seeding).

**How to run:**
```bash
chmod +x setup_server.sh
./setup_server.sh
```

### 2. Manual Update (Standard)
To update the system without wiping the database:
```bash
# Pull latest changes
git fetch origin engine-stable
git reset --hard origin/engine-stable

# Rebuild and restart services
docker-compose up -d --build
```

---

## 🏗️ Post-Deployment Configuration

### Database Handshake
If you are doing a fresh install or resetting the database, run these commands inside the containers:
```bash
# Enter Backend Container
docker exec -it tsf_backend bash

# Run Migrations
python manage.py migrate

# Seed Core Platform (Essential for SaaS Panel)
python manage.py seed_core

# Synchronize Modules
python manage.py shell -c "from erp.module_manager import ModuleManager; ModuleManager.sync()"
```

### Accessing the System
| Service | URL |
| :--- | :--- |
| **Landing Page** | `http://91.99.186.183` |
| **SaaS Master Panel** | `http://91.99.186.183/saas` |
| **Login (Workspace)** | `http://91.99.186.183/login` |

---

## 🛠️ Common Maintenance Commands

### Viewing Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Restarting Services
```bash
docker-compose restart
```

### Troubleshooting Port 80
If Nginx fails to start due to port binding:
```bash
sudo fuser -k 80/tcp
docker-compose up -d nginx
```

---

## ⚠️ Important Notes
- **Subdomains**: Browsers do not support subdomains on direct IP addresses. For multi-tenant features (e.g., `tenant1.tsf.ci`), a domain must be pointing to the IP, and `NEXT_PUBLIC_ROOT_DOMAIN` must be set in `.env`.
- **Environment**: Ensure `.env` files are correctly configured on the server for production settings.
