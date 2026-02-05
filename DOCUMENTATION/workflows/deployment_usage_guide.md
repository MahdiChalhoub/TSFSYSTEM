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

---

## 🔐 Production Security Settings

### Enable Package Signature Verification
In production, you should **require signed packages** to prevent fake/malicious module and kernel updates:

```python
# core/settings.py (or settings_production.py)
REQUIRE_PACKAGE_SIGNATURES = True
```

### Generate & Deploy Signing Keys
1. Generate key pair on your local machine:
```bash
python scripts/generate_keys.py keys/
```

2. Copy the public key to `erp/security_keys.py:PLATFORM_PUBLIC_KEY_PEM`

3. Keep `private_key.pem` secret - use it to sign packages before distribution

### Sign Packages Before Distribution
```bash
python scripts/sign_package.py dist/module.modpkg.zip keys/private_key.pem
# Creates: module.signed.modpkg.zip
```

---

## 🔄 Kernel Update Workflow (Production)

When you need to update your production engine:

1. **Check current version** on production at `/kernel` page
2. **Request kernel update** from administrator with version number
3. **Receive signed `.kernel.zip`** package
4. **Upload via** `/kernel` page → "Upload Kernel"
5. **Review changelog** → Click "Apply Update"
6. **Restart services** if required:
```bash
docker-compose restart backend
```
