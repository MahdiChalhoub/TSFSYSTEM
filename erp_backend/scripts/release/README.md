# scripts/release — Migration release pipeline tools

Tooling for the versioned-squash-baseline release pipeline (see
`task and plan/maintainability/migration_release_pipeline_001.md`). All scripts
are designed to be run from `erp_backend/`.

## Catalog

| Script | Purpose | When to run |
|---|---|---|
| `audit_drift.py` | Static AST scan of every migration for the 9 detectable drift categories (A-G + I + J). Outputs human or JSON report. | CI gate on every PR touching `migrations/`. Local sanity check before opening a PR. |
| `verify_clean_replay.sh` | Drops a scratch Postgres DB, runs all migrations from zero, then `manage.py check` and `makemigrations --dry-run`. | Before any release cut. Can also run nightly on `main`. |
| `squash_for_release.py` | One-shot release helper: walks every app, squashes everything above the prior baseline into a single `0001_squashed_v{X_Y_Z}.py`. | Once per minor release, by the release engineer. |
| `verify_versions_md.py` | Sanity-check `VERSIONS.md` against the migration tree on disk. | CI gate on every PR. |

## Drift categories detected by `audit_drift.py`

| Cat | Pattern | Action |
|---|---|---|
| A | `AlterField` on a field not yet in state | Fix inline (likely missing `AddField`) |
| B | `RemoveField` on a field not yet in state | Fix inline |
| C | `RemoveIndex` / `RenameIndex` on a non-existent index | Wrap in `SeparateDatabaseAndState` or use `RunSQL("…IF EXISTS…")` |
| D | `DeleteModel` / `RenameModel` on a non-existent model | Fix inline or `--fake` if tables exist |
| E | `from apps.X.models import Y` where `Y` is no longer in source | Update the import |
| F | `AddField` on a field already in state | Change to `AlterField` |
| G | `RenameIndex` outside `SeparateDatabaseAndState` after `AlterModelTable` on the same model | Wrap in `SeparateDatabaseAndState` with idempotent `RunSQL` |
| H | Cascade-drop walks live registry | Runtime-only — not detected statically; `--fake` at apply time |
| I | Cross-app model ownership transfer without paired `RemoveModel` | `squashmigrations` (or `--fake` the new app's CreateModel) |
| J | Multiple parallel `_initial` branches in one app | `squashmigrations` (only resolution path) |

Cats A/B/C/D/E/F/G are critical and trigger exit code 1 (must fix before merge).
Cats I/J are reported but exit 0 — they require a release-cut squash to resolve,
not inline patches.

## Typical CI integration

```yaml
- name: Migration drift audit
  run: |
    cd erp_backend
    python3 scripts/release/audit_drift.py

- name: VERSIONS.md sanity
  run: |
    cd erp_backend
    python3 scripts/release/verify_versions_md.py

- name: Clean replay (release branch only)
  if: github.ref == 'refs/heads/release/*'
  run: |
    cd erp_backend
    bash scripts/release/verify_clean_replay.sh
```

## Local usage

```bash
cd erp_backend/

# Full report
python3 scripts/release/audit_drift.py

# One app
python3 scripts/release/audit_drift.py --app inventory

# One category
python3 scripts/release/audit_drift.py --category F

# Just the summary (no per-finding lines)
python3 scripts/release/audit_drift.py --quiet

# Machine-readable
python3 scripts/release/audit_drift.py --json

# Tests for the audit script
python3 scripts/release/test_audit_drift.py
```

See also:

- `MIGRATION_NOTES.md` — full catalog of drift categories with real examples and
  the per-release cleanup log.
- `task and plan/maintainability/migration_release_pipeline_001.md` — pipeline
  architecture.
- `task and plan/maintainability/migration_release_pipeline_001_runbook.md` —
  step-by-step cutover runbook.
