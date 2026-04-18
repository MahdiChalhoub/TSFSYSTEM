# Kernel — Update Rollback (001)

_Rewritten 2026-04-18 from placeholder to concrete plan after code audit. Phase 0 (DB snapshot guard rail) can ship without staging. Phase 1 (user-facing rollback UI) needs a staging env._

## Goal

When a kernel update or module upgrade leaves the system broken, provide a safe path to restore the previous state — **both code and database** — without requiring a DBA's manual intervention.

## Current state (audited)

**Good news**: file-level backups already exist.

| Flow | File:line | What gets backed up |
|---|---|---|
| Kernel update | `erp/kernel_manager.py:115-126` | `erp/`, `lib/`, `apps_core/` → `BASE_DIR/backups/kernel_{version}_{timestamp}/` before deploy. |
| Kernel update rollback on error | `erp/kernel_manager.py:144-151` | Auto-restores the three dirs from backup if `apply_update` raises. |
| Module upgrade | `erp/module_manager.py:200-203` | Current module dir → timestamped backup before swap. Rollback exists at `erp/module_manager.py:456-503`. |

**Bad news**: no **database** snapshot exists anywhere, and no user-facing rollback UI.

| Gap | Impact |
|---|---|
| No DB snapshot before `apply_update` | Code rolls back, DB does not. Any DB-schema change slipped into a kernel update becomes un-rollbackable. |
| No DB snapshot before `upgrade()` — **which DOES run migrations** (`erp/module_manager.py:230`) | Module upgrades that include schema migrations can't be cleanly undone. `_restore_from_backup` (line 456) only touches the filesystem. |
| No UI for rollback | Operators must SSH, find the right `backups/` dir, and manually copy back. |
| No list of applied updates / rollback targets in the UI | SaaS admin page shows pending updates but not applied-with-rollback-available. |

DB is PostgreSQL per `core/settings.py` (`django.db.backends.postgresql`). `pg_dump` is the right snapshot tool.

## Design — Phase 0: pre-update DB snapshot (safe to ship now)

Strictly additive guard rail. Does not change any existing update behaviour — only creates a `.sql.gz` alongside the existing file backup.

### Backend changes
- NEW: `erp_backend/kernel/backup/db_snapshot.py`
  - `snapshot_database(label: str) -> Path` — runs `pg_dump` against the configured `DATABASES['default']` using env-vars, writes `BASE_DIR/backups/db_{label}_{timestamp}.sql.gz`, returns the path. Logs size + duration. Non-fatal on failure (returns `None`).
  - `restore_database(snapshot_path: Path) -> None` — for Phase 1 (not wired in Phase 0).
- EDIT: `erp/kernel_manager.py` — inside `apply_update` (just before the `transaction.atomic()` block at line 121), call `db_snapshot.snapshot_database(f'kernel_pre_{update.version}')`. Log the returned path to the `SystemUpdate.metadata['db_snapshot']` field so it's queryable later.
- EDIT: `erp/module_manager.py` — inside `upgrade()` (just before filesystem swap at line 200), call `db_snapshot.snapshot_database(f'module_{code}_pre_{version}')`. Store on the `SystemModule.metadata['db_snapshot']` field.
- Retention: a cron'd command `python manage.py prune_kernel_backups --keep 10` that removes all but the 10 newest `db_*.sql.gz` files (and the corresponding filesystem `kernel_*`/`module_*` backup dirs). Default: off; enable by setting `KERNEL_BACKUP_RETAIN_COUNT` in `kernel.config`.

### Configuration
- `KERNEL_DB_SNAPSHOT_ENABLED` in `kernel.config`, default `true`. Kill switch if `pg_dump` misbehaves.
- Snapshot location: `BASE_DIR/backups/` (same dir as existing file backups). Document storage growth expectations in `DEPLOY.md`.
- Snapshots contain tenant data — confirm they live inside the project's existing backup retention / secrets handling (not pushed to git; `.gitignore` already covers `backups/` implicitly via `*.bak` / tmp rules — **verify and extend if needed**).

### Risk
- **Low.** `pg_dump` is a read-only operation against a transactional DB; it cannot break the live system.
- Fails gracefully (non-fatal) if `pg_dump` isn't installed or credentials are wrong.

### Deliverables for Phase 0
- Working `snapshot_database` helper + kernel / module integration + retention command.
- Snapshot path written onto `SystemUpdate.metadata` and `SystemModule.metadata`.
- Unit test: mock `subprocess.run`, assert `pg_dump` invoked with correct args.
- Doc update in `DEPLOY.md` covering `pg_dump` prerequisite and retention config.

## Design — Phase 1: operator rollback UI (needs staging)

- SaaS admin page at `/saas/kernel/rollback` lists applied updates with rollback-available flags (have both file and DB snapshots).
- "Rollback" button triggers a `KernelManager.rollback_update(update_id)`:
  - Enters maintenance mode (middleware flag `KERNEL_MAINTENANCE_MODE=true`, all non-admin requests return 503).
  - Restores filesystem from the `backups/kernel_*/` dir.
  - Restores DB from `backups/db_kernel_pre_*.sql.gz` via `pg_restore`.
  - Marks the `SystemUpdate` row `is_applied=false`.
  - Exits maintenance mode.
  - SIGHUPs gunicorn workers (uses the same reload mechanism from the Hot-Reload plan).
- Module rollback counterpart triggered from the existing module list page.

### Risk
- **High.** A buggy restore destroys tenant data.
- **Prerequisite**: staging environment with realistic data volume; rehearsal drill of rollback on a seeded staging DB before enabling in production.

## Files that will change

### Phase 0 (safe, can ship now)
- NEW: `erp_backend/kernel/backup/__init__.py`
- NEW: `erp_backend/kernel/backup/db_snapshot.py`
- NEW: `erp_backend/kernel/management/commands/prune_kernel_backups.py`
- EDIT: `erp_backend/erp/kernel_manager.py` (+2 lines)
- EDIT: `erp_backend/erp/module_manager.py` (+2 lines)
- EDIT: `erp_backend/kernel/config/__init__.py` (add two defaults)
- EDIT: `DEPLOY.md` (prerequisite + retention)

### Phase 1 (needs staging)
- NEW: `erp_backend/erp/views_saas_rollback.py`
- NEW: `src/app/(privileged)/(saas)/kernel/rollback/page.tsx`
- NEW: `src/app/actions/saas/rollback.ts`
- EDIT: `erp_backend/erp/urls.py`
- EDIT: Sidebar link in Kernel section.

## Tests

### Phase 0
- Unit: `snapshot_database` happy path (mocked `pg_dump`), missing-binary path, credentials-from-env path.
- Unit: `prune_kernel_backups` with `--keep 3`, assert only 3 newest kept.
- Integration (dev stack OK): call `snapshot_database` against the dev Postgres, assert file created + non-empty.

### Phase 1 (staging only)
- Apply a kernel update with a DB migration on staging, trigger rollback, verify DB + code reverted, verify app functional after gunicorn SIGHUP.

## Risk / rollback

- Phase 0: low. Rollback = delete the `backup/db_snapshot.py` import call sites, set `KERNEL_DB_SNAPSHOT_ENABLED=false`.
- Phase 1: high. See above — needs staging.

## Blockers

- **Phase 0**: needs confirmation that `pg_dump` is available on the production deployment's Docker image. `Dockerfile.backend.prod` should include `postgresql-client`. Verify and patch if absent.
- **Phase 1**: staging environment with production-scale data + operator drill.

## Estimated effort

- Phase 0 (incl. tests + doc): **1 day**.
- Phase 1 (incl. staging validation): **3–5 days** in a dedicated session.
