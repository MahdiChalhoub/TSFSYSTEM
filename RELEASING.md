# Releasing TSFSYSTEM

The day-to-day cheatsheet for the migration release pipeline. For the full architecture see `task and plan/maintainability/migration_release_pipeline_001.md`.

---

## TL;DR

- **Every minor release** (v3.5.0 → v3.6.0 → v3.7.0 …) gets a **squashed baseline** per app.
- **Patch releases** (v3.5.0 → v3.5.1) just add migrations on top, no squash.
- **`VERSIONS.md`** is the single source of truth — read it to know what's in each release.
- **Drift is impossible** if you run `verify_clean_replay.sh` before merging anything.

---

## Day-to-day: developing on top of the baseline

```bash
# 1. Make model changes in apps/<X>/models.py
# 2. Generate the migration
cd erp_backend
python3 manage.py makemigrations <app>

# 3. Apply locally
python3 manage.py migrate

# 4. Before pushing the PR, verify the tree replays cleanly from zero
bash scripts/release/verify_clean_replay.sh
```

The verify script drops a scratch DB, runs `migrate` from empty, and asserts clean exit. If it fails, the migration tree has new drift — fix before merging.

CI should run `verify_clean_replay.sh` automatically on every PR that touches `migrations/` files.

---

## Cutting a minor release (v3.5.0 → v3.6.0)

1. **Verify the tree is clean**:
   ```bash
   cd erp_backend
   python3 scripts/release/audit_drift.py
   bash scripts/release/verify_clean_replay.sh
   ```
   Both must pass before proceeding.

2. **Squash all apps for the new release**:
   ```bash
   python3 scripts/release/squash_for_release.py v3.6.0
   ```
   This walks every app, finds the v3.5.0 baseline, and squashes everything above it into a new `0001_squashed_v3_6_0.py`. A draft `VERSIONS.md` entry is written to `/tmp/versions_md_draft.md`.

3. **Re-verify**:
   ```bash
   bash scripts/release/verify_clean_replay.sh
   ```
   Must still pass on the squashed tree.

4. **Update `VERSIONS.md`** with the v3.6.0 entry (paste the draft from `/tmp/versions_md_draft.md` and fill in the data-migrations and changelog sections).

5. **Run the registry sanity check**:
   ```bash
   python3 scripts/release/verify_versions_md.py
   ```

6. **Delete the now-subsumed migration files**:
   ```bash
   # The squashed file's `replaces = [...]` lists what's safe to delete.
   # Use `git rm` so history is preserved.
   ```

7. **Commit + tag**:
   ```bash
   git commit -m "release: v3.6.0 — minor squash baseline"
   git tag -a v3.6.0 -m "v3.6.0"
   git push origin main
   git push origin v3.6.0
   ```

---

## Cutting a patch release (v3.5.0 → v3.5.1)

No squash. Just normal development:

1. Make model changes, generate migration (becomes `0002_<name>.py` on top of the v3.5.0 baseline).
2. `verify_clean_replay.sh` — must pass.
3. Update `VERSIONS.md` with a v3.5.1 entry noting the new migration.
4. Tag `v3.5.1`, push.

The next minor release will subsume v3.5.1's migrations into the v3.6.0 squash.

---

## Upgrading a deployed DB

1. Look up the source version and target version in `VERSIONS.md`.
2. The squashed baselines use Django's `replaces = [...]` mechanism — Django auto-detects which historical migrations have already been applied and treats the squash as already-applied if any are.
3. Run `python3 manage.py migrate` — Django handles the rest.

For dev environments where you don't care about preserving data: drop the DB, recreate, run `migrate`. You're at the latest baseline in 30 seconds.

---

## Drift detection

Run anytime to scan the tree for problems:

```bash
cd erp_backend
python3 scripts/release/audit_drift.py             # full report
python3 scripts/release/audit_drift.py --quiet     # summary only
python3 scripts/release/audit_drift.py --json      # for tooling
python3 scripts/release/audit_drift.py --app crm   # one app
python3 scripts/release/audit_drift.py --category F  # one category
```

10 drift categories detected (A-J). Exit 0 = no critical drift. Exit 1 = something to fix before merging.

| Cat | Pattern | Fix |
|---|---|---|
| A | AlterField on missing field | Change to AddField |
| B | RemoveField on missing field | Delete the op |
| C | RemoveIndex/RenameIndex on missing index | Wrap in `RunSQL("DROP INDEX IF EXISTS …")` |
| D | DeleteModel of never-created model | `--fake` |
| E | Imports a deleted Python model | Remove or `--fake` |
| F | AddField on existing column | Change to AlterField |
| G | RenameIndex unsafe (post-AlterModelTable) | Wrap in `SeparateDatabaseAndState` with idempotent `RunSQL` |
| H | Cascade-drop walks live registry | `--fake` (runtime-only) |
| I | Cross-app ownership transfer w/o paired RemoveModel | `--fake` |
| J | Multiple parallel `_initial` branches | Squash mandatory |

Full reference: `MIGRATION_NOTES.md`.

---

## What NOT to do

- ❌ **Don't hand-edit historical migrations** after they've been applied somewhere. Treat the migration tree as append-only.
- ❌ **Don't skip `verify_clean_replay.sh`** on PRs that touch `migrations/`. It's the only thing preventing drift from re-accumulating.
- ❌ **Don't squash mid-release-cycle**. Squash only at minor-version boundaries.
- ❌ **Don't change a squashed file's `replaces = [...]` list** after the squash has been pushed. Deployed DBs depend on it.
- ❌ **Don't run `manage.py migrate --fake`** without writing the rationale in `MIGRATION_NOTES.md` first. Fakes mask schema state — they need to be auditable.

---

## Repository pointers

| File | Purpose |
|---|---|
| `VERSIONS.md` | Release registry — what migrations are in each release |
| `MIGRATION_NOTES.md` | Drift catalog (10 categories) + per-cutover decisions |
| `RELEASING.md` | This file — operational cheatsheet |
| `task and plan/maintainability/migration_release_pipeline_001.md` | Full architecture |
| `task and plan/maintainability/migration_release_pipeline_001_runbook.md` | First-cutover detailed runbook |
| `erp_backend/scripts/release/audit_drift.py` | Drift detector |
| `erp_backend/scripts/release/verify_clean_replay.sh` | CI gate |
| `erp_backend/scripts/release/squash_for_release.py vX.Y.Z` | Release-cut helper |
| `erp_backend/scripts/release/verify_versions_md.py` | Registry sanity check |
| `erp_backend/scripts/release/test_audit_drift.py` | Unit tests for the detector |
| `erp_backend/scripts/release/README.md` | Script catalog |

---

## Current release: v3.5.0

- Tagged 2026-05-02
- 34 migrations across 21 apps
- Pre-v3.5 history archived at `/tmp/migrations_archive_pre_v3_5_0/` (6.1 MB, 432 files)
- See VERSIONS.md for the full per-app baseline table

---

## Future releases (template)

```
v3.5.0 ── 2026-05-02 ── 34 migrations  (first baseline)
v3.5.x ── patches    ── adds 0002+, 0003+, … on top of v3.5.0 squashes
v3.6.0 ── ?          ── new squash, all v3.5.x post-baseline migrations subsumed
v3.7.0 ── ?          ── …
v4.0.0 ── ?          ── …
```

Every minor squash is the same operation: `squash_for_release.py vX.Y.0`, verify, update `VERSIONS.md`, tag.
