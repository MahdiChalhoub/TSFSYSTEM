# Migration Cleanup Notes

Per-cutover log of `--fake` decisions, patched migrations, and removed migrations during release-pipeline phases. Each release that involves Phase 1 drift cleanup gets an entry here. Most releases don't.

**See also:**
- `VERSIONS.md` — the release registry that points to this file for context
- `task and plan/maintainability/migration_release_pipeline_001.md` — the architecture
- `task and plan/maintainability/migration_release_pipeline_001_runbook.md` — the cutover runbook

---

## Pre-v3.5.0 inventory (pre-baseline drift)

Discovered 2026-05-01 during a dev-DB clean-replay attempt. These are documented here so the operator running the v3.5.0 cutover starts from a checklist rather than rediscovering each issue.

### Migrations confirmed broken on a fresh DB

1. **`erp/0028_remove_approvalrule_organization_and_more.py`**
   - Tries to drop `Contract`, `ContractVersion`, `ContractUsage`, `ApprovalRule`, `CustomDomain`, `ListViewPolicy`, `LevelRoleMap`, `ModuleDependency`, `ModuleMigration`, `OrgModule`, `PaymentTerm`, `TransactionType`, `TransactionVerificationPolicy`, `KernelModule`, `ResourcePermission`, `UserRole` tables.
   - None of these tables are created by any earlier migration in the tree. The corresponding model classes have also been removed from the Python source.
   - **Recommended action**: `--fake` this migration. Operations are no-ops against the current schema.

2. **`inventory/0004_alter_category_barcode_sequence_and_more.py`** ✅ **PATCHED 2026-05-01**
   - Originally had `AlterField` on `Product.legacy_id` and `Warehouse.legacy_id`.
   - Neither field exists in the migration state at that point — `0001_initial` doesn't add them, and no intermediate migration creates them.
   - **Action taken**: changed both `AlterField` operations to `AddField`. The fix is minimal and unambiguous (the migration was clearly intended to add these fields).

3. **Unknown migration tries to drop `sal_org_order_idx`**
   - Confirmed via the symptom `relation "sal_org_order_idx" does not exist` during replay.
   - The index is not created by any earlier migration.
   - Source not yet traced. Likely candidate apps: `pos`, `inventory`, or `crm` (the `sal_` prefix suggests a sales-related index).
   - **Recommended action during cutover**: search migrations for `name='sal_org_order_idx'`, replace the `RemoveIndex` with `RunSQL('DROP INDEX IF EXISTS sal_org_order_idx;', reverse_sql=migrations.RunSQL.noop)`.

4. **Finance leaf-node split (0076 ↔ 0078)** ✅ **RESOLVED 2026-05-01**
   - `0076_backfill_monetary_classification` and `0076_category_defaults_digital` both depended on `0075_revaluation_overhaul`.
   - Resolved by hand-authored `0079_merge_branches.py` (no-op merge).

### Migrations not yet investigated

These haven't been hit during replay attempts because earlier migrations failed first. Expect more drift in:

- Any app with a long migration history (`finance`/79, `inventory`/66, `pos`/80, `workspace`/18) is statistically more likely to have accumulated similar drift.
- `crm`, `compliance`, `iam` have ~10-25 migrations each — possible but less likely.

The Phase 1 cutover work will surface these one-by-one. Document each as you go.

### Suspected root causes

The drift comes from a combination of:

- **Hand-edited migrations** (someone tweaked an `AddField` to `AlterField` after a model rename).
- **Out-of-band schema changes** (someone ran raw SQL or `ALTER TABLE` directly, then later `makemigrations` generated an `Alter` op against the changed state).
- **Removed models** (deleted from source code without a corresponding `RemoveModel` migration).
- **Renamed indexes** (a `db_index=True` flag changed, the auto-name changed, but the prior `RemoveIndex` op kept the old name).

Avoid all four going forward by:
- Always running `verify_clean_replay.sh` before merging migration changes.
- Always using `manage.py makemigrations` (never hand-editing) until you're an experienced Django operator.
- Treating the migration tree as append-only — never edit historical migrations after they've been applied somewhere.
- Squashing at every minor release so the pre-squash history is short.

---

## Per-release cleanup log

Future entries follow this template:

```markdown
## vX.Y.Z cleanup — YYYY-MM-DD

### Faked migrations
- `<app>/<migration>` — <reason>

### Patched migrations
- `<app>/<migration>` — <what changed and why>

### Removed migrations
- `<app>/<migration>` — <reason>

### Open drift (left for next cutover)
- (any drift spotted but not addressed this round)
```
