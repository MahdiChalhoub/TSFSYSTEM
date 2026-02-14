# Backend Restoration and Migration Fixes

## Goal
Resolve the persistent Backend 500 error and restore the Django system integrity after a series of corrupted migrations and missing dependencies.

## Data Movement
### Read
- `erp_backend/core/settings.py` for database configuration.
- `django_migrations` table for current migration state.
- PM2 and Gunicorn logs for error diagnostics.
- Git repository index for file tracking.

### Write
- Restored migration files in `erp_backend/erp/migrations/` and `erp_backend/apps/finance/migrations/`.
- Updated `erp_backend/core/settings.py` with correct `AUTH_USER_MODEL` and environment-based DB settings.
- Generated PWA icons in `public/icons/`.

## Variables
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`: Environment variables for database connectivity.
- `AUTH_USER_MODEL`: Set to `erp.User` to resolve model conflicts.

## Workflow
1. **Diagnosis**: Identified that `AUTH_USER_MODEL` was missing and database credentials in `settings.py` were hardcoded incorrectly for the Docker environment.
2. **Infrastructure Fix**: Updated `settings.py` to use environment variables and correctly register the custom `User` model.
3. **Migration Restoration**: Discovered that a previous commit had deleted multiple migration files. Restored them from the Git history.
4. **Index Repair**: Identified severe corruption in the Git repository index where filenames were concatenated with shell fragments. Purged the index and performed a clean restoration of migration files.
5. **Deployment**: Synchronized the local and remote repositories using `pull`, `merge`, and `push`. Performed a `git reset --hard` on the production server to apply the clean state.
6. **Service Management**: Resolved port binding conflicts (Errno 98) by cleaning up redundant Gunicorn processes and restarting the `tsf-backend` systemd service.
7. **Verification**: Confirmed the `api/auth/config/` endpoint returns 200 OK and manifest icons are accessible.

## How the goal is achieved
The system is now restored to a consistent state by decoupling hardcoded credentials from the kernel, repairing the broken migration chain, and ensuring the production environment exactly matches the verified repository state.
