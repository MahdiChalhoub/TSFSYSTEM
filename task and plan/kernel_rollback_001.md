# Kernel — Kernel Update Rollback (001) — PLACEHOLDER

> ⚠️ **This is a placeholder, not a full plan.** WORKMAP 🟢 LOW. Needs dedicated
> research session before implementation. See "Why deferred" below.

## Goal

When a kernel update is applied (via `views_packages.py` / kernel update
flow) and something goes wrong, provide a rollback path that restores the
previous kernel state including any schema changes.

## Why deferred

Rollback of code is trivial (git revert, redeploy). Rollback of a kernel
update that includes **Django migrations** is not. Forward migrations can
include:

- Column drops (data lost; rollback requires backup restore).
- Data backfills (rollback requires inverse logic or snapshot).
- Irreversible transformations (enum consolidation, encoding changes).

Django's `migrate <app> <previous_migration>` only works for migrations that
define a clean `backward` path. Most real-world migrations don't.

A partial solution (rollback code only, not data) risks putting the code
in a state that doesn't match the schema — often worse than forward failure.

## Research questions (before writing a real plan)

1. What does the current kernel update flow look like end-to-end?
   ([`views_packages.py`](../erp_backend/erp/views_packages.py) is the
   starting point.)
2. Does kernel update include DB migrations today, or only code?
3. Is there a DB snapshot / backup step before applying a kernel update?
   (If yes, rollback = restore snapshot. If no, we need to add one first.)
4. How are tenant-specific configs affected by kernel updates?
5. What's the SLA for rollback? If acceptable window is hours not minutes,
   a backup-restore flow works. If must be seconds, need an online
   rollback mechanism.

## Proposed approach (tentative)

- **Phase 0** — guard rail: before every kernel update, automatic DB
  snapshot (pg_dump for PostgreSQL). Tag snapshot with pre-update kernel
  version. Even without rollback tooling, this unblocks manual recovery.
- **Phase 1** — UI to "revert to snapshot N" that:
  - Puts the system in maintenance mode.
  - Restores the snapshot.
  - Rolls code back to the kernel version tagged on the snapshot.
  - Exits maintenance mode.
- **Phase 2** (stretch) — forward-only rollback via compensating migrations
  generated per-update. Large undertaking, only if Phase 1 proves
  insufficient.

## Files that will eventually change (sketch)

- `erp_backend/erp/views_packages.py` — snapshot before apply, register
  rollback target.
- New: `erp_backend/kernel/updates/rollback.py` — rollback orchestration.
- New: `erp_backend/kernel/updates/snapshots.py` — snapshot storage.
- Frontend: rollback UI under kernel management page.

## Blast radius

- Affects every tenant during rollback window.
- Data-loss risk if snapshot strategy is wrong.
- Correctly implemented: full restore to last-known-good state with
  bounded downtime (snapshot restore time — minutes for small DBs,
  hours for large).

## Risk / rollback

**High.** Bugs in rollback tooling destroy tenant data. Must be tested
against a production-scale snapshot before shipping.

## Estimated effort

- Research + snapshot groundwork (Phase 0): 2 days.
- Rollback UI + orchestration (Phase 1): 3–5 days.
- Phase 2: 1+ week.

## Blockers

- Need staging environment with production-scale data volume.
- Need decision on snapshot storage (local disk, S3, tenant-specific).
- Need agreement on rollback SLA (seconds vs. minutes vs. hours).
