# 🔧 TSFSYSTEM TROUBLESHOOTING GUIDE

**Purpose**: Comprehensive troubleshooting guide for TSFSYSTEM ERP
**Version**: 1.0.0
**Date**: 2026-03-04

---

## 📋 TABLE OF CONTENTS

1. [Database Issues](#database-issues)
2. [Application Errors](#application-errors)
3. [Performance Problems](#performance-problems)
4. [Event System Issues](#event-system-issues)
5. [Tenant Isolation Issues](#tenant-isolation-issues)
6. [Authentication & RBAC Issues](#authentication--rbac-issues)
7. [Migration Issues](#migration-issues)
8. [Deployment Issues](#deployment-issues)
9. [Monitoring & Logging](#monitoring--logging)
10. [Common Error Messages](#common-error-messages)

---

## 🗄️ DATABASE ISSUES

### **Issue: "Connection refused" or "Can't connect to database"**

**Symptoms**:
```
django.db.utils.OperationalError: could not connect to server: Connection refused
```

**Diagnosis**:
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check if port is open
nc -zv localhost 5432

# Check connection from command line
psql -h localhost -U tsfsystem_prod -d tsfsystem_prod
```

**Solutions**:

1. **PostgreSQL not running**:
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

2. **Wrong credentials**:
```bash
# Check .env file
cat /opt/tsfsystem/app/erp_backend/.env | grep DATABASE_URL

# Verify user exists
sudo -u postgres psql -c "\du"
```

3. **Firewall blocking connection**:
```bash
sudo ufw allow 5432/tcp
```

4. **pg_hba.conf misconfiguration**:
```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf

# Add:
host    tsfsystem_prod  tsfsystem_prod  127.0.0.1/32    md5

sudo systemctl restart postgresql
```

---

### **Issue: "Too many connections"**

**Symptoms**:
```
FATAL: remaining connection slots are reserved for non-replication superuser connections
```

**Diagnosis**:
```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Check max connections
SHOW max_connections;

-- See who's connected
SELECT pid, usename, application_name, client_addr, state
FROM pg_stat_activity;
```

**Solutions**:

1. **Kill idle connections**:
```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND state_change < NOW() - INTERVAL '10 minutes';
```

2. **Increase max_connections**:
```bash
sudo nano /etc/postgresql/16/main/postgresql.conf

# Set:
max_connections = 200

sudo systemctl restart postgresql
```

3. **Use connection pooling (PgBouncer)**:
```bash
sudo apt install pgbouncer

# Configure /etc/pgbouncer/pgbouncer.ini
[databases]
tsfsystem_prod = host=127.0.0.1 port=5432 dbname=tsfsystem_prod

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20

# Update DATABASE_URL
DATABASE_URL=postgres://tsfsystem_prod:password@localhost:6432/tsfsystem_prod
```

---

### **Issue: Slow Queries**

**Symptoms**:
- API requests taking > 5 seconds
- Database CPU at 100%

**Diagnosis**:
```sql
-- Find slow queries
SELECT pid, now() - query_start as duration, query, state
FROM pg_stat_activity
WHERE state != 'idle'
AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;

-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
AND n_distinct > 100
ORDER BY abs(correlation) DESC;

-- Check table bloat
SELECT schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS external_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

**Solutions**:

1. **Add missing indexes**:
```sql
-- Common indexes for TSFSYSTEM
CREATE INDEX CONCURRENTLY idx_inventory_product_org ON apps_inventory_inventory(organization_id, product_id);
CREATE INDEX CONCURRENTLY idx_invoice_customer ON apps_finance_invoice(organization_id, customer_id);
CREATE INDEX CONCURRENTLY idx_order_created ON apps_pos_order(organization_id, created_at);
CREATE INDEX CONCURRENTLY idx_audit_log_tenant ON kernel_audit_audit_log(tenant_id, created_at);
```

2. **Optimize queries with EXPLAIN**:
```sql
EXPLAIN ANALYZE
SELECT * FROM apps_inventory_product
WHERE organization_id = 1
AND name ILIKE '%widget%';

-- If slow, add GIN index for full-text search
CREATE INDEX CONCURRENTLY idx_product_name_gin ON apps_inventory_product USING gin(name gin_trgm_ops);
```

3. **Vacuum and analyze**:
```bash
# Run as postgres user
sudo -u postgres psql tsfsystem_prod

VACUUM ANALYZE;

-- Or schedule with cron
0 2 * * * psql tsfsystem_prod -c "VACUUM ANALYZE;"
```

---

## 🐛 APPLICATION ERRORS

### **Issue: "Internal Server Error (500)"**

**Symptoms**:
- Users see "Internal Server Error"
- No details shown

**Diagnosis**:
```bash
# Check application logs
tail -f /opt/tsfsystem/logs/web.log

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check Django logs
python manage.py shell
>>> import logging
>>> logger = logging.getLogger('django')
>>> logger.error("Test error")

# Check Sentry (if configured)
# Visit your Sentry dashboard
```

**Solutions**:

1. **Enable DEBUG temporarily (dev only!)**:
```python
# In settings.py (NEVER in production!)
DEBUG = True
```

2. **Check for common issues**:
```bash
# Missing migrations
python manage.py showmigrations | grep "\[ \]"

# Static files not collected
python manage.py collectstatic --dry-run

# Environment variables missing
python manage.py check --deploy
```

3. **Check stack trace**:
```bash
# View full traceback
tail -n 100 /opt/tsfsystem/logs/web.log | grep -A 50 "Traceback"
```

---

### **Issue: "TemplateDoesNotExist"**

**Symptoms**:
```
django.template.exceptions.TemplateDoesNotExist: base.html
```

**Solutions**:

1. **Check TEMPLATES configuration**:
```python
# In settings.py
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        ...
    }
]
```

2. **Verify template exists**:
```bash
find /opt/tsfsystem/app -name "base.html"
```

3. **Check app is in INSTALLED_APPS**:
```python
INSTALLED_APPS = [
    'apps.inventory',
    'apps.finance',
    # etc...
]
```

---

### **Issue: "ModuleNotFoundError"**

**Symptoms**:
```
ModuleNotFoundError: No module named 'apps.inventory'
```

**Solutions**:

1. **Check virtual environment is activated**:
```bash
which python
# Should be: /opt/tsfsystem/venv/bin/python

source /opt/tsfsystem/venv/bin/activate
```

2. **Reinstall dependencies**:
```bash
pip install -r requirements.txt
```

3. **Check PYTHONPATH**:
```bash
export PYTHONPATH=/opt/tsfsystem/app/erp_backend:$PYTHONPATH
```

---

## ⚡ PERFORMANCE PROBLEMS

### **Issue: High Memory Usage**

**Symptoms**:
- Server running out of memory
- OOM killer terminating processes

**Diagnosis**:
```bash
# Check memory usage
free -h
top

# Check process memory
ps aux --sort=-%mem | head -n 10

# Check Gunicorn workers
sudo supervisorctl status tsfsystem:tsfsystem-web
ps aux | grep gunicorn
```

**Solutions**:

1. **Reduce Gunicorn workers**:
```python
# In gunicorn_config.py
workers = 4  # Instead of multiprocessing.cpu_count() * 2 + 1
```

2. **Add swap space**:
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

3. **Optimize queryset evaluation**:
```python
# Bad: Loads all objects into memory
products = Product.objects.all()
for product in products:
    print(product.name)

# Good: Uses iterator
products = Product.objects.all().iterator(chunk_size=100)
for product in products:
    print(product.name)
```

---

### **Issue: Slow API Response Times**

**Symptoms**:
- API endpoints taking > 1 second
- Timeout errors

**Diagnosis**:
```bash
# Profile an endpoint
curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com/api/v1/products/

# Create curl-format.txt:
time_namelookup:  %{time_namelookup}\n
time_connect:  %{time_connect}\n
time_appconnect:  %{time_appconnect}\n
time_pretransfer:  %{time_pretransfer}\n
time_redirect:  %{time_redirect}\n
time_starttransfer:  %{time_starttransfer}\n
----------\n
time_total:  %{time_total}\n
```

**Solutions**:

1. **Add database query caching**:
```python
from django.core.cache import cache

def get_products(organization_id):
    cache_key = f'products:{organization_id}'
    products = cache.get(cache_key)

    if products is None:
        products = list(Product.objects.filter(organization_id=organization_id))
        cache.set(cache_key, products, timeout=300)  # 5 minutes

    return products
```

2. **Use select_related and prefetch_related**:
```python
# Bad: N+1 query problem
orders = Order.objects.all()
for order in orders:
    print(order.customer.name)  # Queries database for each order!

# Good: One query with JOIN
orders = Order.objects.select_related('customer').all()
for order in orders:
    print(order.customer.name)
```

3. **Add Redis caching**:
```python
# In settings.py
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}
```

---

## 🎯 EVENT SYSTEM ISSUES

### **Issue: Events Not Processing**

**Symptoms**:
- Events stuck in PENDING state
- Cross-module communication not working

**Diagnosis**:
```bash
# Check event outbox
python manage.py shell
```

```python
from kernel.events.models import EventOutbox

# Count pending events
pending = EventOutbox.objects.filter(status='PENDING').count()
print(f"Pending events: {pending}")

# Show oldest pending
oldest = EventOutbox.objects.filter(status='PENDING').order_by('created_at').first()
if oldest:
    print(f"Oldest pending: {oldest.event_type} from {oldest.created_at}")

# Check for failed events
failed = EventOutbox.objects.filter(status='FAILED')
for event in failed[:10]:
    print(f"Failed: {event.event_type} - {event.error_message}")
```

**Solutions**:

1. **Process events manually**:
```python
from kernel.events.processor import EventProcessor

processor = EventProcessor()
result = processor.process_pending_events()
print(f"Processed: {result['processed']}, Failed: {result['failed']}")
```

2. **Check Celery worker is running**:
```bash
sudo supervisorctl status tsfsystem:tsfsystem-celery-worker

# If not running
sudo supervisorctl start tsfsystem:tsfsystem-celery-worker

# Check logs
tail -f /opt/tsfsystem/logs/celery-worker.log
```

3. **Clear stuck events**:
```python
from django.utils import timezone
from datetime import timedelta

# Mark old pending events as expired
cutoff = timezone.now() - timedelta(hours=24)
EventOutbox.objects.filter(
    status='PENDING',
    created_at__lt=cutoff
).update(status='EXPIRED')
```

---

### **Issue: Event Handler Not Found**

**Symptoms**:
```
ERROR: Event handler not found for module 'inventory'
```

**Diagnosis**:
```python
# Check if handler module exists
import importlib

try:
    module = importlib.import_module('apps.inventory.events')
    print(f"Module found: {module}")
    print(f"Has handle_event: {hasattr(module, 'handle_event')}")
except ImportError as e:
    print(f"Import error: {e}")
```

**Solutions**:

1. **Create events.py file**:
```python
# apps/inventory/events.py
import logging

logger = logging.getLogger(__name__)

def handle_event(event_name: str, payload: dict, organization_id: int):
    """Main event handler for inventory module"""
    logger.info(f"Received event: {event_name}")
    return {'success': True}
```

2. **Check Python path**:
```bash
python manage.py shell
>>> import sys
>>> print('\n'.join(sys.path))
```

---

## 🏢 TENANT ISOLATION ISSUES

### **Issue: Cross-Tenant Data Leakage**

**Symptoms**:
- User seeing data from other organizations
- Queries returning wrong results

**Diagnosis**:
```python
from kernel.tenancy.middleware import get_current_tenant
from apps.inventory.models import Product

# Check current tenant
tenant = get_current_tenant()
print(f"Current tenant: {tenant}")

# Check if model has tenant isolation
products = Product.objects.all()
print(f"Products count: {products.count()}")

# Check raw SQL
from django.db import connection
print(connection.queries[-1]['sql'])
```

**Solutions**:

1. **Ensure model inherits TenantOwnedModel**:
```python
from kernel.tenancy.models import TenantOwnedModel

class Product(TenantOwnedModel):
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=100, unique=True)
    # ...
```

2. **Check middleware is active**:
```python
# In settings.py
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'kernel.tenancy.middleware.TenantMiddleware',  # ← Must be here
    # ... other middleware
]
```

3. **Manually set tenant**:
```python
from kernel.tenancy.middleware import set_current_tenant
from erp.models import Organization

tenant = Organization.objects.get(id=1)
set_current_tenant(tenant)

# Now queries are isolated
products = Product.objects.all()  # Only this tenant's products
```

---

### **Issue: "No tenant set in context"**

**Symptoms**:
```
RuntimeError: No tenant set in context. Use set_current_tenant()
```

**Solutions**:

1. **For API requests**: Ensure TenantMiddleware is active
2. **For management commands**: Set tenant manually:
```python
from django.core.management.base import BaseCommand
from kernel.tenancy.middleware import set_current_tenant
from erp.models import Organization

class Command(BaseCommand):
    def handle(self, *args, **options):
        tenant = Organization.objects.get(id=1)
        set_current_tenant(tenant)

        # Now your code can access tenant-specific data
        products = Product.objects.all()
```

3. **For Celery tasks**: Pass tenant_id:
```python
@shared_task
def process_invoice(invoice_id, tenant_id):
    from kernel.tenancy.middleware import set_current_tenant
    from erp.models import Organization

    tenant = Organization.objects.get(id=tenant_id)
    set_current_tenant(tenant)

    # Process invoice
```

---

## 🔐 AUTHENTICATION & RBAC ISSUES

### **Issue: "Permission denied"**

**Symptoms**:
- User getting 403 Forbidden
- Cannot access certain endpoints

**Diagnosis**:
```python
from kernel.rbac.services import RBACService
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.get(username='testuser')
tenant = get_current_tenant()

# Check user's roles
roles = RBACService.get_user_roles(user, tenant)
print(f"User roles: {[r.name for r in roles]}")

# Check specific permission
has_perm = RBACService.has_permission(user, 'finance.create_invoice', tenant)
print(f"Has permission: {has_perm}")

# Check all user permissions
perms = RBACService.get_user_permissions(user, tenant)
print(f"Permissions: {[p.name for p in perms]}")
```

**Solutions**:

1. **Assign role to user**:
```python
from kernel.rbac.models import Role
from kernel.rbac.services import RBACService

role = Role.objects.get(organization=tenant, name='Accountant')
RBACService.assign_role(user, role, tenant)
```

2. **Add permission to role**:
```python
from kernel.rbac.models import Permission

perm = Permission.objects.get(name='finance.create_invoice')
role.permissions.add(perm)
```

3. **Create missing permission**:
```python
Permission.objects.create(
    name='finance.create_invoice',
    description='Can create invoices',
    module='finance'
)
```

---

### **Issue: Session Expired / Not Authenticated**

**Symptoms**:
- User logged out unexpectedly
- "Authentication credentials were not provided"

**Solutions**:

1. **Check session configuration**:
```python
# In settings.py
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_AGE = 1209600  # 2 weeks
SESSION_COOKIE_SECURE = True  # Only over HTTPS
SESSION_COOKIE_HTTPONLY = True
```

2. **Check Redis session backend** (if using):
```bash
redis-cli
> KEYS "django:session:*"
> TTL "django:session:abc123"
```

3. **Clear expired sessions**:
```bash
python manage.py clearsessions
```

---

## 🔄 MIGRATION ISSUES

### **Issue: "Migration conflicts"**

**Symptoms**:
```
CommandError: Conflicting migrations detected; multiple leaf nodes in the migration graph
```

**Solutions**:

1. **Merge migrations**:
```bash
python manage.py makemigrations --merge
```

2. **Reset migrations (dev only!)**:
```bash
# Delete migration files
find . -path "*/migrations/*.py" -not -name "__init__.py" -delete
find . -path "*/migrations/*.pyc" -delete

# Recreate
python manage.py makemigrations
python manage.py migrate
```

---

### **Issue: "Table already exists"**

**Symptoms**:
```
django.db.utils.ProgrammingError: relation "apps_inventory_product" already exists
```

**Solutions**:

1. **Fake the migration**:
```bash
python manage.py migrate inventory 0001_initial --fake
```

2. **Check what's applied**:
```bash
python manage.py showmigrations inventory
```

---

## 🚀 DEPLOYMENT ISSUES

### **Issue: Static files not loading**

**Symptoms**:
- CSS/JS files return 404
- Admin panel has no styling

**Solutions**:

1. **Collect static files**:
```bash
python manage.py collectstatic --clear --no-input
```

2. **Check Nginx configuration**:
```nginx
location /static/ {
    alias /opt/tsfsystem/static/;
    expires 30d;
}
```

3. **Check STATIC_ROOT**:
```python
# In settings.py
STATIC_URL = '/static/'
STATIC_ROOT = '/opt/tsfsystem/static'
```

---

### **Issue: Gunicorn won't start**

**Symptoms**:
```
[ERROR] Connection in use: ('127.0.0.1', 8000)
```

**Solutions**:

1. **Kill existing process**:
```bash
sudo lsof -ti:8000 | xargs kill -9
```

2. **Check supervisor**:
```bash
sudo supervisorctl status tsfsystem:*
sudo supervisorctl restart tsfsystem:tsfsystem-web
```

3. **Check logs**:
```bash
tail -f /opt/tsfsystem/logs/web.log
```

---

## 📊 MONITORING & LOGGING

### **Issue: No logs appearing**

**Solutions**:

1. **Check log file permissions**:
```bash
ls -la /opt/tsfsystem/logs/
sudo chown -R tsfsystem:tsfsystem /opt/tsfsystem/logs/
```

2. **Check logging configuration**:
```python
# In settings.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': '/opt/tsfsystem/logs/app.log',
        },
    },
    'root': {
        'handlers': ['file'],
        'level': 'INFO',
    },
}
```

3. **Test logging**:
```python
import logging
logger = logging.getLogger(__name__)
logger.info("Test log message")
```

---

## ⚠️ COMMON ERROR MESSAGES

### **Error: "CSRF verification failed"**

**Solutions**:
```python
# In settings.py
CSRF_TRUSTED_ORIGINS = ['https://yourdomain.com']

# Or for API endpoints
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ]
}
```

---

### **Error: "Celery beat service DOWN"**

**Solutions**:
```bash
# Check if database scheduler table exists
python manage.py migrate django_celery_beat

# Restart beat
sudo supervisorctl restart tsfsystem:tsfsystem-celery-beat
```

---

### **Error: "Redis connection error"**

**Solutions**:
```bash
# Check Redis is running
sudo systemctl status redis

# Test connection
redis-cli ping
# Should return: PONG

# Check Redis URL
echo $REDIS_URL
```

---

## 🆘 EMERGENCY PROCEDURES

### **Complete System Failure**

1. **Check all services**:
```bash
sudo supervisorctl status
sudo systemctl status nginx
sudo systemctl status postgresql
sudo systemctl status redis
```

2. **Restart everything**:
```bash
sudo supervisorctl restart all
sudo systemctl restart nginx
```

3. **Check disk space**:
```bash
df -h
# If disk full, clear logs:
sudo truncate -s 0 /opt/tsfsystem/logs/*.log
```

4. **Rollback** (if recent deployment):
```bash
cd /opt/tsfsystem/app
git checkout <previous-version>
sudo supervisorctl restart tsfsystem:*
```

---

## 📞 ESCALATION PATHS

1. **Level 1**: Check this guide
2. **Level 2**: Check application logs
3. **Level 3**: Contact DevOps team (devops@yourdomain.com)
4. **Level 4**: Page on-call engineer (+1-XXX-XXX-XXXX)
5. **Level 5**: Initiate incident response

---

**Version**: 1.0.0
**Last Updated**: 2026-03-04
**Status**: ✅ Production Ready
