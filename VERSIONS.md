# TSFSYSTEM Release Registry

This file maps every released version to its migration baseline. To upgrade a deployed DB, find the source version and target version, then apply the listed migrations.

**See also:**
- `task and plan/maintainability/migration_release_pipeline_001.md` — the architecture / why
- `task and plan/maintainability/migration_release_pipeline_001_runbook.md` — operator runbook for the first cutover
- `MIGRATION_NOTES.md` — per-cutover drift notes (created during Phase 1)
- `erp_backend/scripts/release/` — supporting tooling

---

## How to read this registry

Each release entry below has:

1. **A migration baseline table** — for each Django app, what's the squashed-baseline filename and what's the latest migration as of that release.
2. **A list of data migrations** — `RunPython` operations that exist as separate post-squash files. These must be run after the squash applies.
3. **Upgrade instructions** — for an operator coming from any earlier version.
4. **A schema-diff link or summary** — what changed vs the prior release.

When upgrading a deployed DB:

1. Look up your current version in the registry.
2. Look up the target version.
3. Apply migrations between them. Django's `replaces = [...]` mechanism handles the squash transitions automatically — you just `manage.py migrate`.

---

## Versioning convention

- **Semantic versioning**: `vMAJOR.MINOR.PATCH`
- **Squash trigger**: every minor release squashes everything older into a new `0001_squashed_v{MAJOR}_{MINOR}_0.py` per app.
- **Patch releases** add migrations on top of their parent minor's baseline (no re-squash).
- **Major releases** are squash points like minors.

---

## Pre-baseline (no formal release)

Everything before v3.5.0 is unbaselined territory. The migration tree from project inception through 2026-05-01 has accumulated drift (broken `RemoveField` ops, stale index drops, leaf-node splits). It cannot be replayed cleanly from zero. See `task and plan/maintainability/migration_release_pipeline_001.md` for the cleanup strategy.

**Operators with deployed DBs from this period**:
- Best path: take a backup, check the v3.5.0 cutover document, follow Phase 1 cleanup against your DB, then apply the v3.5.0 squash.
- Alternative: full DB replay from a fresh seed once the v3.5.0 baseline lands.

---

## Releases

<!--
TEMPLATE — copy below for each new release.

## vX.Y.Z — YYYY-MM-DD

**Summary**: <one-line description of what this release ships>

### Migration baseline (per app)

| App | Squash file | Latest migration |
|---|---|---|
| apps_core | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| client_portal | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| compliance | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| crm | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| data_migration | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| ecommerce | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| erp | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| finance | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| hr | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| iam | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| integrations | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| inventory | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| mcp | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| migration | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| migration_v2 | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| packages | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| pos | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| reference | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| storage | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| supplier_portal | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| workforce | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |
| workspace | `0001_squashed_vX_Y_0` | `0001_squashed_vX_Y_0` |

### Data migrations (must run, not in squash)

- (list any RunPython files here, e.g. `finance/0002_backfill_monetary_classification.py`)

### Pre-squash drift cleanup

See `MIGRATION_NOTES.md` for `--fake` / patched / removed migrations during this cutover.

### Upgrade from v(X-1).Y.0

1. (apply post-baseline migrations from prior version)
2. Apply `vX.Y.0` squash (auto-detected via `replaces`).

### Schema diff vs prior

- Added: <fields/models added>
- Removed: <fields/models removed>
- Renamed: <renames>
-->

---

## v3.5.0 — 2026-05-02

**Summary**: First baselined release. All historical migrations from project inception through 2026-05-02 are subsumed; the entire pre-v3.5 migration history (432 files across 21 apps) was archived to `/tmp/migrations_archive_pre_v3_5_0/` and the tree was regenerated fresh from current `models.py` definitions via `manage.py makemigrations`. This is the cleanest possible baseline for a dev-only environment.

### Migration baseline (per app)

| App | Migrations | Latest |
|---|---:|---|
| client_portal | 4 | `0004_initial` |
| compliance | 3 | `0003_initial` |
| core (apps_core) | 2 | `0002_initial` |
| crm | 3 | `0003_initial` |
| ecommerce | 1 | `0001_initial` |
| erp | 2 | `0002_initial` |
| finance | 2 | `0002_initial` |
| hr | 2 | `0002_initial` |
| iam | 1 | `0001_initial` |
| integrations | 1 | `0001_initial` |
| inventory | 2 | `0002_initial` |
| mcp | 1 | `0001_initial` |
| migration (data_migration) | 2 | `0002_initial` |
| migration_v2 | 1 | `0001_initial` |
| packages | 1 | `0001_initial` |
| pos | 1 | `0001_initial` |
| reference | 1 | `0001_initial` |
| storage | 1 | `0001_initial` |
| supplier_portal | 1 | `0001_initial` |
| workforce | 1 | `0001_initial` |
| workspace | 1 | `0001_initial` |
| **TOTAL** | **34** | — |

(Apps with `_initial` + `_initial` are Django's standard cross-app circular-FK split; those two migrations together form the linear baseline.)

### Data migrations (must run, not in squash)

- None for v3.5.0 — the pre-baseline `RunPython` data migrations (e.g., `finance.0076_backfill_monetary_classification`) were dropped along with the rest of pre-v3.5 history. The schema is built fresh from models; no historical data backfill is needed for fresh DBs. Tenants upgrading from earlier versions need to apply the historical migrations manually OR restore from a backup that already has the data.

### Pre-baseline drift cleanup

The original migration tree had accumulated multi-year drift across 10 categories (A-J — see `MIGRATION_NOTES.md`). All of it is now archived in `/tmp/migrations_archive_pre_v3_5_0/` (also preserved in git history at the commit just before this release tag). The regenerated baseline has zero drift by construction.

Specifically:
- The `client_portal` Category J tangle (TWO parallel `_initial` branches, 5 duplicate prefixes) is gone — the new baseline is 4 clean migrations.
- The `crm` 0020/0021 duplicate-prefix Category J is gone — 3 clean migrations.
- The `pos` 7 duplicate-prefix buckets and 5 `RenameIndex` patches are gone — 1 clean migration.
- The `finance` 0076 leaf-node split (resolved earlier with `0079_merge_branches.py`) is gone — 2 clean migrations.
- The `inventory/0004` legacy_id Cat A patch, `pos/0043`+`0065` Cat C patches, `erp/0010`+`0025` Cat F/G patches, and 99 Cat F bulk-patches across 14 files are all subsumed.
- The `erp/0028` Category H (cascade-drop walks live registry) and `apps_core/0004` Category I (cross-app ownership transfer) are gone — those models are now created cleanly under their final owners.

### Upgrading from pre-v3.5.0

This is a **clean break**. There is no `replaces = [...]` mechanism for the new migrations because they were generated fresh, not squashed. Deployed DBs from earlier versions need to:

1. Take a backup.
2. Apply pending pre-v3.5 migrations as far as possible (using the archive at `/tmp/migrations_archive_pre_v3_5_0/` if needed).
3. Drop the DB and recreate from the v3.5.0 baseline (recommended for dev only).
4. Restore data from backup.

For dev-only environments (this repo's primary use case), this is acceptable — the dev DB was disposable. For prod environments, this kind of break needs operator-led data-migration work.

### Schema diff vs prior

Effectively a from-scratch generation, so "everything" in the schema is "new" relative to the pre-baseline tree. But the actual schema is identical to what the pre-baseline tree would have produced if applied successfully — because both come from the same `models.py`.

### Verification

- `manage.py migrate` from empty DB: ✅ exit 0, all apps applied
- `manage.py check`: ✅ 1 baseline warning (User.username), 0 errors
- `manage.py makemigrations --dry-run`: ✅ "No changes detected"
- `bash scripts/release/verify_clean_replay.sh`: ✅ "Clean replay verified. The migration tree replays cleanly from zero. Safe to release."
- 34 total migrations in the new tree (down from 432 in the archive)

---

(No releases before this entry. The pre-v3.5 history was non-baseline and is documented in `MIGRATION_NOTES.md`.)
