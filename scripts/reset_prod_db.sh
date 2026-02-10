#!/bin/bash
# Reset database and run migrations
pm2 stop all
sudo -u postgres psql -p 5433 -c "REVOKE CONNECT ON DATABASE tsfci_db FROM public;"
sudo -u postgres psql -p 5433 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'tsfci_db' AND pid <> pg_backend_pid();"
sudo -u postgres psql -p 5433 -c "DROP DATABASE IF EXISTS tsfci_db;"
sudo -u postgres psql -p 5433 -c "CREATE DATABASE tsfci_db OWNER tsfci;"

cd /root/TSFSYSTEM/erp_backend
source venv/bin/activate

echo "Step 1: Core Django migrations"
python manage.py migrate contenttypes auth sessions authtoken admin

echo "Step 2: ERP Kernel up to modular handover"
python manage.py migrate erp 0037

echo "Step 3: Faking module initial migrations (since tables already exist)"
python manage.py migrate crm --fake-initial
python manage.py migrate finance --fake-initial
python manage.py migrate hr --fake-initial
python manage.py migrate inventory --fake-initial
python manage.py migrate pos --fake-initial

echo "Step 4: Finalizing all migrations"
python manage.py migrate

echo "Step 5: Seeding essential data"
python manage.py seed_kernel_version
python manage.py seed_workflows

echo "Step 6: Starting services"
pm2 start all
