# Migration Reset & Hard Deploy Documentation

## Goal
Resolve deployment failures caused by corrupted migration files by doing a clean migration reset and hard deploy.

## What Changed

### Migrations Reset (v1.6.1-b001)
- **Deleted** all old migration files across 14 apps (erp, crm, finance, inventory, pos, hr, workspace, client_portal, supplier_portal, migration, mcp, packages, core, integrations)
- **Regenerated** fresh `0001_initial.py` migrations for all apps
- **Fixed** corrupted files: empty `inventory/0002_...` (0 bytes), minified single-line `pos/0002_...`

### Server Deployment
- Dropped all 97 tables (`DROP SCHEMA public CASCADE`)
- Applied fresh migrations
- Seeded core data and permissions
- Built frontend (140+ pages)
- Restarted services (pm2)

## Data Flow
- **Read from**: Git repository (GitHub `origin/main`)
- **Written to**: PostgreSQL `tsfdb` database on `127.0.0.1:5432`
- **Backup**: `/tmp/tsf_backup_hard_deploy.sql` (pre-drop backup)

## Variables
- `DB_NAME=tsfdb`, `DB_USER=postgres`, `DB_HOST=127.0.0.1`, `DB_PORT=5432`
- Server IP: `91.99.186.183`
- Services: `pm2 restart django`, `pm2 restart nextjs`

## Workflow
1. Fix corrupted migration files locally
2. Delete all old migration files
3. Run `python manage.py makemigrations` to regenerate
4. Verify: `makemigrations --check`, `manage.py check`, `npm run build`
5. Commit and push to GitHub
6. SSH to server → backup DB → git reset --hard → drop tables
7. Run migrate → seed → collectstatic → npm build → restart services
8. Health check: backend 200, frontend 200

## Post-Deploy Notes
- Database is fresh — users need to re-register
- DB backup available at `/tmp/tsf_backup_hard_deploy.sql` if data recovery needed
