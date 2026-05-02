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

### inventory/workspace/hr static drift audit (2026-05-01)

Static AST-based audit of all migrations in:
- `erp_backend/apps/inventory/migrations/` — 66 files, 1070 operations
- `erp_backend/apps/workspace/migrations/` — 18 files, 187 operations
- `erp_backend/apps/hr/migrations/` — 5 files, 19 operations

The audit built a virtual model+index state by walking each app's migrations
in order, unwrapping `SeparateDatabaseAndState.state_operations` so the state
matches what Django's autodetector sees. For every `AlterField`,
`RemoveField`, `RenameField`, `RemoveIndex`, `RenameIndex`, `DeleteModel`, and
`RenameModel`, it checked the referenced field/model/index exists in the
state at that point.

**Result: 0 drift findings across all 89 migrations / 1276 operations in scope.**

#### Patched migrations
None — no Category A/B/C drift was found in the target apps.

#### Documented drift (Category D / E / ambiguous)
None — no `DeleteModel` against an absent model, no module-level import of a
deleted Python model.

#### Notes for the v3.5.0 squash operator
- The earlier-known `inventory/0004` AlterField→AddField fix is still the
  only inventory drift on record; no further inventory issues were found.
- workspace 0006/0007/0008/0010 perform a round-trip on `organization`
  fields (RemoveField → physical RunSQL recreate → state-only AddField via
  `SeparateDatabaseAndState` for autotaskrule, then plain `AddField` for the
  rest in 0010). The state ends consistent. No patches required, but worth
  inspecting during the squash since the round-trip can confuse `squashmigrations`.
- inventory has 78 `AddIndex` + 41 `RenameIndex` + 20 `RemoveIndex`; every
  remove/rename target was confirmed to have been previously created either
  via `AddIndex` or as part of a `CreateModel` `Meta.indexes` list.

Per-agent log: `/tmp/drift_audit_inventory_workspace_hr.log`.

---

### finance/pos/erp static drift audit (2026-05-01)

Static AST-based audit of all migrations in:
- `erp_backend/apps/finance/migrations/` — 83 files
- `erp_backend/apps/pos/migrations/` — 88 files
- `erp_backend/erp/migrations/` — 28 files

Same methodology as the inventory/workspace/hr audit above (virtual state
walk, recurses into `SeparateDatabaseAndState.state_operations`). Per-agent
log: `/tmp/drift_audit_finance_pos_erp.log`.

**Result**:
- finance: 0 drift hits.
- pos: 24 static drift hits in `0065`, plus 5 latent runtime hits in `0043`
  (the `sal_org_order_idx` family). All patched inline.
- erp: 0 new drift hits beyond the already-listed `0028`.

#### Patched migrations

- `pos/0065_remove_disputecase_pos_dc_ts_idx_and_more.py`
  - 18 `RemoveIndex` ops (Category C) on `disputecase`, `procurementbudget`,
    `purchaserequisition`, `supplierperformancesnapshot`, `supplierquotation`,
    and `threewaymatchresult` collapsed into one idempotent
    `RunSQL("DROP INDEX IF EXISTS …;…", reverse_sql=noop)` block. None of
    those indexes were ever created — the parent models came in via
    `0060_postable_journal_link.py` with no `Meta.indexes`.
  - 6 `RenameIndex` ops with non-existent source indexes (`pos_pb_sps_idx`,
    `pos_pb_cps_idx`, `pos_pr_ss_idx`, `pos_sps_spe_idx`, `pos_sq_ss_idx`,
    `pos_twmr_inv_idx`) wrapped in `SeparateDatabaseAndState`
    (state-only) so Django's view stays consistent without re-issuing
    failing `ALTER INDEX` SQL.
- `pos/0043_rename_sal_org_order_idx_sales_audit_organiz_25ab8f_idx_and_more.py`
  - 5 `RenameIndex` ops (`sal_org_order_idx`, `sal_org_action_idx`,
    `spl_order_status_idx`, `spl_org_method_status_idx`, `spl_reference_idx`)
    wrapped in `SeparateDatabaseAndState` (state-only). The preceding `0042`
    already issues idempotent `ALTER INDEX … IF EXISTS` for these renames;
    `0043` was duplicating the SQL and would crash on a fresh DB because
    `0042` had already done the rename.

#### Documented drift (Category D / E)

None newly found in scope. `erp/0028` was already documented; static
analysis confirms the models it deletes are properly created by earlier
migrations (`Contract` in `0010`, `ApprovalRule` in `0012`, `CustomDomain`
in `0003`, `ContractUsage`/`ContractVersion`/`ModuleDependency`/`OrgModule`
in `0010`, `LevelRoleMap` in `0012`, `ListViewPolicy` in `0024`,
`PaymentTerm` in `0019`). The "tables never created" issue noted in section
3 of the pre-v3.5.0 inventory is a *runtime* concern (deployed DBs may have
skipped those CreateModel ops because the source models were pre-deleted),
not a static-state defect — operator action remains `--fake` during cutover.

#### `sal_org_order_idx` outcome

**Found in scope** (`erp_backend/apps/pos/migrations/`).

- Created via `Meta.indexes` in `0031_sales_audit_log.py` (line 94).
- `0037` is a no-op repair (`RunSQL "SELECT 1"`) — safe.
- `0042` renames `sal_org_order_idx` → `sales_audit_organiz_25ab8f_idx`
  via raw SQL with `IF EXISTS` — safe.
- `0043` re-issued `migrations.RenameIndex(...)` for the same rename, which
  would re-attempt `ALTER INDEX sal_org_order_idx …` on a fresh DB after
  `0042` already renamed it → runtime crash.

This is now patched (`0043` rewritten as state-only). Section 3 of the
"Pre-v3.5.0 inventory" can be considered resolved.

#### Notes for the v3.5.0 squash operator

- After the patches above, the static state of pos's migration tree is
  consistent end-to-end; `squashmigrations` should produce sensible output.
- The 0042/0043 split is preserved (operator may want to merge them into a
  single SQL-side migration during the squash for clarity).
- The 18-DROP block in `0065` is intentionally idempotent — squashing it
  may eliminate it entirely, which is fine.

---

### remaining-apps static drift audit (2026-05-01)

Static AST-based drift audit covering apps not owned by other agents:
`client_portal`, `compliance`, `core` (label `apps_core`), `crm`, `ecommerce`,
`iam`, `integrations`, `mcp`, `migration` (label `data_migration`),
`migration_v2`, `packages`, `reference`, `storage`, `supplier_portal`,
`workforce`. **116 migrations across 15 apps** parsed and walked in dependency
(topological) order with a virtual model/index state.

#### Patched migrations

- `apps/client_portal/migrations/0009_alter_clientorder_delivery_rating_and_more.py`
  - 8 `AlterField` ops (Category A) on `ClientPortalConfig` fields that no
    prior migration ever created: `custom_css`, `logo_url`, `og_image_url`,
    `primary_color`, `secondary_color`, `seo_description`, `seo_keywords`,
    `seo_title`. Each `AlterField` was rewritten to `AddField` with a
    `# v3.5.0 cleanup:` marker. Field defaults preserved verbatim.
- `apps/workforce/migrations/0007_rename_workforce_ese_tes_idx_workforce_s_organization__d4e395_idx_and_more.py`
  - 13 `RenameIndex` ops (Category C) targeting indexes that were never added
    in state. The earlier `0006_add_performance_indexes` was deliberately
    neutered to a no-op marker, so the indexes (`workforce_ese_tes_idx` etc.)
    never reached Django's migration state. Each `RenameIndex` replaced with a
    paired `RunSQL('ALTER INDEX IF EXISTS old RENAME TO new;', reverse_sql=
    'ALTER INDEX IF EXISTS new RENAME TO old;')`. Idempotent on fresh DBs and
    a real rename on legacy DBs that applied the original (non-neutered) 0006.
    The new index names are not referenced by any later migration (verified),
    so the lack of state tracking has no downstream effect.

#### Documented drift (Category D / E)

None — no `RemoveModel`/`DeleteModel` against absent models, no migration
imports of removed Python classes. The four `apps_core` classes
(`KernelPermission`, `ResourcePermission`, `Role`, `UserRole`) created by
`apps/core/migrations/0004` live under `erp_backend/kernel/rbac/models.py`
with explicit `Meta.app_label = 'apps_core'` — confirmed live, not orphan.

#### Cross-cutting findings

- **Cross-app FK refs**: 0 unknown. Every `to='X.Y'` in in-scope migrations
  resolves to a model created by some migration or defined in source
  (including proxy models, `TenantModel`-inheriting models, and the
  `kernel.rbac.models` placement above).
- **Settings**: 0 non-standard `*_USER_MODEL`. All `swappable_dependency()`
  calls use the standard `settings.AUTH_USER_MODEL`.
- **Cycles**: 0 cycles across the full 406-node cross-app migration dependency
  graph (entire repo, not just in-scope apps).
- **`__init__.py`**: all 15 in-scope `migrations/__init__.py` files present
  (some are 0-byte, which is the standard Django convention).

#### Notes for the v3.5.0 squash operator

- `apps/migration` carries the Django app_label `data_migration`; `apps/core`
  carries `apps_core`. Phase 2 squash commands must use the labels, not the
  directory names: `manage.py squashmigrations data_migration 0001 <latest>`
  and `manage.py squashmigrations apps_core 0001 <latest>`.
- The workforce/0007 patch preserves backward compatibility with any deployed
  DB that already had the indexes renamed by the original (pre-neuter) 0006.
- After these patches, all 116 in-scope migrations form a clean static state
  — re-running the AST drift checker reports 0 findings.

Per-agent log: `/tmp/drift_audit_remaining_apps.log`.

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
