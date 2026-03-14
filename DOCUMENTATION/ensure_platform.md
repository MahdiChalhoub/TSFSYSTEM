# Ensure Platform — Bootstrap Command

## Goal
Guarantees the SaaS platform has its core requirements on every startup:
1. **SaaS Organization** (slug=`saas`) always exists
2. **Superadmin user** (`admin`) is always linked to it

## How It Works

### Management Command: `ensure_platform`
- **File**: `erp_backend/erp/management/commands/ensure_platform.py`
- Uses `get_or_create` — 100% idempotent, safe to run unlimited times
- Creates the SaaS org if missing, links admin if not linked

### Startup Script: `start_django.sh`
- **File**: `erp_backend/start_django.sh`
- Runs on every `systemctl restart tsf-backend`
- Sequence: `migrate` → `ensure_platform` → `gunicorn`

### Systemd Service
- **File**: `/etc/systemd/system/tsf-backend.service`
- `ExecStart` points to `start_django.sh` instead of raw Gunicorn

## Data Flow

| Step | What Happens | Data Written |
|------|-------------|-------------|
| 1. Migrate | Schema applied | `django_migrations` table |
| 2. ensure_platform | SaaS org created | `organization` table (slug=`saas`) |
| 2b. ensure_platform | Admin linked | `user` table (org_id → saas org) |
| 3. Gunicorn | Django starts | — |

## Variables
- `DJANGO_SUPERUSER_PASSWORD` env var (optional, default: `admin`)
- `--org-name` flag (optional, default: `Enterprise ERP`)
- `--admin-password` flag (optional)

## Manual Usage
```bash
source venv/bin/activate
python manage.py ensure_platform
python manage.py ensure_platform --admin-password=MySecret123
python manage.py ensure_platform --org-name="My Company"
```
