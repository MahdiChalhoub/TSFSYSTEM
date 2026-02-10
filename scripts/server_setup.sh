#!/bin/bash
# Server setup script for tsf.ci deployment
set -e

echo "=== Step 1: Fix PostgreSQL DB user ==="
sudo -u postgres psql -p 5433 -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tsfci') THEN CREATE ROLE tsfci WITH LOGIN PASSWORD 'tsfci_secure_2026' SUPERUSER; END IF; END \$\$;"
sudo -u postgres psql -p 5433 -c "SELECT 1 FROM pg_database WHERE datname = 'tsfci_db'" | grep -q 1 || sudo -u postgres createdb -p 5433 -O tsfci tsfci_db
echo "DB ready: tsfci_db"

echo "=== Step 2: Switch repo to main branch ==="
cd /root/TSFSYSTEM
git fetch origin
git checkout main
git pull origin main
echo "On branch: $(git branch --show-current)"

echo "=== Step 3: Create backend .env ==="
cat > erp_backend/.env << 'ENVFILE'
DEBUG=False
SECRET_KEY=tsf-production-secret-key-change-me-2026
DATABASE_URL=postgresql://tsfci:tsfci_secure_2026@localhost:5433/tsfci_db
DB_NAME=tsfci_db
DB_USER=tsfci
DB_PASSWORD=tsfci_secure_2026
DB_HOST=localhost
DB_PORT=5433
ALLOWED_HOSTS=tsf.ci,www.tsf.ci,91.99.186.183,localhost
CORS_ALLOWED_ORIGINS=https://tsf.ci,https://www.tsf.ci,http://localhost:3000
ENVFILE
echo "Backend .env created"

echo "=== Step 4: Create frontend .env ==="
cat > .env.production << 'ENVFILE'
NEXT_PUBLIC_API_URL=https://tsf.ci/api
NEXT_PUBLIC_BACKEND_URL=https://tsf.ci
ENVFILE
echo "Frontend .env.production created"

echo "=== Step 5: Python venv + deps ==="
cd erp_backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install django djangorestframework django-cors-headers psycopg2-binary gunicorn Pillow djangorestframework-simplejwt python-dotenv whitenoise 2>&1 | tail -5
echo "Python deps installed"

echo "=== Step 6: Install PM2 ==="
npm install -g pm2 2>&1 | tail -3
echo "PM2 installed"

echo "=== Step 7: Install npm deps + build frontend ==="
cd /root/TSFSYSTEM
npm install 2>&1 | tail -5
npm run build 2>&1 | tail -10
echo "Frontend built"

echo "=== DONE ==="
echo "Next: Configure Nginx + start services"
