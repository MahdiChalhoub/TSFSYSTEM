# Kernel — Module Hot-Reload (001) — PLACEHOLDER

> ⚠️ **This is a placeholder, not a full plan.** WORKMAP 🟢 LOW. Needs dedicated
> research session before implementation. See "Why deferred" below.

## Goal

Allow installing / disabling a module at runtime without restarting the Django
server. Currently, after `OrganizationModule` changes, admins must restart the
backend for URL routes, signal handlers, and AppConfig registrations to pick
up the change.

## Why deferred

Django's `INSTALLED_APPS` is fundamentally load-time. Mutating it requires
either:

1. **Re-importing and re-registering URLconf + signals + AppConfig.ready()** — 
   brittle, known to leak global state, affects every tenant on the worker.
2. **Re-exec pattern (gunicorn SIGHUP / worker recycling)** — not hot-reload,
   more like coordinated restart. Safer but the user still waits ~10 s for new
   workers.
3. **Shadow process pool per tenant** — isolation-correct but heavyweight.

The blast radius touches module install flow globally. Done badly, every
module toggle risks taking down the platform.

## Research questions (before writing a real plan)

1. What gunicorn / uwsgi config is production running? SIGHUP reload is free
   if already supported.
2. Is Django's `apps.get_app_config()` registry mutation viable in the hot
   path, or do signals break on re-register?
3. What URL routes are module-owned vs core-owned? URL dispatcher caches
   resolvers; they need to be invalidated.
4. Do any modules keep in-memory state at AppConfig.ready() that a naive
   reload would double-initialize?
5. How do celery workers behave? They have separate AppConfig state.

## Proposed approach (tentative)

- **Phase 1** — worker-level SIGHUP reload: when a module is installed/disabled,
  trigger a coordinated worker recycle. Document that module changes have ~10 s
  downtime per worker. Fast to ship, no code hot-reload magic.
- **Phase 2** (only if Phase 1 is inadequate) — explore hot-patching
  URLconf and selectively re-registering signals. Requires a tested
  incantation and careful celery coordination.

## Files that will eventually change (sketch)

- `erp_backend/kernel/modules/services.py` — install/disable emits reload
  signal.
- New: `erp_backend/kernel/modules/reload.py` — reload orchestration.
- `erp_backend/kernel/modules/signals.py` — new `module_install_completed`
  signal subscribed to by reload orchestrator.
- Frontend: show "restarting workers" banner during the 10 s window.

## Blast radius

- Affects every tenant on affected worker(s).
- Incorrectly implemented: permanent outage until manual restart.
- Correctly implemented: 10 s per-worker outage.

## Risk / rollback

**High.** Rollback requires reverting both the reload mechanism and any
install-flow changes that depend on it, then forcing a full restart.

## Estimated effort

- Research: 1 day.
- Phase 1 implementation + test: 2–3 days.
- Phase 2 (if pursued): 1+ week, requires parallel environment to validate.

## Blockers

- Need a staging environment mirroring production gunicorn / celery config
  before any implementation.
- Need buy-in on the 10 s downtime tradeoff in Phase 1.
