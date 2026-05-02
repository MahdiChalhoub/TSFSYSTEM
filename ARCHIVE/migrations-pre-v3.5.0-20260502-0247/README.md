# Pre-v3.5.0 migrations archive

Snapshot of every Django migration that existed in the tree at 2026-05-02 02:47 UTC, immediately before the v3.5.0 release pipeline cutover (commit `9112d46a`) regenerated all migrations from current `models.py`.

## What this is

432 migration files across 21 apps — the complete pre-baseline tree that was replaced by 34 fresh `0001_initial.py` migrations during the v3.5.0 cutover.

| App | File count |
|---|---:|
| client_portal | 5 |
| compliance | 3 |
| core | 8 |
| crm | 28 |
| ecommerce | 3 |
| erp | 31 |
| finance | 85 |
| hr | 7 |
| iam | 4 |
| integrations | 7 |
| inventory | 70 |
| mcp | 5 |
| migration | 19 |
| migration_v2 | 8 |
| packages | 3 |
| pos | 90 |
| reference | 9 |
| storage | 8 |
| supplier_portal | 5 |
| workforce | 11 |
| workspace | 20 |
| **TOTAL** | **432** |

## Why it's archived (not deleted)

The v3.5.0 cutover was a clean break: all historical migrations were dropped and a single fresh tree was regenerated from the current model definitions. There's no `replaces = [...]` chain pointing at these files because they are explicitly NOT subsumed — they're discarded.

But:

1. **Audit trail.** Anyone investigating "what schema changes happened between v3.0 and v3.5" needs to read these. Git history alone is awkward because the files are deleted in the cutover commit.
2. **Drift forensics.** `MIGRATION_NOTES.md` documents 10 drift categories (A-J) with specific examples pointing at files in this archive. The references are broken if the archive is gone.
3. **Restore-from-backup recovery.** If a deployed DB needs to be restored to a pre-cutover state, replaying the original migrations is the canonical path. They have to live somewhere.

## How to use

These migrations are **NOT loaded by Django** — they're outside the `apps/*/migrations/` tree, so the Django migration loader doesn't see them. They sit here purely as static reference material.

If you ever need to:

- **Read a specific migration:** open the file under `<app>/<filename>.py` here.
- **Restore a DB to pre-v3.5 state:** restore from `/root/archives/tsfci_v3_4_pre_cutover_<TIMESTAMP>.dump` (created by `cutover_v3_5_0.sh` Phase 1) — that's the live data + migration record. This file archive is the schema-change history matching that DB state.
- **Inspect drift:** see `MIGRATION_NOTES.md` at the repo root for the drift catalog. Most entries reference filenames in this archive.

## Naming convention

Follows the project's existing `ARCHIVE/<feature>-<YYYYMMDD>-<HHMM>/` convention (matching `inventory-categories-20260422-0905/`, `maintenance-pre-restore-20260423-0000/`, etc.).

## Source

Originally archived live at `/tmp/migrations_archive_pre_v3_5_0/` during the 2026-05-02 cutover session. Copied into the repo so it persists across server reboots and is available on every deployed instance.

## Related files

- `VERSIONS.md` — release registry, v3.5.0 entry references this archive
- `MIGRATION_NOTES.md` — drift catalog (10 categories), uses files here as examples
- `task and plan/maintainability/migration_release_pipeline_001.md` — architecture
- `task and plan/maintainability/migration_release_pipeline_001_runbook.md` — operator runbook
- `RELEASING.md` — daily workflow cheatsheet
