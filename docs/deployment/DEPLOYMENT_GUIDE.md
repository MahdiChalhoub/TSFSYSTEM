# 🚀 TSFSYSTEM DEPLOYMENT GUIDE

**Purpose**: Production deployment guide for TSFSYSTEM ERP with Kernel OS v2.0
**Version**: 1.0.0
**Date**: 2026-03-04

---

## 📋 TABLE OF CONTENTS

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Application Deployment](#application-deployment)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Monitoring Setup](#monitoring-setup)
7. [Rollback Procedures](#rollback-procedures)
8. [Security Hardening](#security-hardening)

---

## ✅ PRE-DEPLOYMENT CHECKLIST

Before deploying to production, ensure:

### **Code Quality**
- [ ] All integration tests pass (`python manage.py test`)
- [ ] Architecture enforcement passes (`python3 .ai/enforcement/enforce.py check`)
- [ ] No critical violations in enforcement baseline
- [ ] All event contracts registered and validated
- [ ] Code review completed and approved
- [ ] Security audit completed

### **Documentation**
- [ ] API documentation up to date
- [ ] Event contracts documented
- [ ] Deployment runbook reviewed
- [ ] Disaster recovery plan in place
- [ ] Monitoring alerts configured

### **Infrastructure**
- [ ] Production database provisioned
- [ ] Redis instance configured
- [ ] SSL certificates installed
- [ ] CDN configured for static assets
- [ ] Backup system operational
- [ ] Load balancer configured

### **Configuration**
- [ ] Environment variables configured
- [ ] Secrets stored securely (AWS Secrets Manager, Vault, etc.)
- [ ] Database connection strings validated
- [ ] Third-party API keys configured
- [ ] Email service configured
- [ ] Logging aggregation configured

---

## 🔧 ENVIRONMENT SETUP

### **1. Server Requirements**

**Minimum Production Specifications**:
- **Web Server**: 2 vCPU, 4GB RAM (recommend: 4 vCPU, 8GB RAM)
- **Worker Server**: 2 vCPU, 4GB RAM (for Celery workers)
- **Database**: PostgreSQL 16+ with 4 vCPU, 8GB RAM
- **Cache**: Redis 7+ with 2 vCPU, 2GB RAM
- **Storage**: 100GB SSD minimum

**Operating System**: Ubuntu 22.04 LTS or newer

### **2. Install System Dependencies**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3.12
sudo apt install -y python3.12 python3.12-venv python3.12-dev

# Install PostgreSQL client
sudo apt install -y postgresql-client

# Install Redis client
sudo apt install -y redis-tools

# Install Nginx
sudo apt install -y nginx

# Install supervisor (for process management)
sudo apt install -y supervisor

# Install build essentials
sudo apt install -y build-essential libpq-dev
```

### **3. Create Application User**

```bash
# Create dedicated user
sudo adduser --system --group --home /opt/tsfsystem tsfsystem

# Create application directories
sudo mkdir -p /opt/tsfsystem/{app,logs,static,media}
sudo chown -R tsfsystem:tsfsystem /opt/tsfsystem
```

### **4. Clone Repository**

```bash
# Switch to application user
sudo su - tsfsystem

# Clone repository
cd /opt/tsfsystem
git clone <your-repo-url> app
cd app

# Checkout production branch
git checkout main
```

### **5. Setup Virtual Environment**

```bash
# Create virtual environment
python3.12 -m venv /opt/tsfsystem/venv

# Activate virtual environment
source /opt/tsfsystem/venv/bin/activate

# Upgrade pip
pip install --upgrade pip setuptools wheel

# Install dependencies
cd /opt/tsfsystem/app/erp_backend
pip install -r requirements.txt

# Install production dependencies
pip install gunicorn psycopg2-binary redis celery[redis]
```

---

## 🗄️ DATABASE SETUP

### **1. Create Production Database**

```sql
-- Connect to PostgreSQL as superuser
sudo -u postgres psql

-- Create database user
CREATE USER tsfsystem_prod WITH PASSWORD 'SECURE_PASSWORD_HERE';

-- Create database
CREATE DATABASE tsfsystem_prod OWNER tsfsystem_prod;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE tsfsystem_prod TO tsfsystem_prod;

-- Enable required extensions
\c tsfsystem_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Exit
\q
```

### **2. Configure Database Connection**

Create `/opt/tsfsystem/app/erp_backend/.env`:

```bash
# Database
DATABASE_URL=postgres://tsfsystem_prod:SECURE_PASSWORD@localhost:5432/tsfsystem_prod

# Django
SECRET_KEY=<generate-strong-secret-key>
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Redis
REDIS_URL=redis://localhost:6379/0

# Celery
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# Email
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.yourprovider.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=noreply@yourdomain.com
EMAIL_HOST_PASSWORD=<email-password>

# AWS (if using S3 for media)
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_STORAGE_BUCKET_NAME=tsfsystem-media
AWS_S3_REGION_NAME=us-east-1

# Logging
LOG_LEVEL=INFO
SENTRY_DSN=<your-sentry-dsn>

# Security
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

**Generate SECRET_KEY**:
```bash
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

### **3. Run Migrations**

```bash
cd /opt/tsfsystem/app/erp_backend
source /opt/tsfsystem/venv/bin/activate

# Check migrations
python manage.py showmigrations

# Run migrations
python manage.py migrate

# Verify tables created
python manage.py dbshell
\dt kernel_*
\dt apps_*
\q
```

### **4. Create Superuser**

```bash
python manage.py createsuperuser
# Username: admin
# Email: admin@yourdomain.com
# Password: <secure-password>
```

### **5. Load Initial Data**

```bash
# Load chart of accounts
python manage.py loaddata fixtures/chart_of_accounts.json

# Register event contracts
python manage.py register_contracts

# Create default roles
python manage.py create_default_roles
```

---

## 🚀 APPLICATION DEPLOYMENT

### **1. Collect Static Files**

```bash
cd /opt/tsfsystem/app/erp_backend
source /opt/tsfsystem/venv/bin/activate

# Collect static files
python manage.py collectstatic --no-input

# Verify
ls -la /opt/tsfsystem/static/
```

### **2. Configure Gunicorn**

Create `/opt/tsfsystem/app/gunicorn_config.py`:

```python
import multiprocessing

# Server socket
bind = "127.0.0.1:8000"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2

# Logging
errorlog = "/opt/tsfsystem/logs/gunicorn-error.log"
accesslog = "/opt/tsfsystem/logs/gunicorn-access.log"
loglevel = "info"

# Process naming
proc_name = "tsfsystem"

# Server mechanics
daemon = False
pidfile = "/opt/tsfsystem/gunicorn.pid"
user = "tsfsystem"
group = "tsfsystem"
```

### **3. Configure Supervisor**

Create `/etc/supervisor/conf.d/tsfsystem.conf`:

```ini
[program:tsfsystem-web]
command=/opt/tsfsystem/venv/bin/gunicorn erp_backend.wsgi:application -c /opt/tsfsystem/app/gunicorn_config.py
directory=/opt/tsfsystem/app/erp_backend
user=tsfsystem
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/opt/tsfsystem/logs/web.log

[program:tsfsystem-celery-worker]
command=/opt/tsfsystem/venv/bin/celery -A erp_backend worker -l info
directory=/opt/tsfsystem/app/erp_backend
user=tsfsystem
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/opt/tsfsystem/logs/celery-worker.log

[program:tsfsystem-celery-beat]
command=/opt/tsfsystem/venv/bin/celery -A erp_backend beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
directory=/opt/tsfsystem/app/erp_backend
user=tsfsystem
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/opt/tsfsystem/logs/celery-beat.log

[group:tsfsystem]
programs=tsfsystem-web,tsfsystem-celery-worker,tsfsystem-celery-beat
```

**Reload Supervisor**:
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status tsfsystem:*
```

### **4. Configure Nginx**

Create `/etc/nginx/sites-available/tsfsystem`:

```nginx
upstream tsfsystem_app {
    server 127.0.0.1:8000 fail_timeout=0;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates
    ssl_certificate /etc/ssl/certs/yourdomain.com.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.com.key;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    client_max_body_size 50M;

    # Static files
    location /static/ {
        alias /opt/tsfsystem/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        alias /opt/tsfsystem/media/;
        expires 7d;
    }

    # Application
    location / {
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $http_host;
        proxy_redirect off;
        proxy_pass http://tsfsystem_app;
    }

    # Health check
    location /health/ {
        access_log off;
        proxy_pass http://tsfsystem_app;
    }
}
```

**Enable Site**:
```bash
sudo ln -s /etc/nginx/sites-available/tsfsystem /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### **5. Setup SSL with Let's Encrypt**

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test renewal
sudo certbot renew --dry-run
```

---

## ✅ POST-DEPLOYMENT VERIFICATION

### **1. Health Checks**

```bash
# Check application is running
curl -I https://yourdomain.com/health/

# Expected: HTTP/2 200 OK

# Check API
curl https://yourdomain.com/api/v1/status/

# Check admin
curl -I https://yourdomain.com/admin/
```

### **2. Database Verification**

```bash
# Connect to database
python manage.py dbshell

# Check tenant count
SELECT COUNT(*) FROM kernel_tenancy_tenant;

# Check module status
SELECT * FROM kernel_modules_kernel_module;

# Check event contracts
SELECT COUNT(*) FROM kernel_contracts_contract;

\q
```

### **3. Event System Verification**

```bash
python manage.py shell
```

```python
from kernel.events import emit_event
from kernel.events.models import EventOutbox

# Emit test event
emit_event('test.deployment', {'timestamp': 'now'})

# Check outbox
events = EventOutbox.objects.filter(event_type='test.deployment')
print(f"Events: {events.count()}")  # Should be 1

# Process events
from kernel.events.processor import EventProcessor
processor = EventProcessor()
processor.process_pending_events()

# Verify processed
processed = EventOutbox.objects.filter(event_type='test.deployment', status='PROCESSED')
print(f"Processed: {processed.count()}")  # Should be 1
```

### **4. Performance Verification**

```bash
# Run performance tests
python manage.py test tests.performance

# Check response times
ab -n 1000 -c 10 https://yourdomain.com/api/v1/products/
```

### **5. Monitoring Verification**

```bash
# Check logs
tail -f /opt/tsfsystem/logs/web.log
tail -f /opt/tsfsystem/logs/celery-worker.log

# Check supervisor status
sudo supervisorctl status tsfsystem:*

# Check Nginx
sudo nginx -t
sudo systemctl status nginx
```

---

## 📊 MONITORING SETUP

### **1. Application Monitoring (Sentry)**

Add to `settings.py`:

```python
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

if not DEBUG:
    sentry_sdk.init(
        dsn=os.environ.get('SENTRY_DSN'),
        integrations=[DjangoIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,
        environment='production'
    )
```

### **2. Database Monitoring**

```sql
-- Create monitoring user
CREATE USER tsf_monitor WITH PASSWORD 'monitor_password';
GRANT pg_monitor TO tsf_monitor;

-- Monitor queries
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state != 'idle' AND now() - query_start > interval '5 seconds';

-- Monitor table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

### **3. Log Aggregation (ELK/CloudWatch)**

Configure structured logging in `settings.py`:

```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(name)s %(levelname)s %(message)s'
        }
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json'
        },
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/opt/tsfsystem/logs/app.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 10,
            'formatter': 'json'
        }
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': os.environ.get('LOG_LEVEL', 'INFO')
    }
}
```

### **4. Metrics Collection (Prometheus)**

Install and configure django-prometheus:

```bash
pip install django-prometheus
```

Add to `settings.py`:
```python
INSTALLED_APPS = [
    'django_prometheus',
    # ... other apps
]

MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',
    # ... other middleware
    'django_prometheus.middleware.PrometheusAfterMiddleware',
]
```

Add to `urls.py`:
```python
urlpatterns = [
    path('', include('django_prometheus.urls')),
    # ... other urls
]
```

### **5. Alerting**

Configure alerts in your monitoring system:

**Critical Alerts** (Page immediately):
- Application down (health check fails)
- Database connection errors
- Redis connection errors
- Disk space > 90%
- Memory usage > 90%
- Error rate > 5% of requests

**Warning Alerts** (Investigate within 1 hour):
- Response time > 500ms (P95)
- Event processing backlog > 1000
- Failed background jobs
- Disk space > 80%
- Memory usage > 80%

---

## 🔄 ROLLBACK PROCEDURES

### **Rollback Checklist**

1. **Identify Issue**: Determine what needs rollback
2. **Notify Team**: Alert team of rollback in progress
3. **Database Backup**: Ensure recent backup exists
4. **Execute Rollback**: Follow steps below
5. **Verify**: Test rolled-back version
6. **Communicate**: Update stakeholders

### **Code Rollback**

```bash
# Switch to application user
sudo su - tsfsystem
cd /opt/tsfsystem/app

# Find previous deployment tag
git tag -l

# Rollback to previous version
git checkout v1.2.3  # Replace with previous version

# Restart services
sudo supervisorctl restart tsfsystem:*
```

### **Database Rollback**

```bash
# Connect to database
python manage.py dbshell

# Show migrations
python manage.py showmigrations

# Rollback specific migration
python manage.py migrate app_name 0023_previous_migration

# Or restore from backup
pg_restore -d tsfsystem_prod -c /path/to/backup.dump
```

### **Full System Rollback**

```bash
# Stop services
sudo supervisorctl stop tsfsystem:*

# Restore code
cd /opt/tsfsystem/app
git checkout <previous-commit-hash>

# Restore database
psql tsfsystem_prod < /backups/tsfsystem_backup_TIMESTAMP.sql

# Restart services
sudo supervisorctl start tsfsystem:*

# Verify
curl https://yourdomain.com/health/
```

---

## 🔒 SECURITY HARDENING

### **1. Database Security**

```sql
-- Limit connections
ALTER SYSTEM SET max_connections = 100;

-- Enable SSL
ALTER SYSTEM SET ssl = on;

-- Restrict access (edit pg_hba.conf)
# TYPE  DATABASE        USER            ADDRESS                 METHOD
hostssl tsfsystem_prod  tsfsystem_prod  10.0.0.0/8              md5
```

### **2. Application Security**

Update `settings.py`:

```python
# Security settings
DEBUG = False
ALLOWED_HOSTS = ['yourdomain.com', 'www.yourdomain.com']

# HTTPS
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Content Security Policy
CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'", "'unsafe-inline'", "cdn.example.com")
CSP_STYLE_SRC = ("'self'", "'unsafe-inline'")
CSP_IMG_SRC = ("'self'", "data:", "https:")

# Other security headers
X_FRAME_OPTIONS = 'DENY'
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
```

### **3. Firewall Configuration**

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny direct access to app server
sudo ufw deny 8000/tcp

# Check status
sudo ufw status
```

### **4. Secrets Management**

Use AWS Secrets Manager, HashiCorp Vault, or similar:

```python
# Example: AWS Secrets Manager
import boto3
import json

def get_secret(secret_name):
    client = boto3.client('secretsmanager', region_name='us-east-1')
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])

# In settings.py
if not DEBUG:
    secrets = get_secret('tsfsystem/production')
    SECRET_KEY = secrets['django_secret_key']
    DATABASES['default']['PASSWORD'] = secrets['db_password']
```

### **5. Regular Security Updates**

```bash
# Create weekly cron job for security updates
sudo crontab -e

# Add:
0 2 * * 0 apt update && apt upgrade -y && supervisorctl restart tsfsystem:*
```

---

## 📋 DEPLOYMENT CHECKLIST

Use this checklist for every deployment:

- [ ] Code reviewed and approved
- [ ] All tests passing
- [ ] Architecture enforcement passes
- [ ] Database backup created
- [ ] Deployment window scheduled
- [ ] Team notified
- [ ] Deploy code to server
- [ ] Run migrations
- [ ] Collect static files
- [ ] Restart services
- [ ] Verify health checks
- [ ] Test critical user flows
- [ ] Monitor error rates
- [ ] Monitor performance metrics
- [ ] Update documentation
- [ ] Notify team of completion

---

## 📞 SUPPORT CONTACTS

- **DevOps Team**: devops@yourdomain.com
- **Database Admin**: dba@yourdomain.com
- **Security Team**: security@yourdomain.com
- **On-Call**: +1-XXX-XXX-XXXX

---

**Version**: 1.0.0
**Last Updated**: 2026-03-04
**Status**: ✅ Ready for Production Deployment
