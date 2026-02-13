# Migration Sync Documentation

## Goal
Keep Django migration files synchronized between local development and production server.

## Problem (v1.3.2-b013)
Production had stale/orphaned migration files not present in the Git codebase, causing:
- `finance/0003_alter_fiscalperiod_options_fiscalperiod_status.py` existed on server but not in Git
- Several module apps (`mcp`, `pos`, `packages`, `inventory`) had model changes without corresponding migration files

## Resolution
1. **Pulled `finance/0003`** from production via `scp` to sync it into the codebase
2. **Generated missing migrations** for `mcp/0002`, `pos/0002`, `packages/0002`, `inventory/0002`
3. **Fake-applied all** on both local and production (tables already existed)
4. **Pushed to GitHub** as `v1.3.2-b013`

## Data Flow
- **Read**: `django_migrations` table tracks which migrations are applied
- **Write**: `migrate --fake` records migrations as applied without executing SQL

## Variables
- `--fake` flag: records migration without running SQL (for already-existing tables)
- `--check` flag: returns exit code 1 if unapplied migrations exist
- `--plan` flag: shows what would be applied

## Prevention Workflow
1. Never run `makemigrations` directly on the production server
2. Always generate migrations locally, commit to Git, then deploy
3. Run `python manage.py showmigrations` after every deploy to verify sync
4. If a migration exists on server but not locally, `scp` it before pushing
