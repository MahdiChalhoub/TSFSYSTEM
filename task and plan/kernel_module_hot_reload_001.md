# Kernel — Module Hot-Reload (001)

_Rewritten 2026-04-18 from placeholder to concrete plan after code audit. Still needs a staging environment before Phase 1 lands._

## Goal

After `ModuleManager.install_for_all(code)`, `upgrade()`, or `revoke_all(code)`, the running backend recognises the module change without a manual operator restart.

## Current state (audited)

| Area | File:line | Behaviour |
|---|---|---|
| `INSTALLED_APPS` | `core/settings.py:60-65` | Static at startup; filesystem-scanned once, never mutated at runtime. |
| URL registration | `core/urls.py:26` | Static `include('apps.core.urls')`; no `clear_url_caches()` anywhere. |
| Celery autodiscovery | `core/celery.py:19` | `app.autodiscover_tasks()` at startup only. |
| Module install | `erp/module_manager.py:339-363` (`install_for_all`) | Pure DB update on `OrganizationModule`; no file ops, no reload. |
| Module upgrade | `erp/module_manager.py:143-271` (`upgrade`) | Filesystem swap + `call_command('migrate', no_input=True)` at line 230. Failure non-fatal. |
| Connector replay | `erp/module_manager.py:326-334` (`grant_access`) | `connector_engine.replay_buffered()` flushes queued cross-module requests for newly-enabled modules. |
| Gunicorn | `gunicorn.conf.py:24-27, 42` | `preload=True`, `graceful_timeout=30s`. **SIGHUP reload supported.** |

**Summary**: the heavy infrastructure (gunicorn graceful reload, module connector replay) already exists. What's missing is a trigger that sends SIGHUP after module mutations.

## Design — Phase 1 (recommended, low risk)

Coordinated SIGHUP reload on module mutation. ~10 s per-worker downtime window. Transparent to tenants via gunicorn's graceful reload semantics (old workers finish in-flight requests before exit).

### Backend changes
- New file `erp_backend/kernel/modules/reload.py`:
  - `def signal_worker_reload(reason: str) -> None` — reads `GUNICORN_PID_FILE` env var (or `/run/gunicorn.pid` default), sends SIGHUP.
  - Safe no-op when running under `manage.py runserver` (detect via `sys.argv[0]`).
  - Logs the SIGHUP with reason via `kernel.observability`.
- `erp/module_manager.py` additions:
  - After `upgrade()` success path (line 248): call `signal_worker_reload(f"module upgrade {code} v{version}")`.
  - After `install_for_all()` success (line 363): call `signal_worker_reload(f"module install {code}")` **only if the module's manifest claims new URL routes or new Celery tasks** — DB-only installs don't need reload.
  - After `revoke_all()`: call with reason `f"module revoke {code}"`.
- Frontend: after `POST /saas/modules/*/install_global/` returns, show a "Workers restarting…" banner for 15 s (existing toast UX). Existing flows already refetch on completion.

### Celery coordination
Gunicorn SIGHUP doesn't restart Celery. Separately:
- New mgmt command `python manage.py reload_celery` that writes a timestamp file `var/celery_reload_at`.
- Celery workers subscribe to a file-watch signal (via existing observability or a plain `os.stat` poll every 30 s on the main thread) and gracefully exit when the timestamp advances.
- Operators configure their process supervisor (systemd, supervisord) to auto-restart exiting Celery workers — if the project doesn't already, document this as a deployment prerequisite.

### Configuration / environment
- `GUNICORN_PID_FILE` env var — document default and override.
- `KERNEL_HOT_RELOAD_ENABLED` feature flag in `kernel.config`, default `true`. Ops can disable if SIGHUP causes problems.

## Design — Phase 2 (stretch, NOT for first pass)

True in-process hot reload: `importlib.reload` + `clear_url_caches()` + re-run of subscribed-event registration. Much more fragile; celery workers still need their own signal. Defer until Phase 1 is proven insufficient.

## Files that will change

- NEW: `erp_backend/kernel/modules/reload.py`
- EDIT: `erp_backend/erp/module_manager.py` (3 call sites — `upgrade`, `install_for_all`, `revoke_all`)
- NEW: `erp_backend/kernel/management/commands/reload_celery.py`
- EDIT: `erp_backend/kernel/config/__init__.py` (add `KERNEL_HOT_RELOAD_ENABLED` default)
- EDIT: `DEPLOY.md` (document `GUNICORN_PID_FILE` + systemd/supervisord Celery auto-restart)
- EDIT: `src/app/(privileged)/(saas)/modules/page.tsx` — 15s "reloading" banner after install success.

## Tests

- Unit: `signal_worker_reload` — mock `os.kill`, assert SIGHUP sent when PID file exists, no-op when missing, no-op under `runserver`.
- Integration (staging only): install a module with new URL routes, POST to the new route within 10 s, within 30 s, within 60 s. Assert 404 → 200 transition within the graceful window.

## Risk / rollback

- Medium risk. SIGHUP loop (e.g., if worker re-registers a signal handler) could DoS the service.
- Mitigation: `KERNEL_HOT_RELOAD_ENABLED=false` kill switch.
- Rollback: revert the three `signal_worker_reload` call sites.

## Blockers (still)

1. **Staging environment** mirroring production gunicorn + Celery config. Do NOT test SIGHUP plumbing in production.
2. **Operator sign-off** on the 10 s worker-recycle window per module change.
3. **Celery process supervision** confirmation — without auto-restart, a `reload_celery` call becomes a full Celery outage.

## Estimated effort

- Phase 1 implementation + unit tests: **2 days**.
- Staging validation + ops doc: **1 day**.
- Phase 2 (if pursued): **1+ week**, separate plan.
