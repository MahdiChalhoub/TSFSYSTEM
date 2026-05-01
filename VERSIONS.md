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

(No releases yet. The first release after this registry is established will be v3.5.0 — see the runbook for the cutover process.)
