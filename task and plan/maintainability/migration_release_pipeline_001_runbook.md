# Migration Release Pipeline — v3.5.0 First-Cutover Runbook

**Audience**: operator with full DB authority (can drop/recreate, run migrations, edit migration files, push commits, tag git).
**Prereq reading**: `migration_release_pipeline_001.md` (the architecture doc).
**Estimated time**: 1-2 days end-to-end. Phase 1 dominates (4-8 hours).
**Critical constraint**: do NOT do this against production. Use a copy of dev or a scratch DB.

---

## What you're doing

You're doing the one-time Phase 1 + 2 + 3 + 4 cutover described in the architecture doc, producing the v3.5.0 squashed baseline. After this, ongoing releases use the much shorter "ongoing release process" workflow.

---

## Phase 0: Prep (~30 min)

### 0.1 Ensure clean working state

```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM
git status                      # should be clean
git checkout -b release/v3.5.0  # work on a branch, not main
```

### 0.2 Snapshot the current state

```bash
# Backup current dev DB (if you have anything in it worth keeping)
PGPASSWORD=postgres pg_dump -h localhost -U postgres tsfdb \
    -F c -f /tmp/tsfdb_pre_squash_$(date +%Y%m%d).dump

# Snapshot the migration tree (so you can compare diff after)
find erp_backend -path '*/migrations/*.py' \
    | xargs ls -la \
    > /tmp/migration_tree_before.txt
```

### 0.3 Confirm test suite baseline

Note how many tests currently pass and fail. You'll re-run after the squash to confirm zero new regressions.

```bash
cd erp_backend
python3 manage.py test 2>&1 | tail -20  # record the pass/fail count
```

---

## Phase 1: Pre-squash cleanup (4-8 hours, the slog)

The migration tree must replay cleanly from a fresh DB before you can squash. Today it doesn't.

### 1.1 Drop & recreate the test DB

```bash
PGPASSWORD=postgres dropdb -h localhost -U postgres tsfdb --if-exists
PGPASSWORD=postgres createdb -h localhost -U postgres tsfdb
```

### 1.2 Walk the migration plan, fixing each break

```bash
cd erp_backend
python3 manage.py migrate 2>&1 | tee /tmp/migrate_attempt.log
```

When it crashes, look at the last `Applying X.Y...` line in the output. That's the migration that crashed. Then:

**Decision tree per crash:**

A. **The migration tries to `RemoveField` / `RemoveModel` something that doesn't exist** (like `erp.0028` removing `Contract` tables):
   - The thing being removed was deleted in source code at some point AND not committed via a proper migration.
   - **Fix**: the safest path is to `--fake` this migration since its operations are no-ops against the current schema.
   ```bash
   python3 manage.py migrate erp 0028 --fake
   ```
   - Document what you faked in `MIGRATION_NOTES.md` (created in step 1.4).

B. **The migration `AlterField` / `RemoveField` something that doesn't exist yet in state**:
   - Earlier migrations forgot to add it. Either patch this migration to `AddField` (if the field truly didn't exist) or trace back to find the missing prior migration.
   - **Example fixed earlier**: `inventory/0004` AlterField → AddField for `Product.legacy_id` and `Warehouse.legacy_id`.

C. **The migration drops an index that doesn't exist** (`relation "X_idx" does not exist`):
   - The index was either renamed or never created. Wrap the offending operation in `IF EXISTS` via raw SQL, OR remove the operation if the index isn't needed in the current schema.
   ```python
   # Replace:
   migrations.RemoveIndex(model_name='X', name='bad_idx'),
   # With:
   migrations.RunSQL('DROP INDEX IF EXISTS bad_idx;', reverse_sql=migrations.RunSQL.noop),
   ```

D. **The migration imports a model that no longer exists**:
   - The app or model was deleted. Either remove the migration entirely (if no later migrations depend on it) or patch the import.

### 1.3 Repeat until `manage.py migrate` exits 0

Each round:
1. Read the crash, classify per the decision tree above.
2. Apply the smallest possible fix.
3. Drop & recreate the DB (so you're always testing from clean state).
4. Run migrate again.

**Expected cadence**: 5-15 fixes total. The cumulative damage from years of drift is bad but finite. Most fixes are 1-line edits.

### 1.4 Create `MIGRATION_NOTES.md`

As you go, log every `--fake` decision and every patched migration:

```markdown
# Migration Notes — v3.5.0 Pre-Squash Cleanup (2026-MM-DD)

## Faked migrations (no-op against current schema)
- `erp/0028_remove_approvalrule_organization_and_more` — drops Contract/ApprovalRule/CustomDomain tables that were never created. Models removed from source. Faked safely.
- ...

## Patched migrations
- `inventory/0004_alter_category_barcode_sequence_and_more` — AlterField → AddField for `Product.legacy_id` and `Warehouse.legacy_id`. Original migration was generated against a state where those fields existed but no prior migration created them.
- ...

## Removed migrations
- (none, hopefully)
```

This file feeds the v3.5.0 entry in `VERSIONS.md` later.

### 1.5 Final clean-replay check

```bash
PGPASSWORD=postgres dropdb -h localhost -U postgres tsfdb --if-exists
PGPASSWORD=postgres createdb -h localhost -U postgres tsfdb
python3 manage.py migrate                           # MUST exit 0
python3 manage.py check                             # MUST be clean (1 baseline warning OK)
python3 manage.py makemigrations --dry-run          # MUST report "No changes detected"
```

If any of those fail, go back to 1.2. **Do not proceed to Phase 2 until all three pass on a fresh DB.**

---

## Phase 2: Per-app squash (~2-3 hours)

### 2.1 Squash apps in dependency order

Run these in order. After each, verify the app's squash file looks sane.

```bash
APPS_FOUNDATIONAL="erp apps_core iam reference"
APPS_LAYER1="compliance data_migration integrations"
APPS_LAYER2="client_portal crm ecommerce hr inventory pos mcp migration migration_v2 storage supplier_portal"
APPS_LAYER3="workforce workspace"
APPS_FINAL="finance packages"

for app in $APPS_FOUNDATIONAL $APPS_LAYER1 $APPS_LAYER2 $APPS_LAYER3 $APPS_FINAL; do
    echo "=== Squashing $app ==="
    python3 manage.py squashmigrations "$app" 0001 \
        --no-optimize \
        --no-input
done
```

### 2.2 Rename + finalize each squash file

For each app, the squash command produces a file like `0078_squashed_0078_payment_gateway_catalog.py`. Rename to the version convention:

```bash
for app_dir in apps/*/migrations apps_core/migrations erp/migrations; do
    squashed_file=$(ls "$app_dir"/*_squashed_*.py 2>/dev/null | head -1)
    if [ -n "$squashed_file" ]; then
        new_name="$app_dir/0001_squashed_v3_5_0.py"
        git mv "$squashed_file" "$new_name"
        echo "Renamed $squashed_file → $new_name"
    fi
done
```

Then for each `0001_squashed_v3_5_0.py`:
- Replace the auto-generated docstring with:
  ```python
  """v3.5.0 baseline migration — replaces all migrations from 0001 through the v3.5.0 release tag.

  This squash was generated 2026-MM-DD as part of the v3.5.0 release pipeline cutover.
  See `task and plan/maintainability/migration_release_pipeline_001.md` for the full architecture.

  Replaces: see `replaces = [...]` below for the full list.
  """
  ```
- Verify `replaces = [...]` includes all the now-subsumed migration names.
- If any data migrations (`RunPython` operations) need to be preserved post-squash (e.g., `finance.0076_backfill_monetary_classification`), extract them into separate files numbered `0002_*.py`.

### 2.3 Delete old migration files (optional but recommended)

```bash
# After all squashes are committed and validated:
for app_dir in apps/*/migrations apps_core/migrations erp/migrations; do
    # Keep only 0001_squashed_v3_5_0.py and any post-squash 0002+ files
    cd "$app_dir"
    for f in $(ls *.py 2>/dev/null | grep -vE '^(__init__|0001_squashed_v3_5_0|000[2-9]_|001[0-9]_)'); do
        if [ -f "$f" ]; then
            git rm "$f"
        fi
    done
    cd - >/dev/null
done
```

**Caveat**: only delete after confirming all deployed DBs (dev, staging, prod) have applied at least one of the migrations being subsumed. Django's `replaces` mechanism handles auto-detection, but fewer files in the tree = cleaner repo.

---

## Phase 3: Validation (~1 hour)

```bash
# 3.1 Drop & recreate
PGPASSWORD=postgres dropdb -h localhost -U postgres tsfdb --if-exists
PGPASSWORD=postgres createdb -h localhost -U postgres tsfdb

# 3.2 Apply squashed migrations
python3 manage.py migrate
# Expected: clean exit, all apps applied

# 3.3 Schema check
python3 manage.py check
# Expected: 1 baseline warning (User.username), 0 errors

# 3.4 Drift check
python3 manage.py makemigrations --dry-run
# Expected: "No changes detected"

# 3.5 Test suite
python3 manage.py test
# Expected: same pass/fail count as Phase 0.3 baseline

# 3.6 Frontend
cd ..
npx tsc --noEmit
# Expected: exit 0

cd erp_backend
```

If any step fails, debug. Don't proceed until all green.

---

## Phase 4: Cutover (~30 min)

### 4.1 Create `VERSIONS.md` at repo root

```markdown
# TSFSYSTEM Release Registry

This file maps every released version to its migration baseline. To upgrade a deployed DB, find the source version and target version, apply the listed migrations.

---

## v3.5.0 — 2026-MM-DD

**This is the first squashed baseline.** All historical migrations from project inception through 2026-05-01 are subsumed by per-app `0001_squashed_v3_5_0.py` files.

### Migration baseline (per app)

| App | Squash file | Latest |
|---|---|---|
| apps_core | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| client_portal | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| compliance | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| crm | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| data_migration | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| ecommerce | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| erp | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| finance | `0001_squashed_v3_5_0` | `0002_backfill_monetary_classification` |
| hr | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| iam | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| integrations | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| inventory | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| mcp | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| migration | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| migration_v2 | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| packages | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| pos | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| reference | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| storage | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| supplier_portal | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| workforce | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |
| workspace | `0001_squashed_v3_5_0` | `0001_squashed_v3_5_0` |

### Data migrations (must run, not in squash)
- `finance/0002_backfill_monetary_classification.py` — walks every COA row applying monetary heuristics.

### Pre-squash cleanup notes
See `MIGRATION_NOTES.md` for the list of migrations that were `--fake`'d, patched, or removed during Phase 1 cleanup.

### Upgrading from earlier versions

This is the first baselined release. Deployed DBs from before this point should:
1. Apply pending migrations one-at-a-time using `manage.py migrate <app> <migration>` until the DB is at v3.5.0 baseline state OR
2. (Cleanest) restore from a backup, drop the DB, recreate, and apply v3.5.0 migrations from scratch.

### Schema diff vs prior
Initial baseline; no prior version registry to compare against.

---
```

### 4.2 Commit

```bash
git add VERSIONS.md MIGRATION_NOTES.md
git add task\ and\ plan/maintainability/migration_release_pipeline_001*.md
git add erp_backend/scripts/release/
git add erp_backend/apps/*/migrations/0001_squashed_v3_5_0.py
git add erp_backend/erp/migrations/0001_squashed_v3_5_0.py
git add -u  # for the deleted old migration files

git commit -m "$(cat <<'EOF'
release: v3.5.0 — first squashed migration baseline

Squashes all historical per-app migrations into a single
0001_squashed_v3_5_0.py per app. Establishes the release-tagged
migration pipeline described in
task and plan/maintainability/migration_release_pipeline_001.md.

Pre-squash drift cleanup documented in MIGRATION_NOTES.md.
Release registry started at VERSIONS.md.

Verifies clean replay from empty DB; full test suite passes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### 4.3 Tag

```bash
git tag -a v3.5.0 -m "v3.5.0 — first squashed migration baseline"
git push origin release/v3.5.0
git push origin v3.5.0
```

### 4.4 Open the release PR

Use the existing PR creation workflow. Reviewers should:
- Verify `verify_clean_replay.sh` passes
- Spot-check 2-3 squashed migrations against the original sources
- Read `VERSIONS.md` and `MIGRATION_NOTES.md` for completeness

After merge, deployed DBs upgrade transparently via `replaces`.

---

## Phase 5: Post-cutover

### 5.1 Communicate

Send the team:
- Link to `VERSIONS.md`
- Summary: "from now on, every minor release squashes everything older. Read `VERSIONS.md` to know what migrations are in each version."
- The new release-cut workflow (run `verify_clean_replay.sh`, run `squash_for_release.py vX.Y.Z`, update `VERSIONS.md`, tag).

### 5.2 Add CI gate

Add `verify_clean_replay.sh` to the CI pipeline. Every PR that touches `migrations/` files runs this against a scratch DB. Prevents new drift from landing.

### 5.3 Schedule the next squash

The point of this pipeline is that it stays maintained. Schedule the next squash (v3.6.0) at the next minor release. Don't let drift re-accumulate.

---

## If something goes wrong mid-cutover

### Phase 1 takes much longer than expected
- Stop after 8 hours and re-evaluate. The number of fixes should be finite — if it's still climbing, something is structurally wrong with the migration tree (e.g., circular dependencies between apps). May need to skip squashing one problem app this round and tackle it separately.

### Phase 2 squash output is weird
- The squash file should mostly contain `CreateModel` operations matching the current model state. If it has `RemoveField` or `DeleteModel` operations, the source migrations had drift that didn't get cleaned up in Phase 1. Go back and fix.

### Phase 3 test suite regresses
- Likely cause: a test fixture that depended on a specific intermediate migration state. Find the test, refactor the fixture to be schema-state-agnostic.

### Phase 4 commit too large for review
- Split into per-app commits if reviewers prefer: one commit per `git add apps/<app>/migrations/`. PR description aggregates the per-app summaries.

---

## Checklist

Print this and check off as you go.

- [ ] Phase 0.1: Working tree clean, on `release/v3.5.0` branch
- [ ] Phase 0.2: DB backup taken
- [ ] Phase 0.3: Test suite baseline recorded
- [ ] Phase 1.1: DB dropped & recreated
- [ ] Phase 1.2-1.3: `manage.py migrate` exits 0 on fresh DB (round N final)
- [ ] Phase 1.4: `MIGRATION_NOTES.md` created with all fakes/patches logged
- [ ] Phase 1.5: Final clean-replay check all green
- [ ] Phase 2.1: All apps squashed
- [ ] Phase 2.2: All squash files renamed to `0001_squashed_v3_5_0.py`
- [ ] Phase 2.2: Docstrings updated
- [ ] Phase 2.3: Old migration files deleted (optional, recommended)
- [ ] Phase 3: All validation steps pass on clean DB
- [ ] Phase 4.1: `VERSIONS.md` created with full app table
- [ ] Phase 4.2: Commit pushed to branch
- [ ] Phase 4.3: Tag `v3.5.0` pushed
- [ ] Phase 4.4: Release PR opened
- [ ] Phase 5.2: CI gate added
- [ ] Phase 5.3: Next squash scheduled
