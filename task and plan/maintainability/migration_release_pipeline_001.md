# Migration Release Pipeline — Versioned Squash Baselines

**Status**: PROPOSED 2026-05-01
**Priority**: HIGH (blocks reliable deployments)
**Estimated effort**: ~3 days for the first cutover (v3.5.0 baseline) + 1 day to wire ongoing tooling.
**Risk**: MEDIUM — touches every Django migration file in the repo; needs DB-authority operator + replay rehearsal.

---

## Mission

Establish a release pipeline where **every minor version of TSFSYSTEM has a known-good migration baseline**. Upgrading from v3.5.0 → v3.6.0 should be a deterministic operation: read the version registry, apply exactly the migrations between those two tags, done. No accumulated drift, no broken references, no `--fake` archaeology.

---

## Why this exists (the problem)

The current dev DB cannot be replayed from zero. Multiple apps have migrations that reference fields/tables/indexes their predecessors never created:

- `erp.0028` drops legacy `Contract`/`ApprovalRule`/`CustomDomain` tables that no earlier migration creates
- `inventory.0004` had `AlterField` on `Product.legacy_id` before any `AddField` (now patched to `AddField`)
- Some later migration tries to drop index `sal_org_order_idx` that doesn't exist
- finance had a leaf-node split where two `0076_*.py` migrations claimed the same slot (now resolved by `0079_merge_branches.py`)
- 79 finance migrations, 66 inventory, 80 pos, 28 erp — all linear, never squashed

This is how every long-lived Django app dies. Each individual migration was correct against the running models at the time it was generated. But:

1. Models got renamed/removed → old migrations still reference them
2. Fields got added in a way that didn't update the dependency chain → `AlterField` before `AddField`
3. Indexes got dropped manually → `RemoveIndex` operations crash on fresh DBs
4. Two devs generate `0076_X.py` and `0076_Y.py` simultaneously → leaf-node split

**Result**: nobody knows what migrations to apply for a given version, fresh DBs can't bootstrap, and "let me just rerun migrate" is a coin flip.

---

## Design

### Three-layer architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: VERSIONS.md — single source of truth (repo root)      │
│  Maps every released version to a frozen migration baseline      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: Per-app squashed baselines                            │
│  apps/{app}/migrations/0001_squashed_v{X_Y_Z}.py                │
│  Encodes the schema state at release v{X.Y.Z}                   │
│  Uses `replaces = [...]` for backward compat with deployed DBs  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: Post-squash incremental migrations                    │
│  apps/{app}/migrations/0002+_*.py                               │
│  Numbered fresh after each squash; layered on the baseline       │
└─────────────────────────────────────────────────────────────────┘
```

### Versioning convention

- **Semantic versioning**: `v{MAJOR}.{MINOR}.{PATCH}` (e.g., `v3.5.0`)
- **Squash trigger**: every minor version (e.g., v3.5.0 → v3.6.0). Patch releases inherit the parent minor's baseline.
- **Squash file naming**: `0001_squashed_v{MAJOR}_{MINOR}_{PATCH}.py` (underscores for Python module names; the patch is always `0` since squashes happen at minor boundaries).

### Squash mechanics

Django's native `squashmigrations` produces a single migration that:
1. Encodes the schema state at the time it was generated
2. Includes `replaces = [list of migration names it covers]`
3. Acts as already-applied for any DB that has already applied any migration in the `replaces` list

**Critical**: data migrations (`RunPython`) cannot always be squashed away. The squash command keeps them as separate operations within the squashed file, OR you can keep them as standalone post-squash files (preferred for clarity).

### Version registry (`VERSIONS.md`)

A markdown file at the repo root. Each released version gets an entry:

```markdown
## v3.6.0 — 2026-06-15

**Migration baseline** (per app):

| App | Squashed at | Latest migration |
|---|---|---|
| erp | `0001_squashed_v3_6_0.py` | `0001_squashed_v3_6_0` |
| finance | `0001_squashed_v3_6_0.py` | `0003_add_e_invoicing` |
| inventory | `0001_squashed_v3_6_0.py` | `0001_squashed_v3_6_0` |
| ... | ... | ... |

**Data migrations** (must run, not in squash):
- `finance/0002_backfill_monetary_classification.py`

**Upgrade from v3.5.0**:
1. Apply `finance/0002_backfill_monetary_classification`
2. Apply `finance/0003_add_e_invoicing`
3. Squashes auto-detect as already-applied via `replaces`.

**Schema diff vs v3.5.0**: [link to migration diff]
```

This is the file an operator reads when planning an upgrade. No more guessing.

---

## Initial v3.5.0 squash runbook

This is a one-time operator job. Estimated 1-2 days for an operator with full DB authority.

### Phase 1: Pre-squash cleanup

Before squashing, the existing migration tree must replay cleanly from a fresh DB. Today it doesn't. The operator must:

1. **Drop & recreate dev DB** (already done this session).
2. **Walk the migration plan**, fixing each broken step:
   - Patch broken migration files where possible (e.g., `AlterField` → `AddField` if the prior `AddField` is missing). Already done for `inventory/0004`.
   - `--fake` migrations whose operations no longer match any reality (e.g., `erp/0028` dropping non-existent `Contract` tables). Document each fake in a comment in `VERSIONS.md`.
   - Remove migrations that reference deleted apps entirely.
3. **Run `manage.py migrate`** until exit 0. Repeat the patch/fake cycle until it does.
4. **Run `manage.py check`**. Must pass clean.
5. **Run `manage.py makemigrations --dry-run`**. Must report "No changes detected" — the migration tree must match the model state.

This is the prerequisite. Without it, the squash will encode broken state.

### Phase 2: Per-app squash

For each app in the codebase, run:

```bash
python3 manage.py squashmigrations <app> 0001 <latest>
```

This produces a temporary `00X_squashed.py` file. Rename it to `0001_squashed_v3_5_0.py` and edit:
- Add a docstring noting the version, date, and replaced migration count
- Verify the `replaces = [...]` list matches the migrations being subsumed
- Move data migrations (`RunPython` operations) into separate post-squash files OR keep inline if they're idempotent

**Apps to squash** (in dependency order):
1. `erp` (foundational — others depend on it)
2. `apps_core`, `iam`, `reference`
3. `compliance`, `data_migration`, `integrations`
4. `client_portal`, `crm`, `ecommerce`, `hr`, `inventory`, `pos`, `mcp`, `migration`, `migration_v2`, `storage`, `supplier_portal`
5. `workforce`, `workspace`
6. `finance` (depends on inventory + pos via Pattern D imports)
7. `packages`

### Phase 3: Validation

After all squashes are committed:

1. **Drop & recreate dev DB**.
2. **Run `manage.py migrate`** — must succeed cleanly from empty.
3. **Run `manage.py check`** — must be clean.
4. **Run `manage.py makemigrations --dry-run`** — must report "No changes detected".
5. **Run the test suite** — at least the tests that were passing before the squash.

If any step fails, fix and re-validate. Don't merge until all pass.

### Phase 4: Cutover

1. Tag git commit: `git tag v3.5.0`
2. Update `VERSIONS.md` with the v3.5.0 entry (table of squashed-at + latest migrations per app).
3. Remove the original migration files (the ones now subsumed by the squash). Optional — Django will continue to work with both present, but the directory is cleaner without them. Use `git rm` so the history is preserved.
4. Push tag + commit.

### Phase 5: Operator handoff

Document the resulting baseline in `VERSIONS.md` with explicit "if you have a DB at v3.4.x, run THIS to upgrade" instructions.

---

## Ongoing release process

After the v3.5.0 baseline lands, the per-release workflow becomes:

### Cutting a release (e.g., v3.5.0 → v3.6.0)

1. **Develop normally** — add new migrations as needed: `0002_*.py`, `0003_*.py`, etc., on top of the v3.5.0 squash.
2. **At release time**, the release engineer:
   - Runs `scripts/release/verify_clean_replay.sh` — drops a test DB, replays from zero, asserts clean exit.
   - If clean, runs `scripts/release/squash_for_release.py v3.6.0` — squashes every app's post-v3.5.0 migrations into a new `0001_squashed_v3_6_0.py`.
   - Runs `verify_clean_replay.sh` again on the squashed result.
   - If clean, deletes the v3.5.0 squash file (it's been subsumed) and the post-v3.5.0 files (now in the v3.6.0 squash).
   - Updates `VERSIONS.md` with the v3.6.0 entry.
   - Tags `git tag v3.6.0`.

### Hotfix release (e.g., v3.5.0 → v3.5.1)

Patch releases do NOT trigger a re-squash. Just add the hotfix migration on top of the existing baseline:
```
apps/finance/migrations/0001_squashed_v3_5_0.py
                       /0002_hotfix_xyz.py    ← new in v3.5.1
```

Update `VERSIONS.md` to note the v3.5.1 entry adds `0002_hotfix_xyz` on top of the v3.5.0 baseline.

### Cross-version upgrade

A DB at v3.3.0 upgrading to v3.6.0:
- Already has the v3.3 baseline + post-v3.3 migrations applied
- Django's `replaces = [...]` system auto-detects these as covered by v3.5.0 squash
- Apply v3.5.0 squash (recorded as already-applied), then post-v3.5 migrations, then v3.6.0 squash, then post-v3.6
- All transparent to the operator — they just `manage.py migrate`

---

## Tooling

### `scripts/release/verify_clean_replay.sh`

Drops a test DB, runs `migrate` from zero, asserts clean exit. Run before any release cut.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Ensure we're not pointing at the real DB
DB_NAME="tsfdb_replay_test"
PGPASSWORD=postgres dropdb -h localhost -U postgres "$DB_NAME" --if-exists
PGPASSWORD=postgres createdb -h localhost -U postgres "$DB_NAME"

# Override DB_NAME for this run
DB_NAME="$DB_NAME" python3 manage.py migrate --no-input
DB_NAME="$DB_NAME" python3 manage.py check
DB_NAME="$DB_NAME" python3 manage.py makemigrations --dry-run

# If we made it here, the tree replays cleanly
echo "✅ Clean replay verified."
PGPASSWORD=postgres dropdb -h localhost -U postgres "$DB_NAME"
```

### `scripts/release/squash_for_release.py`

Python script that:
1. Reads the target version from CLI: `python3 squash_for_release.py v3.6.0`
2. Reads `VERSIONS.md` to find the previous version's baseline per app.
3. For each app, computes the migration range (from `0001_squashed_v{prev}.py` to latest).
4. Runs `manage.py squashmigrations <app> <start> <end>` for each.
5. Renames the output to `0001_squashed_v{X_Y_Z}.py`.
6. Updates docstrings + `replaces` lists.
7. Validates by running `verify_clean_replay.sh`.
8. If valid: writes a draft `VERSIONS.md` entry for human review.

(Skeleton implementation provided as a follow-up; the operator runs this; agents do not.)

### `scripts/release/verify_versions_md.py`

Sanity check: every app listed in the latest `VERSIONS.md` entry must have a corresponding squash file with the matching name; any orphan migration files in the tree must be either post-squash incrementals or in `replaces` of the squash. Fails CI if there's drift.

---

## File layout

After v3.5.0 cutover:

```
.
├── VERSIONS.md                          ← release registry
├── erp_backend/
│   ├── erp/migrations/
│   │   └── 0001_squashed_v3_5_0.py     ← only file
│   ├── apps/
│   │   ├── finance/migrations/
│   │   │   ├── 0001_squashed_v3_5_0.py ← baseline
│   │   │   └── 0002_backfill_monetary_classification.py
│   │   ├── inventory/migrations/
│   │   │   └── 0001_squashed_v3_5_0.py
│   │   └── ... (one squash file per app)
│   └── scripts/release/
│       ├── verify_clean_replay.sh
│       ├── squash_for_release.py
│       └── verify_versions_md.py
└── task and plan/maintainability/
    ├── migration_release_pipeline_001.md  ← this doc
    └── migration_release_pipeline_001_runbook.md  ← step-by-step for ops
```

After v3.6.0 cutover (one minor later):

```
├── erp_backend/apps/finance/migrations/
│   ├── 0001_squashed_v3_6_0.py      ← new baseline (subsumes v3.5.0 + post-v3.5 work)
│   └── 0002_*.py                     ← new post-v3.6 migrations
```

The v3.5.0 squash file gets `git rm`'d (after enough time has passed for all deployed DBs to have applied it).

---

## Rollback / recovery

### If a squash is bad

1. Don't merge until `verify_clean_replay.sh` passes.
2. If a bad squash makes it to main: revert the squash commit, re-run `verify_clean_replay.sh`, fix the issue, re-squash.
3. Production DBs that already applied the bad squash: `manage.py migrate <app> <last-good-migration>` to roll back, then apply the corrected squash.

### If `replaces` is wrong on a squashed file

Symptom: deployed DB applies the squashed migration even though its predecessors are already applied (causing schema duplication errors).
Fix: edit the `replaces` list to include all genuinely-superseded migration names, push hotfix.

### If a data migration was lost in the squash

Symptom: fresh DB has correct schema but missing seeded data.
Fix: extract the data-migration logic from the squashed file and put it back as a separate `0002_*.py` post-squash file. Document in `VERSIONS.md` under "Data migrations".

---

## Risks & gotchas

### Hard problems

1. **Data migrations** (`RunPython`) — squashing one of these into a "schema-only" baseline drops the data step. The fix is to either keep them post-squash OR encode the result as default values in the squashed schema (rarely viable). For TSFSYSTEM specifically: `finance/0076_backfill_monetary_classification` is the most prominent — it walks every COA row applying heuristics. Keep it post-squash.

2. **Cross-app dependencies** — `finance` migrations depend on `inventory` + `pos` via Pattern D imports. The squash must respect this — squash `inventory` and `pos` before `finance`, then re-validate dependencies in the finance squash's `dependencies = [...]` list.

3. **Deployed DBs at unknown migration states** — if a customer has `finance.0067` applied and we squash 0001-0078 into v3.5.0 baseline, Django's `replaces` mechanism handles the transition silently. But if the customer somehow has `0080_post_v3_5_extra` applied (e.g., they hand-applied a hotfix), the squash will conflict. Mitigation: documented per-version "supported source versions for upgrade" matrix in `VERSIONS.md`.

4. **Test fixtures** — many test setUp methods create their fixtures via direct ORM calls that depend on specific migration state. After squash, validate that `pytest` still passes. Likely zero issues since the squashed schema is functionally identical to the pre-squash state.

### Easier issues

5. **CI/CD docker images** — production deployment images may pin to specific migration filenames in their `entrypoint.sh`. Audit before squashing.

6. **Migration history table size** — the `django_migrations` table grows by one row per migration applied. After squash, deployed DBs will have hundreds of rows for migrations that no longer exist as files. Cleanup is optional and low-priority; rows are tiny.

7. **Local dev DBs vs prod DBs** — devs running `manage.py migrate` against their local DB after the squash will see the squash auto-applied via `replaces`. Make sure to communicate this in the release notes.

---

## Why this is the right shape

**Squashing alone is not enough** — without a release-tagged baseline, devs squash whenever they remember to, and the squashes don't tie back to deployed versions. The result is the same drift, just hidden under a single big squash file.

**Version-tagged baselines alone are not enough** — without squashing, every minor release just adds more migrations on top. The drift accumulates inside the linear chain.

**Together** they form a deterministic system:
- The version registry (`VERSIONS.md`) tells you what migrations exist for each release.
- The squashed baseline guarantees those migrations replay cleanly from zero.
- Post-squash migrations are short, scoped to a single release window.
- Drift can't accumulate past one minor version.

This is how Sentry, Mozilla, and other long-lived Django shops manage this. Adopt the pattern once; benefit forever.

---

## Verification matrix

Before declaring this pipeline working:

| Check | Pass criteria |
|---|---|
| `manage.py migrate` from empty DB | Exit 0, all apps applied |
| `manage.py check` | 1 baseline warning, 0 errors |
| `manage.py makemigrations --dry-run` | "No changes detected" |
| `pytest` (full backend test suite) | Same pass/fail count as before squash |
| `verify_clean_replay.sh` | Exit 0 |
| `git log --oneline | head -1` | Tagged with `v3.5.0` |
| `VERSIONS.md` head entry | Matches the squash files in tree |
| Frontend `npx tsc --noEmit` | Exit 0 |

---

## Open questions for the operator

1. **What's the next release version?** This doc assumes v3.5.0. Confirm with the team's roadmap; the most recent commit message references v3.4.0.
2. **Which deployed DBs need to be considered?** If there's only dev + staging, the squash is straightforward. Production with paying customers requires more careful `replaces` curation.
3. **Should `--fake` decisions be documented in code or in `VERSIONS.md`?** This doc proposes `VERSIONS.md`; an alternative is a `MIGRATION_NOTES.md` per app.
4. **CI integration?** Should `verify_clean_replay.sh` run on every PR, or only at release cut? Recommended: every PR, to prevent new drift from landing.

---

## Next concrete actions

1. Review this plan with the team. Adjust the version (v3.5.0 vs v3.4.0 vs whatever).
2. Operator picks a window for the v3.5.0 cutover (estimate: 1-2 days uninterrupted).
3. Operator runs Phase 1 (pre-squash cleanup) — most of the work is here, and it's the part that's blocking dev DB replay today.
4. Operator runs Phase 2 (squash) and Phase 3 (validation).
5. Cutover, tag, push.
6. Adopt the ongoing release process for v3.6.0+.
