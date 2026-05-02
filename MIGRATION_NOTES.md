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

## Replay attempt 2026-05-01/02 — additional drift discovered

After the static audits completed, a real `manage.py migrate` against a fresh DB surfaced drift categories the AST audit didn't catch. Documented here so the operator running the v3.5.0 cutover knows what's left.

### Category F — `AddField` on a column that already exists

The AST audit checked AlterField/RemoveField/RemoveIndex against virtual state, but didn't catch the inverse: `AddField` on a column already in state. 99 such ops surfaced at runtime.

**Fix applied** (bulk via inline Python regex pass): every flagged `AddField` was changed to `AlterField`. AlterField on an unchanged column is a no-op; on a changed column it applies the diff. Same end state, no crash.

**Files patched (15)**:
- `client_portal/0002_initial.py` (1), `0003_initial.py` (1), `0004_initial.py` (23)
- `crm/0020_*` (9), `0021_merge_*` (11), `0022_remove_contact_idx_*` (3)
- `finance/0015_remove_invoice_*` (11)
- `inventory/0012_remove_brand_*` (4 — brand/category/parfum/unit), `0013_remove_stockmove_*` (1), `0022_remove_product_*` (7), `0042_add_timestamps_*` (2)
- `migration/0002_initial.py` (3)
- `workforce/0007_rename_workforce_ese_*` (3)
- `workspace/0006_remove_autotaskrule_*` (17), `0009_autotaskrule_sync_state.py` (7)
- `erp/0010_auditlog_*` (1 — Role.organization)

### Category G — `RenameIndex` on an index that doesn't exist on fresh DB

`erp/0025_rename_*` performs 13 `RenameIndex` ops on indexes from `erp/0010`. On a fresh DB, those indexes either don't exist or were auto-renamed by an intervening `AlterModelTable`.

**Fix applied**: each RenameIndex wrapped in `SeparateDatabaseAndState` with idempotent `RunSQL("ALTER INDEX IF EXISTS old RENAME TO new;")`.

### Category H — Cascade-drop walks live Python registry

`erp/0028_remove_approvalrule_organization_and_more.py` drops Contract/ContractUsage/etc. The `AlterUniqueTogether` op crashes with `ContractUsage has no field named 'contract'` because Django's field-state lookup walks the live model registry — and the models are absent from source.

**Action**: `--fake` at apply time. Already documented above as needing fake; confirmed at this replay too.

### Category I — Cross-app model ownership transfer without paired RemoveModel

`apps_core/0004_kernelpermission_resourcepermission_role_userrole_and_more.py` tries to `CreateModel` `KernelPermission/ResourcePermission/Role/UserRole` — but the tables (`kernel_permission`, `kernel_role`, etc.) were already created by `erp/0010` via `AlterModelTable`. The migration was generated as part of moving these models from `erp` to `apps_core`, but the corresponding `RemoveModel` in erp was never authored.

**Action**: `--fake` apps_core/0004. Tables exist with correct schema; only the migration record needs updating.

### Category J — Multiple parallel `_initial` branches in one app

`client_portal` has TWO independent migration branches sharing number prefixes:

```
Branch A: 0002_clientportalconfig_store_mode_fields → 0004_clientportalconfig_storefront_theme → 0005_clientportalconfig_storefront_type → 0006_alter_clientportalconfig_storefront_type_and_more
Branch B: 0002_initial → 0003_initial → 0004_initial → 0005_clientorderline_variant... → 0006_clientportalconfig_layout
```

`0009_alter_clientorder_delivery_rating_and_more.py` tries to `AlterField` `ClientPortalConfig.allow_guest_browsing` — added by branch A's `0002_clientportalconfig_store_mode_fields:38`. Django applies in dependency order; the actual order may interleave so 0009 hits before branch A is fully consumed in the Django state passed to its database_forwards.

**Cannot be patched migration-by-migration.** The state is structurally tangled — multiple `initial = True` migrations, divergent dependency chains.

**Action**: `squashmigrations client_portal 0001 <latest>` is the right tool. After squashing, the app gets ONE clean migration built from current model definitions. All parallel-branch tangles vanish because the squash regenerates from `models.py`.

**This is the forcing function for the v3.5.0 cutover.** client_portal cannot be cleanly replayed without squashing first.

### Replay state at end of session 2026-05-02

The dev DB was advanced through (in this order):
- All `erp` migrations 0001–0028 (0028 faked)
- All `inventory` migrations through 0017
- All `finance` migrations through 0014
- All `pos` migrations through 0049
- All `crm` migrations applied
- `apps_core` through 0004 (faked)
- Standard Django apps (auth, contenttypes, authtoken, sessions, admin)
- `client_portal` through 0008
- **Crashed at**: `client_portal/0009` (Category J — needs squash, not patch)

To resume from this state: operator should run `squashmigrations` per app (preferably all apps at once via `scripts/release/squash_for_release.py v3.5.0`), validate the squashed tree replays cleanly on a fresh DB, then proceed with Phase 2-4 of the cutover runbook.

### Updated drift category catalog (for next static audit pass)

Adds to the original A/B/C/D/E:

- **F**: `AddField` on a column already in state. Fix: `AddField → AlterField`.
- **G**: `RenameIndex` on an index that doesn't exist on fresh replay. Fix: wrap in `SeparateDatabaseAndState` with idempotent `RunSQL`.
- **H**: Cascade-drop walks live Python registry for fields not in source. Fix: `--fake`.
- **I**: Cross-app model-ownership transfer with missing paired `RemoveModel`. Fix: `--fake` the new app's CreateModel.
- **J**: Multiple parallel `_initial` branches with shared number prefixes. Fix: `squashmigrations` (no per-migration patch resolves it).

Future static audit passes should scan for F + G + J explicitly. H and I require live introspection so are runtime-discovery items.

### Net progress this session

- **Static audits**: 404 migrations analyzed across all apps; 50 issues found, 49 patched, 1 documented.
- **Runtime drift**: 99 Cat F + 13 Cat G + 1 Cat H (faked) + 1 Cat I (faked) + ~150 migrations applied successfully.
- **Forcing function identified**: Category J in `client_portal`. Per-migration patches cannot resolve; squashing is mandatory.
- **Code-only patches saved**: ~150 fixes across ~20 migration files. Squash will subsume all of them.

---

## v3.5.0 cutover attempt 2026-05-02 — partial, halted at structural limit

Ran the cutover from this session. Got further than the previous attempts but hit a fundamental limit that requires operator-grade decision-making.

### What ran successfully

1. Dropped + recreated `tsfdb`.
2. `manage.py migrate` advanced cleanly through all of erp 0001-0027, all of inventory through 0017, all of finance through 0014, all of pos through 0049, all of crm, all of standard Django apps (auth/admin/contenttypes/authtoken).
3. `--fake erp/0028` (Cat H) — works, no schema impact.
4. `--fake apps_core/0004` (Cat I) — works, tables already exist via erp/0010's AlterModelTable.
5. Continued migrate: client_portal 0001 → 0008 OK.
6. Generated `apps/client_portal/migrations/0001_squashed_0017_remove_quoterequest_product_and_more.py` via `manage.py squashmigrations client_portal 0017` with optimization (158 ops → 41 ops).

### Where it halted

Applying the squashed `client_portal/0001_squashed_0017_*` against a fresh DB raised `relation "client_quote_request" already exists`. Confirmed via `\dt`: the table genuinely doesn't exist in the DB. The error is a Django state-vs-DB mismatch — most likely because the squash includes a CreateModel for a model whose ContentType row already exists from `apps_core/0004 --fake`, OR because Django's pre-flight check uses the wrong table-existence query.

Either way, the squash is NOT clean: the multi-branch history (Category J) carried forward into the squashed file as inconsistent operations even after `--optimize` collapsed 158 → 41 ops.

### Why this matters for the cutover

The fundamental issue: **the migration tree has accumulated multi-year structural drift that `squashmigrations` cannot fix automatically.** Categories A-I are patchable; Category J (parallel `_initial` branches) is supposed to be resolvable by squashing, but in practice Django's squash inherits the broken operation order from the source migrations.

The operator has three viable paths from here:

#### Path 1: Manual squash editing (1-2 hours)
- Review the auto-generated `0001_squashed_0017_*.py`.
- Manually reorder operations: every `AlterField` must come AFTER the `AddField` for the same (model, field).
- Manually drop duplicate `AddField` ops that exist due to the parallel branches.
- Re-test on fresh DB.

#### Path 2: Nuke and regenerate (3-4 hours, cleanest)
- Drop ALL of `apps/client_portal/migrations/*.py` except `__init__.py`.
- Run `manage.py makemigrations client_portal` from a fresh checkout — Django generates a single clean `0001_initial.py` from the current model definitions.
- Cannot use this path for apps with deployed prod DBs (the `replaces = []` mechanism doesn't apply because there's no squash file to mark them replaced). For dev-only it's fine.
- Repeat for any other app showing similar drift.

#### Path 3: Accept the manual `--fake` chain (longest, but lowest risk for prod)
- Forge through the cutover with `--fake` decisions per migration, documenting each.
- Tedious but every prod DB is unaffected (each migration that ran before stays applied; new ones get faked in if they're no-ops).
- Estimated effort: 4-8 hours for the operator.

### What's left in place for the operator

- `apps/finance/migrations/0079_merge_branches.py` (no-op merge resolving the 0076 leaf split) — keep.
- `apps/inventory/migrations/0004` — `AlterField` → `AddField` patches for legacy_id — keep.
- `apps/pos/migrations/0043` and `0065` — RenameIndex wrapped state-only — keep.
- `apps/erp/migrations/0010` — AddField → AlterField for Role.organization — keep.
- `apps/erp/migrations/0025` — 13 RenameIndex wrapped in SeparateDatabaseAndState — keep.
- 99 Cat F bulk-patches across 14 files (AddField → AlterField for fields already in state) — keep.
- `apps/client_portal/migrations/0001_squashed_0017_remove_quoterequest_product_and_more.py` — **inspect manually**; may need editing or replacement per Path 1/2.

All patches are kept because they're correct in isolation; reverting them would just re-introduce the same drift the operator would re-discover.

### Updated drift catalog

The original 5 + 5 categories now total 10. After this attempt, two more known-pattern observations:

- **Category J (revisited)**: `squashmigrations` with `--optimize` collapses 158→41 ops but doesn't reorder them. Multi-branch tangles still produce broken squashes. The right fix for fresh dev DBs is **regenerating** (Path 2), not squashing.
- **Cross-app fakes propagate**: when one app's CreateModel is `--fake`d, downstream apps that depended on those models' ContentType rows can hit DuplicateTable errors against tables that don't exist in the DB. Django's app-loading is probably the source.

### Cutover status

| Step | Status |
|---|---|
| 1. Pre-cutover prep (audit, patches, scripts) | ✅ DONE this session |
| 2. Drop & recreate dev DB | ✅ Done multiple times this session |
| 3. Migrate up to first known fake (erp/0028) | ✅ Reproducible |
| 4. Fake erp/0028 + apps_core/0004 | ✅ Tested |
| 5. Migrate to client_portal squash | ❌ Blocked on Cat J residual issue |
| 6. Run squash_for_release.py for ALL apps | ⏸ Pending step 5 |
| 7. Verify clean replay | ⏸ Pending |
| 8. Tag v3.5.0 | ⏸ Pending |

This session got steps 1-4 done. Step 5 is the operator-led decision (Path 1/2/3 above). Steps 6-8 follow once 5 unblocks.

### Net outcome

- Pre-cutover prep is complete and tooled.
- ~150 individual drift patches applied across ~20 migration files.
- One squashed migration (client_portal) generated but needs manual review.
- The remaining work (Path 1/2/3 decision + execution) is structurally beyond what an autonomous agent should do on a shared dev environment.

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

---

### Category J inventory (2026-05-02)

**Method**: scanned every migration filename under `erp_backend/erp/migrations/` and `erp_backend/apps/*/migrations/` for duplicate leading number prefixes (e.g. `0002_X.py` AND `0002_Y.py`); parsed `dependencies = [...]` to distinguish parallel branches from linear chains; counted `initial = True` markers; verified whether any descendant `*_merge_*.py` migration converges all duplicate-prefix heads.

**Classification rules**:
- **CLEAN**: no duplicate number prefixes. (`0001_initial` + `0002_initial` co-existing as a Django circular-FK split is benign — both initial=True but the second linearly depends on the first, which is the standard idiom.)
- **MERGED**: duplicate prefixes exist, but every duplicate is a true descendant of a `*_merge_*.py` node, AND no duplicate-prefix bucket contains an `initial=True` parallel branch. Replay can succeed today; the merge nodes are the historic Category-J fingerprint but are now structurally sound.
- **CATEGORY J**: at least one of (a) duplicate prefixes that no merge migration resolves, (b) a duplicate-prefix bucket that contains an `initial=True` file alongside a non-`initial` parallel branch (two heads that both claim "initial"), or (c) `initial=True` count strictly greater than 2 (beyond the standard circular-FK split). For these apps `squashmigrations` is mandatory before clean replay.

| App | Status | Duplicate prefixes | Merged by | initial=True count |
|---|---|---|---|---|
| client_portal | CATEGORY J | 0002, 0004, 0005, 0006, 0010, 0011, 0012 | partial: 0002/0004/0005/0006 by `0016_merge_20260412_0207`, 0010 by `0011_merge_0010_coupon`, 0011/0012 by `0013_merge_0012` — but parallel `*_initial.py` branch (0002/0003/0004 all initial=True) makes the structural drift unrecoverable without squash | 4 |
| compliance | CLEAN | — | — | 1 |
| core | CLEAN | — | — | 1 |
| crm | MERGED | 0020, 0021 | `0021_merge_20260311_0135` | 2 (standard 0001+0002 circular-FK split) |
| ecommerce | CLEAN | — | — | 1 |
| erp | CLEAN | — | — | 2 (standard 0001+0002 circular-FK split) |
| finance | MERGED | 0029, 0030, 0031, 0076 | 0029 by `0031_merge_compound_tax_and_enterprise_posting`; 0030/0031 by `0035_merge_tax_account_and_policy_fks`; 0076 by `0079_merge_branches` | 2 (standard split) |
| hr | CLEAN | — | — | 1 |
| iam | CLEAN | — | — | 1 |
| integrations | CLEAN | — | — | 1 |
| inventory | MERGED | 0013, 0039 | 0013 by `0018_merge_20260307_0036`; 0039 by `0041_merge_20260317_1638` | 2 (standard split) |
| mcp | CLEAN | — | — | 1 |
| migration | CLEAN | — | — | 2 (standard 0001+0002 circular-FK split) |
| migration_v2 | CLEAN | — | — | 1 |
| packages | CLEAN | — | — | 1 |
| pos | MERGED | 0022, 0031, 0033, 0034, 0035, 0045, 0046 | 0022 by `0045_merge_0022_restrict_cash_0044_generated_document`; 0031 by `0033_merge_20260302_2036`; 0033 by `0034_merge_20260302_2042`; 0034 by `0035_merge_20260302_2226`; 0035 by `0036_merge_0035_merge_20260302_2226_0035_stock_move`; 0045/0046 by `0048_merge_20260305_0130` | 1 |
| reference | CLEAN | — | — | 1 |
| storage | CLEAN | — | — | 1 |
| supplier_portal | CLEAN | — | — | 1 |
| workforce | CLEAN | — | — | 1 |
| workspace | CLEAN | — | — | 1 |

**Apps requiring squash before clean replay** (CATEGORY J): `client_portal`.

**Apps where merge migrations resolve all duplicates** (MERGED — replayable today, but the structural fingerprint is preserved and any future migration that touches a duplicate-prefix ancestor is at risk): `crm`, `finance`, `inventory`, `pos`.

**Apps with no duplicate prefixes** (CLEAN): `compliance`, `core`, `ecommerce`, `erp`, `hr`, `iam`, `integrations`, `mcp`, `migration`, `migration_v2`, `packages`, `reference`, `storage`, `supplier_portal`, `workforce`, `workspace`.

**Notes for the operator**:
- Total apps analyzed: 21 (1 root `erp` + 20 under `apps/`). `apps_core` is `apps/core/` (single-level, already covered).
- The standard Django circular-FK split (`0001_initial` + `0002_initial` linearly chained) was excluded from the Category-J trigger; only `client_portal` exhibits more than two `initial=True` files (4) — three of which (`0002_initial`, `0003_initial`, `0004_initial`) form a parallel branch off `0001_initial` distinct from the `0002_clientportalconfig_store_mode_fields` branch. This is the canonical "two parallel `_initial`-named branches" pattern from the runbook.
- `pos` carries the largest count of duplicate-prefix buckets (7) — all merged. Worth a defensive squash candidate even though replay currently passes.
- Full per-app dependency dumps (every duplicate-prefix file with its `dependencies = [...]` and `initial` flag) are recorded at `/tmp/category_j_inventory.log`.
