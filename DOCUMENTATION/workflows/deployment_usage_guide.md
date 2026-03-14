# Deployment & Server Usage Guide

This guide details how to deploy and manage the TSF ERP system on the production server.

## 🖥️ Server Information
- **Public IP**: `91.99.186.183`
- **Domain**: `tsf.ci` (wildcard `*.tsf.ci` for multi-tenant subdomains)
- **Operating System**: Ubuntu Linux (Bare-metal, no Docker)
- **Architecture**: Nginx (SSL/Proxy) → Next.js 16 Frontend (Port 3000) + Django/Gunicorn Backend (Port 8000) + PostgreSQL 16
- **Python**: 3.12 (virtualenv at `erp_backend/.venv/`)
- **Node**: v22

---

## 🚀 Deployment Methods

### 1. Fresh Server Setup
For a brand new server:

```bash
# 1. Clone the repo
git clone <repo-url> /root/.gemini/antigravity/scratch/TSFSYSTEM
cd /root/.gemini/antigravity/scratch/TSFSYSTEM

# 2. Backend setup
cd erp_backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. Frontend setup
cd /root/.gemini/antigravity/scratch/TSFSYSTEM
npm install
npm run build

# 4. Database setup
sudo -u postgres createdb tsfdb
cd erp_backend
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_core
.venv/bin/python manage.py createsuperuser

# 5. Install systemd services (see Service Configuration below)
# 6. Configure Nginx (see Nginx section below)
```

### 2. Standard Update (Code Changes)
To update the system without wiping the database:
```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM

# Pull latest changes
git fetch origin engine-stable
git reset --hard origin/engine-stable

# Backend: install any new dependencies + run migrations
cd erp_backend
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate

# Frontend: rebuild
cd /root/.gemini/antigravity/scratch/TSFSYSTEM
npm install
npm run build

# Restart services
sudo systemctl restart tsfsystem.service
sudo systemctl restart tsfsystem-frontend.service
```

---

## 🏗️ Post-Deployment Configuration

### Database Handshake
If doing a fresh install or resetting the database:
```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend

# Activate virtualenv
source .venv/bin/activate

# Run Migrations
python manage.py migrate

# Seed Core Platform (Essential for SaaS Panel)
python manage.py seed_core

# Create superuser
python manage.py createsuperuser

# Synchronize Modules
python manage.py shell -c "from erp.module_manager import ModuleManager; ModuleManager.sync()"
```

### Accessing the System
| Service | URL |
| :--- | :--- |
| **Landing Page** | `https://tsf.ci` |
| **SaaS Master Panel** | `https://tsf.ci/saas` or `https://saas.tsf.ci` |
| **Login (Workspace)** | `https://tsf.ci/login` |
| **Tenant Workspace** | `https://<slug>.tsf.ci/dashboard` |

---

## ⚙️ Service Configuration

### Backend Service (`tsfsystem.service`)
Location: `/etc/systemd/system/tsfsystem.service`
```ini
[Unit]
Description=TSFSYSTEM ERP Backend (Gunicorn)
After=network.target postgresql@16-main.service
Requires=postgresql@16-main.service

[Service]
Type=notify
User=root
WorkingDirectory=/root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend
ExecStart=/root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend/.venv/bin/gunicorn \
    core.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 9 \
    --timeout 120 \
    --max-requests 1000 \
    --max-requests-jitter 50 \
    --access-logfile /var/log/tsfsystem-access.log \
    --error-logfile /var/log/tsfsystem-error.log
Restart=always
RestartSec=5
StandardOutput=append:/var/log/tsfsystem.log
StandardError=append:/var/log/tsfsystem-error.log

[Install]
WantedBy=multi-user.target
```

### Frontend Service (`tsfsystem-frontend.service`)
Location: `/etc/systemd/system/tsfsystem-frontend.service`
```ini
[Unit]
Description=TSFSYSTEM Frontend (Next.js)
After=network.target tsfsystem.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/.gemini/antigravity/scratch/TSFSYSTEM
ExecStart=/root/.gemini/antigravity/scratch/TSFSYSTEM/node_modules/.bin/next start --port 3000 --hostname 0.0.0.0
Environment=NODE_ENV=production
Environment=PORT=3000
Restart=always
RestartSec=5
StandardOutput=append:/var/log/tsfsystem-frontend.log
StandardError=append:/var/log/tsfsystem-frontend-error.log

[Install]
WantedBy=multi-user.target
```

### Dependency Chain
```
PostgreSQL 16 (system service, port 5432)
    └── tsfsystem.service (Gunicorn on :8000, starts after PostgreSQL)
        └── tsfsystem-frontend.service (Next.js on :3000, starts after backend)
            └── Nginx (proxies: / → :3000, /api/ → :8000)
```

---

## 🛠️ Common Maintenance Commands

### Service Management
| Command | Purpose |
|---------|---------|
| `systemctl status tsfsystem.service` | Check backend health |
| `systemctl status tsfsystem-frontend.service` | Check frontend health |
| `systemctl restart tsfsystem.service` | Restart backend |
| `systemctl restart tsfsystem-frontend.service` | Restart frontend |
| `systemctl stop tsfsystem.service` | Stop backend |

### Viewing Logs
```bash
# Backend logs
tail -f /var/log/tsfsystem-error.log
tail -f /var/log/tsfsystem-access.log

# Frontend logs
tail -f /var/log/tsfsystem-frontend.log
tail -f /var/log/tsfsystem-frontend-error.log

# Systemd journal (real-time)
journalctl -u tsfsystem.service -f
journalctl -u tsfsystem-frontend.service -f
```

### Database Management
```bash
# Connect to database
sudo -u postgres psql -d tsfdb

# Backup database
sudo -u postgres pg_dump tsfdb | gzip > /root/backups/tsfdb_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore database
gunzip -c backup.sql.gz | sudo -u postgres psql tsfdb
```

---

## ⚠️ Important Notes
- **Subdomains**: Browsers do not support subdomains on direct IP addresses. For multi-tenant features (e.g., `tenant1.tsf.ci`), a domain must be pointing to the IP, and `NEXT_PUBLIC_ROOT_DOMAIN` must be set in `.env.production`.
- **Environment**: The `.env` file is for **development only** (`NEXT_PUBLIC_ROOT_DOMAIN=localhost`). Production values are in `.env.production` (`NEXT_PUBLIC_ROOT_DOMAIN=tsf.ci`).
- **Build**: The frontend must be rebuilt (`npm run build`) after any code or `.env` changes. Environment variables are baked into the Next.js build at build time for `NEXT_PUBLIC_*` vars.

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
sudo systemctl restart tsfsystem.service
sudo systemctl restart tsfsystem-frontend.service
```
