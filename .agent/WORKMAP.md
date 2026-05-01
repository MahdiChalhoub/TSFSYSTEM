# 🗺️ WORKMAP — Persistent Task Queue & Roadmap

> **Purpose**: Persistent backlog of all known tasks, bugs, and feature requests.
> Every agent MUST read this file at session start, and update it when discovering new work items or completing existing ones.
> Items are NEVER deleted — only marked as done with a completion date.

---

## Priority Levels
- 🔴 **CRITICAL** — Blocks users, data loss risk, security issue
- 🟠 **HIGH** — Important functionality missing or broken
- 🟡 **MEDIUM** — Improvement that enhances UX or maintainability
- 🟢 **LOW** — Nice-to-have, tech debt, cleanup

---

## 🔴 CRITICAL

*No critical items*

---

## 🟠 HIGH

### [DONE 2026-04-30] Maintainability Phase 1 — Split Giant Backend Files
- **Discovered**: 2026-04-30
- **Impact**: Top 3 backend monoliths (2,903 / 2,002 / 1,849 lines) split into 35 focused modules, all ≤300 lines.
- **Plan**: `task and plan/maintainability/maintainability_phase1_backend_splits_001.md`
- **Result**:
  - `closing_service.py` (2,903 → 294) + 13 sibling `closing_*` modules (audit / snapshot / opening / integrity / year-impl / partial / pnl-sweep / chain / period / helpers). Standalone-function pattern with `staticmethod` re-attachment in the facade — zero call-site changes; 23 ClosingService methods preserved.
  - `account_views.py` (2,002 → 122) + 9 sibling files (financial_account_views, coa_account_helpers, 7 mixin modules). Mixin pattern keeps `coa` router registration; 30 @action endpoints preserved.
  - `fiscal_views.py` (1,849 → 183) + 10 sibling files (period viewset, permissions, summary/close/history/PPA/snapshot/multi-year/yoy/checklist/canary mixins). Mixin pattern keeps `fiscal-years` and `fiscal-periods` registrations; 20 @action endpoints preserved.
- **Verification**: `manage.py check` passes; `test_close_integrity_invariants` (16/16), `test_bulk_classify` (9/9), `test_revaluation_service` (35/35), `test_scope_invariants` all pass. Other failures in finance test suite (~50) pre-existed and are unrelated (missing `BankAccount`/`DepreciationScheduleEntry` model imports, fixture date issues).
- **Risk**: LOW (internal refactor, zero URL/API/frontend changes)

### [DONE 2026-04-30] Maintainability Phase 2 — Split Giant Frontend Files
- **Discovered**: 2026-04-30
- **Impact**: Top 3 frontend monoliths (2,537 / 2,031 / 1,999 lines) split into 46 focused modules, all ≤300 lines.
- **Plan**: `task and plan/maintainability/maintainability_phase2_frontend_splits_001.md`
- **Result**:
  - `FxRedesigned.tsx` (2,537 → 288) + 16 sibling files in `_fx/` (constants, atoms, SubTabBar, LoadErrorBanner, PairChart, PolicyCard, RateRulesView, EditRateModal, DeleteRateConfirm, RateHistoryView, PolicyDrawer, PolicyDrawerEmpty, SetBrokerModal, ManualRateModal, ManualRateForm, _useFxState hook).
  - `FxManagementSection.tsx` (2,031 → 193) + 12 sibling files in `_fx_management/` (constants, atoms, useFxManagement hook, NewRateForm, NewPolicyForm + .parts, views/RatesView, views/PoliciesView + PoliciesTable, views/RevaluationsView, views/SetBrokerDialog + .parts).
  - `TemplatesPageClient.tsx` (1,999 → 221) + 18 sibling files in `_components/` (icons, types, EmptyState, AccountTreeNode, PostingRulesPanel, TemplateDetail, GalleryView, CompareView, PageChrome, importHandlers, migration/helpers + MigrationConstants + buildAutoMapping + MigrationStatsStrip + MigrationMappingRows + MigrationView + MigrationExecutionSection + MigrationExecutionView).
- **Pattern**: pure refactor — components kept their own hooks; data layer lifted into custom hooks (`useFxState`, `useFxManagement`); render leaves moved to sibling files; `'use client'` preserved everywhere; orchestrators import + compose; zero behavior, prop, hook-order, or JSX changes.
- **Verification**: `npx tsc --noEmit` exit 0 (zero errors, matches baseline). All 49 touched files (46 new + 3 orchestrators) ≤300 lines (max: 288).
- **Risk**: LOW (pure refactor, zero URL/route/prop changes — external callers `regional/client.tsx` and `templates/TemplatesGateway.tsx` unchanged)

### [DONE 2026-04-30] Maintainability Phase 3 — Cross-Module Import Violations
- **Discovered**: 2026-04-30
- **Impact**: All 127 direct cross-module imports remediated. Modules can now be disabled / swapped independently. Cross-module access is brokered through the ConnectorEngine (audit-logged, state-aware, fallback-on-miss).
- **Depends On**: Phase 1
- **Plan**: `task and plan/maintainability/maintainability_phase3_cross_module_imports_001.md`
- **Final breakdown** (per-module before → after):
  - HR (3 → 0). All routed via `connector.require('finance.accounts.get_model', ...)` and `connector.require('finance.services.get_ledger_service', ...)`. (DONE morning.)
  - CRM (12 → 0). Swapped to `connector.require(...)` across views, pricing serializers, compliance + contact serializers. (DONE morning.)
  - Workforce (2 → 0). Two test files keep direct `from apps.hr.models import …` imports as documented Pattern D test-fixture exceptions (test setUp runs before any org context exists).
  - client_portal (6 → 0). Views/serializers route through `connector.require(...)` for `finance.gateways.get_config_model`, `finance.gateways.get_stripe_service`, `inventory.products.get_model`. One Pattern D test-fixture import for `crm.Contact`.
  - Inventory (22 → 0). `services.py` (7 sites) + `views.py` (5) + `counting_views.py` (1) + `warehouse_views.py` (1) + `warehouse_models.py` (1) + `stock_matrix_views.py` (2) + `product_serializers.py` (2) + management commands (2) + tests (1 Pattern D). New capabilities: `finance.services.get_barcode_service`, `pos.registers.get_model`, `pos.procurement_requests.get_model`, `pos.purchase_orders.get_line_model`, `reference.country.get_model`, `reference.org_country.get_model`, `reference.org_currency.get_model`. New file: `apps/reference/connector_service.py`.
  - POS (43 → 0). `signals.py` (5) + views/{register_lobby,register_order,pos_views,sourcing_views,procurement_request_views} + services/{purchase,returns,pos}_service (FNE family + ConfigurationService import-typo fix) + services/procurement_notifications (Task/TaskComment) + returns_service + purchase_order_models + management commands. New capabilities: `finance.fne.{get_service,get_config_func,get_request_class,get_line_item_class,get_build_request_func}`, `finance.payments.get_payment_method_model`, `finance.tax_rules.get_custom_model`, `workspace.task_comment.get_model`, `inventory.services.get_product_completeness_service`. 7 documented Pattern D exceptions (1 viewset with 27 cross-uses, 2 test files, 1 management command).
  - Finance (44 → 0). `report_service.py` (registry build now uses connector for POS/Inventory/CRM/HR/Integrations) + `payment_service.py` (2 aging-report sites) + `events.py` (CRM Contact) + `services/{collections,closing_audit_subledger,close_checklist,tax_template}_service.py` + `views/{statement,currency,tax_policy,fiscal_period,financial_account,ledger}_views.py` + `stripe_gateway.py` + management commands. 2 `fire_auto_tasks` call-sites (close_checklist + fiscal_period_views) routed via `connector.execute('workspace.auto_tasks.fire', ...)`. 16 documented Pattern D exceptions (see below).
- **Connector capabilities registered (this session)**:
  - **finance**: `services.get_barcode_service`, `fne.get_service`, `fne.get_config_func`, `fne.get_request_class`, `fne.get_line_item_class`, `fne.get_build_request_func`, `payments.get_payment_method_model`, `tax_rules.get_custom_model`.
  - **pos**: `registers.get_model`, `procurement_requests.get_model`, `purchase_orders.get_line_model` (alias for the pre-existing `purchase_order_lines.get_model`).
  - **inventory**: `services.get_product_completeness_service`.
  - **workspace**: `task_comment.get_model`.
  - **hr**: `departments.get_model`.
  - **reference** (new file `apps/reference/connector_service.py`): `country.get_model`, `org_country.get_model`, `org_currency.get_model`.
- **Pattern D exceptions (documented; remaining direct cross-module imports — all justified)**:
  - `apps/finance/models/__init__.py:57,61,65` — re-exports `GiftSampleEvent` / `InternalConsumptionEvent` / `ImportDeclaration` from inventory + pos at finance-app-load time. Required by tax_engine_ext_serializers `Meta.model = ...` resolution. Now wrapped in `try/except ImportError` so disabling a source module no longer crashes finance.
  - `apps/finance/serializers/tax_engine_ext_serializers.py:20-22` — same three classes feed `Meta.model = ...` at DRF class-creation time.
  - `apps/finance/views/tax_engine_ext_views.py:22-24` — same three classes feed `queryset = Model.objects.all()` at class-creation time.
  - `apps/finance/report_service.py:74,78,92,99` — Unit, StockAlert, Attendance, Leave, ExternalOrderMapping, ExternalProductMapping have no connector capabilities yet (low-traffic legacy paths). Direct gated import inside `try/except ImportError`.
  - `apps/finance/management/commands/{fire_period_reminders,seed_fiscal_period_rules}.py` — AutoTaskRule and TaskTemplate have no connector capabilities yet. Management commands run post-Django-setup so eager imports are fine.
  - `apps/finance/tests/test_golden_pipe.py:12` — test-fixture Contact at module-collection time.
  - `apps/pos/views/invoice_verification_views.py:30,35` — Invoice/InvoiceLine/GoodsReceipt/GoodsReceiptLine, used 27× across the file; the entire viewset is dedicated to 3-way matching, so missing finance/inventory means the file itself is meaningless.
  - `apps/pos/tests/test_pos_integrity.py:19`, `apps/pos/tests/test_reissue_signal.py:22-23` — test fixtures.
  - `apps/pos/management/commands/smoke_test_reissue.py:33-34` — management command.
  - `apps/inventory/tests/test_auto_linkage.py:5` — test fixture.
  - `apps/workforce/tests/test_tenant_isolation.py:18`, `apps/workforce/tests/test_workforce_score_engine.py:20` — test fixtures.
  - `apps/client_portal/tests/test_wallet_config.py:12` — test fixture.
- **Verification**:
  - `manage.py check` passes (1 baseline warning, 0 errors).
  - HR: 20/20 pass.
  - CRM: 24/26 pass (1 pre-existing failure + 1 pre-existing error in `test_loyalty_service.py`, unchanged).
  - client_portal: 19/19 pass.
  - inventory: pre-existing setUp errors (Warehouse must have country) match baseline; `test_auto_linkage` 4/4 pass after Pattern D revert.
  - pos: pre-existing 4 setUp errors in `test_pos_integrity` (Warehouse fixture; matches baseline); other 13 tests run.
  - finance: `test_revaluation_service` 26/26 pass; pre-existing 29 setUp errors match baseline (Warehouse country fixture; legacy missing model imports for BankAccount / DepreciationScheduleEntry / Loan); 4 pre-existing assertion-text mismatches.
  - workforce test files have a pre-existing Python SyntaxError unrelated to the connector swap (`def test_score_rules_isolated_by.organization` — typo in test method name; lines 92 and 270, neither on the lines I edited).
  - Per-module cross-module-import grep returns 0 (excluding documented `noqa: E402`/`F401` Pattern D exceptions and false-positive docstring matches in `accounting_poster.py:18` + `address_book_executor.py:11`).
- **Risk**: LOW (capability swap is behavior-preserving; no Meta.model resolution changed; tests with new errors all pre-existed)

### [DONE 2026-04-30] Maintainability Phase 4 — Models Without Tenant Isolation
- **Discovered**: 2026-04-30
- **Impact**: Audited 10 models flagged in the original WORKMAP. 4 migrated to `TenantModel`, 5 confirmed system-level (intentional KEEP), 1 deferred (`UploadSession` needs split-by-type design).
- **Plan**: `task and plan/maintainability/maintainability_phase4_tenant_isolation_001.md`
- **Migrated** (now inherit `TenantModel`):
  - `GeneratedDocument` (apps.pos)
  - `POSAuditRule` (apps.pos)
  - `POSAuditEvent` (apps.pos)
  - `SalesAuditLog` (apps.pos)
  - **Migration**: `apps/pos/migrations/0080_tenant_isolation_audit_models.py` — 4 `AlterField` ops adding `db_column='organization_id'` (the columns already had that name; this aligns Django state with the DB). **Zero data changes, zero column renames, no backfill required.**
- **Confirmed system-level (KEEP)**: `Currency` (ISO 4217 catalog), `PackageUpload` (platform deployment artifact), `StorageProvider` (null-org = platform default with tenant fallback), `MigrationMapping` (apps.migration), `MigrationMapping` (apps.migration_v2 — both are child tables tenanted via parent FK).
- **Deferred**: `UploadSession` — handles two flows (file upload vs package upload); needs split-by-type refactor before tenancy decision.
- **Verification**: `manage.py check` passes (1 baseline warning); `manage.py migrate --plan` correctly shows the new migration as pending.
- **Note**: A pre-existing finance migration conflict (`0076_backfill_monetary_classification` vs `0078_payment_gateway_catalog`) is unrelated to Phase 4; needs `makemigrations --merge` from finance owner.

### [PARTIAL DONE 2026-04-30] Maintainability Phase 5 — Frontend Type Safety
- **Discovered**: 2026-04-30
- **Impact (cumulative across two sessions)**: Repo-wide `any` count: 2,812 → **2,397** (−415 net). Session 1 cleared `src/types/erp.ts` (-93). Session 2 cleared 24 high-density consumer files outside Phase-6 active subdirs (-322 additional).
- **Plan**: `task and plan/maintainability/maintainability_phase5_type_safety_001.md`
- **Session 1 (2026-04-30, earlier)**: `src/types/erp.ts` 94 → 0; replaced index sigs with `unknown`; enriched 13 SaaS interfaces; added 7 helper interfaces.
- **Session 2 (2026-04-30, this batch)** — files cleared in safe subdirs (`src/lib`, `src/components`, `src/hooks`, `(privileged)/finance/`, `(privileged)/(saas)/`, `(privileged)/settings/`):
  - Top hotspots: `regional/client.tsx` (19 → 4), `usePOSTerminal.ts` (18 → 0), `tax-policy/page.tsx` (17 → 0), `MobileCOAClient.tsx` (17 → 0), `org-tax-policies/[id]/page.tsx` (13 → 0), `ledger/import/page.tsx` (13 → 0), `Sidebar.tsx` (12 → 0), `UnifiedReassignmentTable.tsx` (11 → 0), `country-tax-templates/editor.tsx` (11 → 0), `invoices/page.tsx` (11 → 0), `counterparty-tax-profiles/[id]/page.tsx` (13 → 0), `CompareModal.tsx` (10 → 0), `paFields.tsx`+`paHandlers.ts`+`PASettingsContext.tsx`+`page.tsx` (purchase-analytics, 31 → 6 with eslint-disable on val/valWeight).
  - Mid-tier: `useFiscalYears.ts` (9 → 0), `VerificationContext.tsx` (8 → 0), `useTerminal.ts` (8 → 0), `audit-trail/page.tsx` (8 → 0), `CategoryFormModal.tsx` (8 → 0), `master-page-config.ts` (7 → 0), `payment-gateways/client.tsx` (7 → 0), `vat-settlement/page.tsx` (7 → 0), `opening-balances/manager.tsx` (7 → 0), `ledger/manager.tsx` (7 → 0), `MobileAccountRow.tsx` (7 → 0), `budgets/[id]/page.tsx` (7 → 3 eslint-disabled).
  - Library: `country-tax-templates/types.ts` (6 → 3), `db.ts` (kept index sig as `any` so consumers compile), `sequences.ts` (4 → 0), `catalogue-languages.ts` (4 → 0), `LayoutShellGateway.tsx` (5 → 0), `AppThemeProvider.tsx` (5 → 0), `design-system-framework.ts` (5 → 0), `connector/policies/page.tsx` (5 → 0), `setup/wizard.tsx` (5 → 0), `cash-flow/page.tsx` (5 → 3 eslint-disabled), `TenantQuickLogin.tsx` (4 → 1 documented), `task-reminder-popup.tsx` (4 → 0), `useDajingoPageState.ts` (4 → 2 documented).
  - Also: added missing `RTL_LOCALES` export in `src/translations/dictionaries.ts` (parallel-agent edit had introduced a broken import in `use-translation.ts`).
- **Strategy**: Wherever shape is genuinely dynamic (catch blocks, polymorphic pickers across 3 axes, server-shape unions), used `unknown` + narrow at point of use, or kept narrow `any` with explicit eslint-disable comment + reason. Defined per-file shape interfaces for backend payloads (TaxPolicy, COAAccount, FiscalPeriod, OpeningEntry, PaymentLeg, etc.). Replaced `catch (e: any)` with `catch (e: unknown)` + `instanceof Error` guard in 30+ sites. Replaced `(item: any) =>` in `.map`/`.filter` callbacks with proper item shapes when the array element type was inferable.
- **Verification**: `npx tsc --noEmit` exit 0 throughout (every batch). Zero `// @ts-ignore`, zero `// @ts-expect-error`. The remaining `any`s in cleaned files are all behind eslint-disable comments with reasons (polymorphic shapes, action-state unions, prisma stub).
- **Remaining**: ~2,397 `any`s across the rest of the frontend. Phase-6 active subdirs (`inventory/`, `sales/`, `purchases/`, `workspace/`, `hr/`, `crm/`) were strictly avoided to prevent edit conflicts. The next slice should target POS layout files (currently `@ts-nocheck`-shielded, ~110 `any`s if the nocheck is dropped) and the Phase-6 subdirs once their color sweep finishes.

### [PARTIAL DONE 2026-05-01] Maintainability Phase 6 — Hardcoded Color Sweep
- **Discovered**: 2026-04-30
- **Impact**: 13 subdirs migrated across 6 sessions. Session 1: `(privileged)/finance/` (756 → 347, −409, 87 files). Session 2: `(privileged)/inventory/` (720 → 220 text/bg/border, −500, 73 files) + `(privileged)/sales/` (414 → 156, −258, 24 files). Session 3: `(privileged)/workspace/` (395 → 92, −303, 28 files) + `(privileged)/hr/` (306 → 64, −242, 19 files) + `(privileged)/crm/` (293 → 104, −189, 13 files) + `(privileged)/purchases/` (469 → 113, −356, 18 files). Session 4 (2026-05-01): `(privileged)/settings/` (132 → 33, −99, 24 files) + `(privileged)/migration_v2/` (98 → 23, −75, 6 files) + `(auth)/register/` (105 → 58, −47, 2 files) + **`(privileged)/(saas)/` (412 → 30, −382 of which −387 are text/bg/border, 30 files; new `--app-accent` violet token family added to `globals.css` to unblock non-brand purple/indigo CTAs)**. Session 5 (2026-05-01): **`supplier-portal/[slug]/` (309 → 59, −250, 9 files; intentional dark-theme portal preserved)**. Session 6 (2026-05-01, this batch): **`tenant/[slug]/` (366 → 39, −327, 22 files; dark customer portal — bulk perl 3-pass sweep covering surfaces, status semantics, accent semantics, full-color borders, slate-* dark surfaces)**. **Combined: 355 files migrated, 3,437 hardcoded colors removed.**
- **Plan**: `task and plan/maintainability/maintainability_phase6_color_sweep_001.md`
- **Theme system mapped**: Tailwind v4 `@theme` block in `src/app/globals.css` defines `app-*` semantic tokens (`bg-app-{bg,surface,surface-2}`, `text-app-{foreground,muted-foreground,faint}`, `border-app-{border,border-strong}`, status families `app-{success,warning,error,info}-bg`, brand `app-primary{,-dark,-light}`, **and `app-accent{,-bg,-bg-soft,-border,-strong}` (violet-500 family) for non-brand category accents — added Session 4 (saas)**).
- **Migration mapping** (representative): `bg-emerald-100 text-emerald-700 border-emerald-200` → `bg-app-success-bg text-app-success border-app-success`; `text-blue-800` → `text-app-info`; `text-rose-700` → `text-app-error`; status configs (`POSTED`/`CANCELLED`/`OPEN`/`LOCKED`) mapped to semantic tokens. Brand emerald solids on CTAs (`bg-emerald-500/600/700`) map to `bg-app-primary{,-dark}`. **Indigo/purple/violet/pink/fuchsia → `bg-app-accent{,-bg}` / `text-app-accent` / `border-app-accent`** (Session 4).
- **Per-subdir per-pattern (this 2026-04-30 session)**:
  - inventory: text −282, bg −147, border −71 (720 → 220 across the three patterns)
  - sales: text −168, bg −79, border −11 (414 → 156)
  - workspace: text −130, bg −98, border −75 (395 → 92, −77%)
  - hr: text −91, bg −90, border −58 (306 → 64, −79%)
  - crm: text −108, bg −76, border −19 (293 → 104, −65%)
  - purchases: text −172, bg −135, border −50 (469 → 113, −76%)
- **Per-subdir per-pattern (Session 4, 2026-05-01)**:
  - settings: text −89, bg −40, border −23 (132 → 33, −75%) — 24 files; remaining = 11 violet/purple decorative + 2 cyan/teal + 5 `dark:*-900/30` overlays + 6 intentional `bg-slate-900/800/600` (security UI dark surfaces) + a handful of opacity-modified rings/gradients without app tokens.
  - migration_v2: text −56, bg −28, border −12 (98 → 23, −77%) — 6 files; remaining = 12 purple decorative (intentional RUNNING-status purple + step-card decorative `bg-purple-50/600/700`) + 15 `dark:*-900/30` overlays + 3 cyan accent.
  - register: text −59, bg −13, border −9 (105 → 58, −45%) — 2 files; remaining is mostly the **intentional dark theme** of the (auth)/register pages (35 `bg-slate-900[/50]` deliberate dark surfaces) + 21 cyan brand accents (registration page's brand color, not Tailwind cyan as decoration). These are by design, not Phase 6 targets.
  - **(saas): text −271 (271→0), bg −206 (207→1), border −131 (134→3), ring −14 (14→0)** (412 → 30, −93% of in-scope; remaining 30 = 4 intentional dark-preview chrome `bg-[#0F172A] border-gray-800` + `bg-red-950/20` in `modules/page.tsx` + 26 decorative `from-/to-/via-` gradients deferred per plan). 30 files (all hardcoded-color holders) modified, 400 insertions / 400 deletions (1:1 atomic class swaps via two perl passes).
- **Per-subdir per-pattern (Session 5, 2026-05-01)**:
  - **supplier-portal: text −148 (148→0), bg −50 (101→51), border −52 (52→0)** (309 → 59, −81% of in-scope; remaining 59 = 51 opacity-modified `bg-slate-900/40-80`/`bg-slate-950/30-80`/`bg-red-500/10`/`bg-purple-500/10` etc. **intentional dark-theme glass surfaces** + 2 `ring-indigo-500/5` opacity-modified rings + 6 gradient stops `from-/to-emerald-600/20`/`from-/to-blue-600/20`/`from-/to-amber-600/20` deferred per plan). 9 files modified, 51 insertions / 51 deletions (1:1 atomic class swaps via three perl passes — Pass 1 text shades + status -50/100/200 + accent -50/100/200, Pass 2 brand emerald solids, Pass 3 solid status/accent CTA backgrounds; followed by a placeholder-text-color repair sweep where `placeholder:text-app-foreground` was rolled back to `placeholder:text-app-faint` since the original `placeholder:text-slate-700` had been a deliberately faint dark-on-dark hint).
- **Per-subdir per-pattern (Session 6, 2026-05-01)**:
  - **tenant: 366 → 39 (−327, −89%)** — 22 files modified. Bulk 3-pass perl sweep covered: (a) surfaces — `bg-[#020617]` → `bg-app-bg`, `bg-slate-{900,800,950}{,/40-80}` → `bg-app-{surface,surface-2,bg}{,/40-80}`; (b) status semantics — `text-{emerald,red,rose,amber,blue,purple,violet,indigo,fuchsia,pink}-{300,400,500,600,700}` → `text-app-{success,error,warning,info,accent}`, `bg-{status}-500/N` and `border-{status}-500/N` → `bg-app-{status}/N` etc., light surfaces `bg-{status}-{50,100}` and `border-{status}-200` → `bg-app-{status}-bg`/`border-app-{status}`; (c) text/borders — `text-slate-{200,300,400,500,600,700}`+`gray-{400-900}` → `text-app-{foreground,muted-foreground,faint}`, `border-slate-{100,200,300}` → `border-app-{border,border-strong}`; (d) brand CTAs — `bg-emerald-{500,600}` → `bg-app-primary{,-dark}`, `bg-{purple,violet,indigo}-600` → `bg-app-accent-strong`; (e) full-color status borders + focus borders → semantic equivalents. **Top-10 hotspots**: `account/orders/[id]/page.tsx` (53→3), `account/page.tsx` (47→2), `account/wallet/page.tsx` (37→7), `account/profile/page.tsx` (31→1), `register/page.tsx` (27→7), `quote/page.tsx` (27→12), `account/tickets/page.tsx` (24→0), `account/notifications/page.tsx` (23→0), `account/orders/page.tsx` (19→0), `account/wishlist/page.tsx` (18→0). **Residual breakdown by category** (39 total):
    - `quote/page.tsx` (12): teal-{400,500,600,900} portal-specific brand color (12 occurrences) — SKIP per rules.
    - `register/page.tsx` (7): 5 `focus:ring-emerald-500/5` opacity-modified rings + 2 `shadow-emerald-900/40` custom shadow colors — SKIP per rules.
    - `account/wallet/page.tsx` (7): 5 tier-definition decorative brand colors (`from-amber-800 to-amber-900`/`bg-yellow-500`/`bg-cyan-500`/`bg-violet-500`/`bg-slate-400` — each tier has unique brand color) + 2 gradient `from-/to-{purple,amber}-600/20` decorative balance cards — SKIP per rules.
    - `OrgNotFoundPage.tsx` (4): all gradients/shadows (`from-emerald-500/[0.03]`, `shadow-amber-500/40`, `shadow-emerald-500/{10,25}`) — SKIP per rules.
    - `not-found.tsx` (4): all gradients/shadows (matching pattern) — SKIP per rules.
    - `LandingHomePage.tsx` (2): 1 hero-text gradient `from-indigo-600 to-violet-600` + 1 `shadow-indigo-200/50` button shadow — SKIP per rules.
    - `account/page.tsx` (2): cyan-500 portal-specific brand on Notifications nav tile — SKIP per rules.
    - `account/profile/page.tsx` (1): `bg-cyan-500/10` decorative blur glow — SKIP per rules.
- **Verification**: `npx tsc --noEmit` clean baseline before sweep, 0 new errors after Sessions 3, 4, 5, and 6. Sweep itself is byte-symmetric: pure class-name swaps.
- **Skipped**: 5 finance files in Session 1 (parallel agents). Sessions 2–6 had no scope conflicts.
- **Precursors documented**: missing `ring-app-error`, **`--app-accent` precursor RESOLVED Session 4** (added violet-500 family `--color-app-accent{,-bg,-bg-soft,-border,-strong}` to `globals.css` — all subdirs from now on can use `bg-app-accent`/`text-app-accent`/`border-app-accent` for indigo/purple/violet/pink/fuchsia uses). Missing `--app-accent` cyan variant for the `(auth)/register` AND `tenant/[slug]/quote` AND `tenant/[slug]/account/page` cyan/teal brand palette still pending (could be added similarly). Missing gradient tokens (442 `from-/to-` occurrences across all subdirs), 2,901 hex/rgb literals in inline styles need a separate phase. **Aware tokens for opacity-modified colors** (`bg-slate-900/60`, `bg-red-500/10`, etc.) would unblock the dark-glass surfaces in supplier-portal — currently left as-is per skip rules.
- **Remaining**: ~400 hardcoded colors in subdirs `(privileged)/products` (95), `(privileged)/delivery` (81), `(privileged)/ecommerce`, plus other smaller subdirs. Estimated 2–3 hours.

---

## 🟠 HIGH

### [DONE 2026-04-15] Finance Module — Subscription Ledger Integration (v2.9.0-b003)
- **Discovered**: 2026-02-09
- **Impact**: ConnectorEngine finance hooks silently fail, no ledger entries created for plan changes
- **Fix**: Fixed event name mismatch (subscription:updated vs subscription:renewed), implemented real journal entry handler in finance/events.py, linked SubscriptionPayment.journal_entry_id

### [DONE 2026-04-15] CRM Contact Balance Now Synced (v2.9.0-b003)
- **Discovered**: 2026-02-09
- **Impact**: CRM contacts show $0.00 balance even after subscription payments
- **Fix**: Root cause was missing journal entries (see above). Now that JEs are created with contact_id on AR lines, CRM summary endpoint computes correct balances.
- **Depends On**: Finance module integration (now complete)

---

## 🟡 MEDIUM

### [DONE 2026-04-27] Purchases sweep + purchase-analytics redesign
- **Discovered**: 2026-04-27 (user requested registry consolidation, audit, redesign)
- **Impact**: Bare `/purchases` registry duplicated `/purchases/purchase-orders`; `/purchases/new-order` was redundant with `/purchases/new`; PO detail page only knew the legacy `Order` endpoint not the new `PurchaseOrder` one (404s for new POs); `/finance/invoices/new` was a dead 404 link in 3 files; `/purchases/new` form physically couldn't submit (missing `supplierId`/`warehouseId`/`unitCostTTC` despite Zod requiring them); `/settings/purchase-analytics` was a 1913-line single-page form with poor IA.
- **Files**: `src/app/(privileged)/purchases/{page,purchase-orders/page-client,purchase-orders/_components,purchase-orders/_lib,[id]/page,new/form,new/_components,new/_lib}.tsx` + `settings/purchase-analytics/{page,_components,_components/sections,_hooks,_lib}.tsx` + sidebar `commercial.ts` + `pv/PvSwitcher.tsx` + `finance/ledger/_components/NewEntryDropdown.tsx`.
- **Fix**:
  - `/purchases` → 5-line redirect; old `PurchasesRegistryClient` archived. Keeper got SSR + currency + Sourcing/Dashboard actions + Incoming KPI.
  - `/purchases/new-order/` + `/purchases/restored/` archived; sidebar + actions repointed to `/purchases/new`.
  - PO detail page now tries `purchase-orders/{id}/` first → falls back to `purchase/{id}/` → normalizes new-shape fields → hides legacy action forms when source is new.
  - 4 `/finance/invoices/new` references repointed to live invoice list pages.
  - `/purchases/new` form: built `MetadataStrip` (Supplier/Site/Warehouse pickers using already-passed-but-unused props), added missing hidden inputs, gated submit on full metadata. Form 512→199 lines.
  - `purchase-orders/page-client.tsx` 523→282 (extracted InlineStatusCell, POExpandedRow, render-cell helpers).
  - 3 dead-code archives: `page-old-mock.tsx` (431), `ReceivingWorkspaceClient.tsx` (823), `PORow.tsx`.
  - `/settings/purchase-analytics` redesigned to two-pane "Settings OS" layout (1913→294 lines): left section nav, right active section, bottom InspectorStrip, top HeaderBar with always-visible Health/Completeness/Warning chips, MidStrip consolidating banners + presets + actions. State extracted to 2 helper hooks; sections share via Context. 25 active files, all ≤294 lines.
- **Follow-up MEDIUM** (added below): `/purchases/new` `?edit=` support, `/purchases/invoices` `?from_po=` support, pre-existing oversize PO sub-flow files (7 files 319-1035 lines).

### [OPEN] `/purchases/new` doesn't honor `?edit=` query
- **Discovered**: 2026-04-27
- **Impact**: "Open Order" / Edit links navigate to `/purchases/new?edit=${po.id}` but the page ignores the param and shows a blank create form. (Current keeper navigates to detail page instead, so this isn't critical, but the form route can't currently edit.)
- **Files**: `src/app/(privileged)/purchases/new/page.tsx` + `form.tsx`.
- **Notes**: Needs (a) `searchParams.edit` reader, (b) SSR fetch of `purchase-orders/${edit}/`, (c) prefill props through `PurchaseForm`. Form would also need a "save changes" branch on `createPurchaseInvoice` action (today only creates).

### [OPEN] `/purchases/invoices` doesn't honor `?from_po=` query
- **Discovered**: 2026-04-27
- **Impact**: PO list "Purchase Invoice" menu/expanded action navigates to `/purchases/invoices?from_po=${po.id}` (or just bare). The list page doesn't pre-populate or scroll to the source PO. Honest URL but missing a "create invoice from PO" flow.
- **Files**: `src/app/(privileged)/purchases/invoices/page-client.tsx`.

### [OPEN] Pre-existing oversize files in PO sub-flows (code-quality.md violations)
- **Discovered**: 2026-04-27
- **Impact**: 7 files exceed the 300-line hard limit; 5 are over the 401+ "mandatory refactor" threshold. The `code-quality.md` rule kicks in when any of them is *modified*; until then it's tech debt.
- **Files**:
  - `receiving/ReceivingScreen.tsx` (1035) — Receiving flow
  - `new-order-v2/form.tsx` (777) — alternate New Order form (still on sidebar)
  - `verification/page.tsx` (493) — verification root
  - `invoice-verification/page.tsx` (441) — invoice verification root
  - `invoice-verification/panels/ComparisonPanel.tsx` (398)
  - `invoicing/InvoicingScreen.tsx` (388)
  - `invoice-verification/panels/ActionsPanel.tsx` (319)
- **Notes**: Each lives in a flow not directly touched in the 2026-04-27 sweep. Refactor as part of the next functional change to that flow rather than as a drive-by.

### [PHASE 1+2+3 DONE 2026-04-27] Procurement Request flow on product list
- **Discovered**: 2026-04-27 (user reported dead `/procurement/purchase-orders/new` route)
- **Impact**: Eight "Request Purchase / Transfer" buttons on the inventory products UI either hit a catch-all "Module Page Under Construction" placeholder or jumped to a blank PO form. Users couldn't actually request stock from the product list.
- **Plan**: `task and plan/inventory_procurement_request_001.md`
- **Phase 1 fix**: Shared `RequestProductDialog`, 8 buttons rewired, `createProcurementRequest` snake_case bug fixed, `request_flow_mode` setting added.
- **Phase 2 fix**: Derived `procurement_status` SerializerMethodField on `Product` (no migration). Combined with stock tier in the product list as e.g. `Low Stock · Requested`. Lifecycle follows `ProcurementRequest` → linked `PurchaseOrder` state through `PO_SENT → IN_TRANSIT → done | FAILED`. Direct-PO fallback when no recent request. REJECTED → FAILED.
- **Phase 2.5 fix**: Backend `suggest-quantity` endpoint (`avg_daily × lead × safety` from `PurchaseAnalyticsConfig`). Backend `convert-to-po` action (creates draft `PurchaseOrder` + line, links `source_po`, flips request to EXECUTED). Dialog uses honest formula. Frontend "Create PO" button on APPROVED PURCHASE rows.
- **Phase 3 fix**: `RequestFlowProvider` mounted around the products manager. INSTANT (one-click), DIALOG (popup), CART (sticky tray) — switchable from `/settings/purchase-analytics`. Cart persists to localStorage. Mobile-safe tray. Settings toggle saves inline.
- **Procurement Requests page rebuild**: Old 560-line `OperationalRequest`-based page archived. New 213-line page following Dajingo Pro design language. Approve / Reject / Execute / Cancel / **Create PO** lifecycle actions per row.
- **Deferred**: Notifications (needs `NotificationTemplate` setup), permission gating (needs broader RBAC audit — `@require_permission` not used elsewhere in `apps/pos`/`apps/inventory`), backend tests, mobile-specific product list audit.

### [DONE 2026-04-19] Fiscal Years — silent-bug audit + modal escape + rollback
- **Discovered**: 2026-04-19 (user reported being unable to escape a modal and suspecting silent bugs)
- **Impact**: Four bespoke modals on `/finance/fiscal-years` (Wizard, Draft Audit, Year-End Close, Period Editor) had no Escape-key / backdrop-click dismissal — users could only close via the X icon. `applyPeriodStatus` always toast-success'd regardless of whether the server accepted the change (swallowed errors in a generic `catch {}` with the excuse "PATCH may return 500 due to audit log conflict"). `refreshData` silently swallowed all errors. Generic "Failed" toast on close-preview. `closingYearId` leaked if close-preview fetch rejected.
- **Files**: `src/hooks/useModalDismiss.ts` (new, 43 lines), `src/app/(privileged)/finance/fiscal-years/viewer.tsx`, `src/app/(privileged)/finance/fiscal-years/period-editor.tsx`.
- **Fix**:
  - New reusable `useModalDismiss(open, onClose)` hook — installs an Escape-key listener when `open` is true, returns `backdropProps` and `contentProps` spreadable onto the outer/inner modal divs so backdrop-click dismisses without the inner div bubbling up.
  - Wired into all 4 bespoke modals in `fiscal-years`.
  - `applyPeriodStatus` now snapshots previous status + `is_closed`, rolls the optimistic update back on server failure, surfaces the real error via `toast.error`. `refreshData()` is now awaited after success so local state tracks server truth.
  - `refreshData` surfaces refresh failures via `toast.error` instead of a silent `/* silent */` catch.
  - Generic "Failed" toast on close-preview replaced with a specific error surfacing the underlying exception; `closingYearId` cleared on preview failure to prevent stuck "close in progress" indicator.
- **Follow-up**: New LOW items added below for (a) broken `[id]/page.tsx` stub with 404 Edit link, (b) broken `new/page.tsx` placeholder (empty form), (c) dead `wizard.tsx` + `year-card.tsx` (not imported anywhere), (d) `viewer.tsx` at 1363 lines (over the 300-line code-quality limit).

### [DONE 2026-04-20] Guided-tour button on Chart of Accounts + reusable `<PageTour>` wrapper
- **Discovered**: 2026-04-20
- **Impact**: Users on `/finance/chart-of-accounts` had no onboarding walkthrough. `/inventory/units` had a tour button (rendered by TreeMasterPage) but it was dead — no registered definition and no mounted renderer.
- **Files**: `src/components/ui/PageTour.tsx` (new), `src/lib/tours/definitions/finance-chart-of-accounts.ts` (new, 12 steps), `src/lib/tours/definitions/inventory-units.ts` (new, 14 steps), `src/app/(privileged)/finance/chart-of-accounts/viewer.tsx`, `src/app/(privileged)/inventory/units/UnitsClient.tsx`.
- **Fix**: Factored the existing `TourTriggerButton` + `<GuidedTour>` into a single `<PageTour>` component. Supports `renderButton={false}` for pages whose template already renders the trigger. Dropped it into COA's header and fixed Units by wiring step actions + mounting the renderer. COA gets 12 passive steps; Units mirrors Categories with 6 programmatic step actions (expand tree / open sidebar on first base unit / switch tabs / close).
- **Follow-up**: Browser smoke-test pending (no dev server in this env). Mobile tours not implemented — see new LOW item below.

### [DONE 2026-04-18] Plan Switch UI Refresh
- **Discovered**: 2026-02-09
- **Impact**: After confirming plan switch, usage/billing data may not visually update without page refresh
- **Files**: `src/app/(privileged)/(saas)/organizations/[id]/page.tsx`
- **Fix**: Plan switch handler refetches sequentially (usage then billing), retries billing once after 600 ms if history count hasn't grown (handles async journal-entry event handler), and calls `router.refresh()` to invalidate server-cached data.

### [DONE 2026-04-18] Direct CRM Profile Link
- **Discovered**: 2026-02-09
- **Impact**: "View CRM Profile" button navigates to search instead of direct contact record
- **Files**: `src/app/(privileged)/(saas)/organizations/[id]/page.tsx`
- **Fix**: Backend already resolves `crm_contact_id` in the billing endpoint (`views_saas_org_billing.py:344-365`). Frontend button now uses it when present (`/crm/contacts/${crm_contact_id}`) with email-search fallback when the contact isn't resolvable.

### [DONE 2026-04-19] Refactor `Sidebar.tsx` — 1362 → 264 lines
- **Discovered**: 2026-04-19 (during architectural critique discussion, not pre-existing WORKMAP item)
- **Impact**: Violated `code-quality.md` hard limit (≥300 lines, 4.5× over). Original critique framed this as "fully dynamic nav binding" migration; that was overscoped. Actual issue was file size.
- **Files**: `src/components/admin/Sidebar.tsx` (1362 → 264) + new `_lib/`, `_components/`, `_hooks/` siblings.
- **Plan**: `task and plan/kernel_sidebar_extraction_001.md`
- **Fix**: Extracted `ICON_MAP` + `parseDynamicItems` to `_lib/`, split `MENU_ITEMS` into 9 per-module data files + barrel (`_lib/menu/`), extracted `MenuItem` + `FavoritesPanel` sub-components and `useSidebar` hook. Kept hybrid nav architecture — kernel routes remain frontend-owned, [views_saas_modules.py:306-310](../erp_backend/erp/views_saas_modules.py#L306-L310) guard untouched. All 7 `MENU_ITEMS` importers continue to resolve via barrel re-export from `Sidebar.tsx`. 390 paths + 440 titles verified identical between old/new.
- **Follow-up**: Browser smoke-test pending (no dev server in this env). Not committed yet — single commit recommended.

### [DONE 2026-04-18] Refactor `organizations/[id]/page.tsx` — 1503 → 239 lines
- **Discovered**: 2026-04-18
- **Impact**: Violated `code-quality.md` rule (hard limit 300 lines, mandatory refactor over 400).
- **Files**: `src/app/(privileged)/(saas)/organizations/[id]/page.tsx` + new component & hook files.
- **Fix**: Completed in two passes on 2026-04-18.
  - **Pass 1** (commit `3040002a`, bundled with unrelated mobile work): wired up existing `_components/` (Overview, Billing, Addons tabs + OrgDialogs dialog set + UsageMeter/ModuleCard helpers). Pruned orphan state + handlers + dead imports. 1503 → 592 lines.
  - **Pass 2**: extracted 4 new tab components (`ModulesTab`, `UsersTab`, `SitesTab`, `UsageTab`) and a `useOrganizationDetail` hook that owns all data + mutation logic. page.tsx is now 239 lines of pure orchestration (header, tab-bar, tab wiring, dialog wiring). 592 → 239 lines.
- **Follow-up**: Not smoke-tested in a browser (no dev server in this env). Next agent should verify tab switching, dialog flows, plan switch race-condition retry, CRM profile direct-link. `_components/OrgDialogs.tsx` at 353 lines is over the 300-line limit; candidate for splitting into one file per dialog later.

### [DONE 2026-04-18] Module Dependency Resolution UI
- **Discovered**: 2026-02-05 (promoted to MEDIUM 2026-04-18)
- **Impact**: Admins couldn't see which modules depend on each other before disabling. Dep data lives per-manifest but had no visualization.
- **Plan**: `task and plan/kernel_module_dep_graph_ui_001.md`
- **Fix**:
  - Backend: new `@action(detail=False, methods=['get'], url_path='dependency-graph')` on `SaaSModuleViewSet` at `erp_backend/erp/views_saas_modules.py`. Reads `SystemModule.manifest.dependencies`, annotates with total install counts (and optionally per-org install status if `?organization_id=` is passed), flags `missing_dependencies` (references to codes not present in the registry).
  - Frontend: new page `/modules/dependencies` at `src/app/(privileged)/(saas)/modules/dependencies/page.tsx` (239 lines, under code-quality limit). Shows each module as a card with its direct Depends-on list and reverse Required-by list (computed client-side from edges). Click a code chip or "Focus" to highlight the node's full transitive-dependency + dependents subgraph (deps shown blue, dependents shown amber, unrelated dimmed).
  - Added "Dependencies" button to the existing modules page header linking to the new page.
- **Not implemented**: Interactive positional graph (react-flow / cytoscape). Plan suggested this; deferred to keep the implementation additive and zero-new-dependency. The card-and-chip view is functional and can be upgraded later.

### [DONE 2026-04-18] PWA Icon Missing
- **Discovered**: 2026-02-09
- **Impact**: Console warning about missing manifest icon at `/icons/icon-192.png`
- **Files**: `public/icons/`, `public/manifest.json`
- **Fix**: Stale item — both `icon-192.png` (597 B) and `icon-512.png` (1.9 KB) are present in `public/icons/` and referenced from `manifest.json`. No code change required; WORKMAP entry was out of date.

---

## 🟢 LOW

### [DONE 2026-04-19] Fiscal Years `/new` + `/[id]` broken scaffolds
- **Discovered**: 2026-04-19
- **Impact**: `new/page.tsx` had `<p>No form fields available</p>` and submitted `{}` — unusable. `[id]/page.tsx` dumped raw JSON and linked to a non-existent `/edit` route (404).
- **Fix**: Both archived to `ARCHIVE/src/app/(privileged)/finance/fiscal-years/{new,[id]}/page.tsx` per cleanup rule. No app code linked to them — confirmed by grep. The real creation flow stays inside the Wizard modal triggered from `viewer.tsx`.

### [DONE 2026-04-19] Dead fiscal-years components: `wizard.tsx` + `year-card.tsx`
- **Discovered**: 2026-04-19
- **Impact**: 226 + 258 = 484 lines never imported anywhere. Dead code.
- **Fix**: Archived to `ARCHIVE/src/app/(privileged)/finance/fiscal-years/` per cleanup rule.

### [DONE 2026-04-20] `fiscal-years/viewer.tsx` — 867 → 121 lines (fully compliant)
- **Discovered**: 2026-04-19
- **Impact**: Violated `code-quality.md` hard limit.
- **Progress 2026-04-19**: Extracted the 3 bespoke modals into `_components/` (WizardModal, DraftAuditModal, YearEndCloseModal). 1363 → 866 lines.
- **Fix 2026-04-20**: Full structural refactor. Extracted all state + business logic into `_hooks/useFiscalYears.ts` (294 lines). Extracted UI into 6 new components: `KpiStrip.tsx` (43), `Toolbar.tsx` (55), `YearPanel.tsx` (110), `PeriodsGrid.tsx` (45), `SummaryTab.tsx` (112), `HistoryTab.tsx` (60). Extracted pure helpers: `_lib/constants.ts` (9), `_lib/types.ts` (89), `_lib/wizard-defaults.ts` (62). `viewer.tsx` is now 121 lines of pure orchestration. All files under 300-line limit. `npx tsc --noEmit` passes clean.

### [OPEN] Mobile guided tours (COA + Units + Categories)
- **Discovered**: 2026-04-20
- **Impact**: Mobile pages (`MobileCOAClient.tsx`, `mobile/MobileUnitsClient.tsx`, mobile categories) have no `<PageTour>` and no `data-tour` markers. Mobile users can't replay the onboarding walkthrough that desktop users get.
- **Files**: `src/app/(privileged)/finance/chart-of-accounts/mobile/MobileCOAClient.tsx`, `src/app/(privileged)/inventory/units/mobile/MobileUnitsClient.tsx`, plus any mobile categories client.
- **Notes**: Mobile has different layouts (stacked cards, bottom sheets) so the tour script needs rewriting — selectors from the desktop tours won't line up. Consider a separate `finance-chart-of-accounts-mobile.ts` definition, or `data-tour-mobile` attributes targeted from a unified definition. `GuidedTour` tooltip width is already responsive (`calc(100vw - 32px)`), so the renderer itself doesn't need changes.

### [OPEN — Phase 1 blocked on staging env] Module Hot-Reload
- **Discovered**: 2026-02-05
- **Impact**: After `ModuleManager.upgrade/install_for_all/revoke_all`, gunicorn + Celery don't see the change until manually restarted.
- **Plan**: `task and plan/kernel_module_hot_reload_001.md` — **rewritten 2026-04-18** from placeholder to concrete plan. Code audit shows gunicorn already supports SIGHUP and `graceful_timeout=30s`; `INSTALLED_APPS` is static at startup and URL patterns are not dynamically re-registered.
- **Next step**: Phase 1 = SIGHUP trigger on module mutation + separate `reload_celery` command. **Blocked** on staging environment + operator sign-off on 10 s worker-recycle window per module change.

### [PHASE 0 DONE 2026-04-18 — Phase 1 blocked on staging] Kernel Rollback Functionality
- **Discovered**: 2026-02-05
- **Impact**: `KernelManager.apply_update` and `ModuleManager.upgrade` back up the filesystem but not the DB. Any migration in an update becomes un-rollbackable.
- **Plan**: `task and plan/kernel_rollback_001.md` — **rewritten 2026-04-18** with real file:line audit. Filesystem-level rollback already exists at `kernel_manager.py:144-151` and `module_manager.py:456-503`.
- **Fix (Phase 0, this session)**: pre-operation `pg_dump` via new `kernel.backup.snapshot_database(label)` helper, wired into both `apply_update` and `upgrade`. Strictly additive — fails soft when `pg_dump` is missing or disabled via `KERNEL_DB_SNAPSHOT_ENABLED` flag. Snapshot path recorded in `SystemUpdate.metadata.db_snapshot`. `postgresql-client` added to `Dockerfile.backend.prod` so `pg_dump` is available in production.
- **Next step**: Phase 1 = operator rollback UI (`/saas/kernel/rollback` page) + `pg_restore` orchestration. **Blocked** on staging environment with production-scale data for rehearsal drill.

---

## ✅ COMPLETED

### [DONE 2026-04-20] Purchase Order Intelligence Grid
- **Discovered**: 2026-04-20
- **Impact**: UI overhaul of `purchases/new/` mapping to '11-zone Intelligence Grid' mock.
- **Fix**: Flattened the bulky configuration headers. Transformed the `form.tsx` line-items table to a 13-column dashboard matching the TSFSYSTEM V3 specification layout perfectly. Created the floating sticky action bar.
- **Discovered**: 2026-04-19
- **Impact**: AI Assistant Chat module was a "Coming Soon" placeholder
- **Fix**: Replaced generic Conversations Detail page with a fully interactive Chat UI. Supports parallel fetching of metadata and messages, real-time message posting to `MCPChatView`, optimistic updates, and displays tool call history inline.

### [DONE 2026-02-09] Business Registration Endpoint (v2.7.0-b010)
- Created `auth/register/business/` public endpoint
- Provisions org + admin user + SaaSClient + CRM contact
- Fixed Role model missing fields: `is_public_requestable`, `created_at`, `updated_at`

### [DONE 2026-02-09] SaaSClient → CRM Contact Sync (v2.7.0-b004)
- Added `sync_to_crm_contact()` to SaaSClient model
- Backfilled 3 existing clients
- Auto-syncs on client create and org provisioning

### [DONE 2026-02-09] Billing Tab Enhancements (v2.7.0-b003)
- Account Owner card with client details
- Balance summary (paid/credits/net)
- CRM profile link

### [DONE 2026-02-09] Plan Switch 500 Fix (v2.7.0-b006)
- Added missing `billing_cycle` field to SubscriptionPayment model

### [DONE 2026-02-09] Subscription Plan Badge on Org Cards (v2.7.0-b005)
- Purple badge showing current plan name on org list cards

### [DONE 2026-04-15] Warehouse Stability & Stats Footer (v2.9.0-b002)
- Resolved `ProgrammingError` in `/api/inventory/` by applying migration `0053_product_tax_rate_category`.
- Implemented COA-style glassmorphism footer in `WarehouseClient.tsx` with location and SKU stats.
- Added dynamic filter/search clear actions to the hierarchy footer.

### [DONE 2026-04-15] POS Register Data Integrity Guards (v2.9.0-b003)
- Added `get_stock_warehouse` property to POSRegister model (warehouse → branch fallback)
- Hardened `verify-manager` with optional `register_id` site-scoping
- Fixed Sidebar favorites React key warning and FavoritesContext stale data sanitization

### [DONE 2026-02-09] Hydration Mismatch Fixes (v2.7.0-b004, b008)
- CRM contacts: `toLocaleString` → `toFixed`
- Organizations filter bar: removed `mounted` conditional

---

<!--
TEMPLATE for new items — copy below:

### [OPEN] Title
- **Discovered**: YYYY-MM-DD
- **Impact**: [what breaks or suffers]
- **Files**: [relevant files]
- **Depends On**: [other items if any]
- **Notes**: [context]

When completing, change [OPEN] to [DONE YYYY-MM-DD] and add version:
### [DONE 2026-MM-DD] Title (vX.X.X-bNNN)
-->
