# 📋 WORK IN PROGRESS — Agent Session Log

> **Purpose**: This file tracks what each agent session worked on, enabling handoff between agents.
> Every agent MUST read this file at the start and update it at the end of their session.

---

## How to Use

1. **At session start**: Read the latest entry to understand current state
2. **During work**: Update your entry with files modified and discoveries
3. **At session end**: Mark your entry DONE and add warnings/notes for next agent

---

## Session Log

### Session: 2026-02-09 (v2.7.0 series)
- **Agent**: Antigravity
- **Status**: ✅ DONE
- **Worked On**: SaaSClient → CRM Contact sync, Billing tab enhancements, Plan switch fix, Org card plan badges
- **Files Modified**:
  - `erp_backend/erp/models.py` — Added `sync_to_crm_contact()` to SaaSClient, added `billing_cycle` field to SubscriptionPayment
  - `erp_backend/erp/views_saas_modules.py` — Enhanced billing endpoint (structured response), synced clients on create
  - `erp_backend/erp/views.py` — Synced clients on org provisioning
  - `src/app/(privileged)/(saas)/organizations/page.tsx` — Plan badge on org cards, fixed hydration mismatch (filter bar)
  - `src/app/(privileged)/(saas)/organizations/[id]/page.tsx` — Billing tab UI rewrite (balance, client, CRM link)
  - `src/app/(privileged)/crm/contacts/manager.tsx` — Fixed hydration mismatch (toFixed vs toLocaleString)
  - `.agent/` — Rules and workflows audit, inter-agent communication files
- **Git Versions**: v2.7.0-b001 through v2.7.0-b009
- **Discoveries**:
  - SubscriptionPayment table has `billing_cycle` column (NOT NULL) that was missing from Django model — caused plan switch 500s
  - CRM Contact table has `customer_type` varchar(10) — values must be ≤10 chars
  - `toLocaleString()` causes hydration mismatch between server/client — use `toFixed()` instead
  - `mounted` conditional rendering causes hydration mismatch — avoid skeleton/real content branching in client components
- **Warnings for Next Agent**:
  - ⚠️ Finance module is NOT ready — ConnectorEngine finance hooks are best-effort and will silently fail
  - ⚠️ `auth/register/business/` endpoint is still missing — prevents automatic client creation during business registration
  - ⚠️ CRM Contact balance field shows $0.00 — not synced with subscription payments (needs finance ledger integration)
  - ⚠️ The dev servers have been running 8+ hours — restart them if you see "Failed to fetch" errors

---

### Session: 2026-02-09 (v2.7.1 series)
- **Agent**: Antigravity
- **Status**: ✅ DONE
- **Worked On**: Full system schema audit — fixed 28 DB-vs-Django mismatches across all modules
- **Files Modified**:
  - `erp_backend/erp/models.py` — Permission (created_at, updated_at), PlanCategory (parent FK), SubscriptionPayment (journal_entry FK, paid_at)
  - `erp_backend/apps/finance/models.py` — JournalEntry (5), JournalEntryLine (2), Transaction (3), TransactionSequence (2), LoanInstallment (3), FinancialEvent (5), BarcodeSettings (2)
  - `erp_backend/apps/inventory/models.py` — Unit (5), Category (2), Parfum (1), ProductGroup (1), Inventory (1), InventoryMovement (2)
  - `erp_backend/apps/pos/models.py` — Order (6), OrderLine (3)
  - `DOCUMENTATION/finance_schema_fixes.md` — Created
- **Git Versions**: v2.7.1-b001 through v2.7.1-b002
- **Discoveries**:
  - FinancialEvent.contact_id is NOT NULL in DB despite being nullable in old Django model
  - BarcodeSettings belongs to inventory, not finance (currently in finance module)
  - Order model was missing 6 critical fields (discount, payment_method, invoice_price_type, is_locked, is_verified, vat_recoverable)
- **Warnings for Next Agent**:
  - ⚠️ BarcodeSettings model lives in `apps/finance/models.py` but belongs to inventory — should be moved in a future cleanup
  - ⚠️ FinancialEvent REQUIRES a contact (NOT NULL) — any code creating events must provide a contact
  - ⚠️ No Django migrations were generated for these field additions (models use explicit `db_table` mapped to existing DB tables)
  - ⚠️ Schema is now 100% aligned — re-run `_full_audit.py` pattern to verify if any new tables are added

---

### Session: 2026-02-16 (v2.8.0 series)
- **Agent**: Antigravity
- **Status**: 🔄 IN_PROGRESS
- **Worked On**: POS Spec-vs-Implementation gap analysis + Phase 1.1 Supplier Categories
- **Files Modified**:
  - `erp_backend/apps/crm/models.py` — Expanded Contact: 6 types, supplier_category, customer_tier, loyalty_points, payment_terms_days, company_name, website, notes, is_active
  - `src/app/(privileged)/crm/contacts/form.tsx` — Conditional supplier category / customer tier fields, company name, payment terms, notes
  - `src/app/(privileged)/crm/contacts/manager.tsx` — LEAD filter, supplier category badges, customer tier badges
  - `src/app/(privileged)/crm/contacts/page.tsx` — New field mappings, Leads counter
  - `src/app/actions/people.ts` — Extended createContact with new fields
  - `DOCUMENTATION/MODULE_CRM_CONTACTS.md` — Created
- **Git Versions**: v2.8.0-b001
- **Discoveries**:
  - Local database `tsf_db` does not exist — migrations can only be applied on server
- **Warnings for Next Agent**:
  - ⚠️ Migration file created but NOT applied (no local DB) — must run `python manage.py migrate crm` on server
  - ⚠️ Remaining phases: 1.2 Client Pricing, 1.3 Client Intelligence, then Phases 2-6

---

### Session: 2026-04-15 (v2.9.0 series)
- **Agent**: Antigravity
- **Status**: ✅ DONE
- **Worked On**: Warehouse Hierarchy stabilization (API fix) + Stats Footer UI implementation
- **Files Modified**:
  - `src/app/(privileged)/inventory/warehouses/WarehouseClient.tsx` — Implemented COA-style glassmorphism stats footer (active locations, unique SKUs, active filters)
  - `erp_backend/apps/inventory/migrations/0053_product_tax_rate_category.py` — Applied migration (fix for 500 error in SKU panel)
- **Git Versions**: v2.9.0-b001 through v2.9.0-b002
- **Discoveries**:
  - `GET /api/inventory/` endpoint was throwing a `ProgrammingError` due to missing `tax_rate_category` column in `Product` model after tax engine overhaul.
  - COA footer design pattern uses `color-mix` for glassmorphism and `backdrop-filter: blur(10px)`.
- **Warnings for Next Agent**:
  - ⚠️ All inventory migrations are now up-to-date.
  - ⚠️ Tax policy configuration in warehouses is live but requires products to have a `tax_rate_category` assigned to work correctly with calculations.

---

### Session: 2026-04-18 (part 5 — OrgDialogs split)
- **Agent**: Claude Code (Opus 4.7, 1M)
- **Status**: ✅ DONE
- **Worked On**: Split `_components/OrgDialogs.tsx` (353 lines, over the 300-line limit) into five single-dialog files under a new `dialogs/` subdirectory. `OrgDialogs.tsx` becomes a 6-line barrel re-export so no importer needs updating.
- **Files Modified**:
  - NEW: `_components/dialogs/CreateUserDialog.tsx` (69 lines)
  - NEW: `_components/dialogs/ResetPasswordDialog.tsx` (51 lines)
  - NEW: `_components/dialogs/CreateSiteDialog.tsx` (66 lines)
  - NEW: `_components/dialogs/PlanSwitchDialog.tsx` (85 lines)
  - NEW: `_components/dialogs/ClientAssignDialog.tsx` (113 lines)
  - `_components/OrgDialogs.tsx` — replaced with a barrel re-export (6 lines).
- **Warnings for Next Agent**:
  - ⚠️ Not browser-smoke-tested (no dev server). Brace/paren balance verified on every split file. Next agent should visually exercise all 5 dialogs from the org detail page before deploying.

---

### Session: 2026-04-18 (part 4 — Module Dependency Graph UI)
- **Agent**: Claude Code (Opus 4.7, 1M)
- **Status**: ✅ DONE
- **Worked On**: Implemented WORKMAP item "Module Dependency Resolution UI" per `task and plan/kernel_module_dep_graph_ui_001.md`.
- **Files Modified**:
  - `erp_backend/erp/views_saas_modules.py` — added `@action(..., url_path='dependency-graph')` on `SaaSModuleViewSet`. Returns `{nodes, edges, organization_id}`. Each node includes `total_installs`, `installed_for_org` (when `?organization_id=` is passed), and `missing_dependencies`. Added `from django.db.models import Count` import.
  - `src/app/actions/saas/modules.ts` — added `getModuleDependencyGraph(organizationId?)` server action.
  - `src/app/(privileged)/(saas)/modules/dependencies/page.tsx` — NEW (239 lines). Cards-with-chips view. Click a dep chip or "Focus" to highlight transitive deps + dependents; unrelated modules dim. No new npm dependency.
  - `src/app/(privileged)/(saas)/modules/page.tsx` — added "Dependencies" button in header linking to the new page.
- **Discoveries**:
  - `SystemModule.manifest` is a JSONField with `dependencies` as a list of module codes. `OrganizationModule.module_name` → `SystemModule.name` is the installed-module link.
  - No react-flow / cytoscape / dagre in `package.json`. Scoped the implementation to a card-based layout that works today without adding a dep.
- **Warnings for Next Agent**:
  - ⚠️ **No browser smoke-test** (no dev server available in this env). Before deploying, load `/modules/dependencies` and verify: (a) nodes render, (b) Focus highlights the right subgraph, (c) missing-deps warning shows up for any module whose manifest references a code that's not in `SystemModule`, (d) clicking a dep chip focuses that module's card.
  - ⚠️ The "interactive positional graph" from the plan (react-flow) was **not** implemented. The card-based view is a functional-but-simpler alternative. If visual graph layout is needed, install `@xyflow/react` and add a graph renderer on the same `/modules/dependencies` route.
  - ⚠️ The endpoint requires `IsAdminUser` (SaaS admin). Non-admins hitting it get 403. Matches existing `SaaSModuleViewSet` permissions.

---

### Session: 2026-04-18 (part 3 — refactor completed under limit)
- **Agent**: Claude Code (Opus 4.7, 1M)
- **Status**: ✅ DONE
- **Worked On**: Finished the SaaS org detail page refactor per `task and plan/saas_org_page_refactor_002.md`. page.tsx is now **239 lines** (under the 300-line code-quality limit).
- **Files Modified**:
  - `src/app/(privileged)/(saas)/organizations/[id]/page.tsx` — reduced from 592 → 239 lines. Pure orchestration: header, tab-bar, 8 tab wirings, 5 dialog wirings.
  - `src/app/(privileged)/(saas)/organizations/[id]/_components/ModulesTab.tsx` — NEW (41 lines).
  - `src/app/(privileged)/(saas)/organizations/[id]/_components/UsersTab.tsx` — NEW (75 lines).
  - `src/app/(privileged)/(saas)/organizations/[id]/_components/SitesTab.tsx` — NEW (86 lines).
  - `src/app/(privileged)/(saas)/organizations/[id]/_components/UsageTab.tsx` — NEW (49 lines).
  - `src/app/(privileged)/(saas)/organizations/[id]/_hooks/useOrganizationDetail.ts` — NEW (254 lines). Owns all data + mutation logic (load, refreshXxx, toggleModule/Feature/Site, switchPlan with retry-on-stale-billing, createUser/Site, resetPassword, purchase/cancel addons, toggleEncryption, searchClients, assign/unassign/createAndAssignClient, updateSettings).
- **Discoveries**:
  - Dialog handler closures in the page were duplicating the same refresh patterns that the tab extractions already needed. Moving them into the hook (as `assignClient`, `switchPlan`, etc.) eliminated ~200 lines of near-duplicate closures.
  - `_components/OrgDialogs.tsx` is 353 lines — slightly over the 300-line limit. Not touched in this session. Candidate for splitting to one file per dialog.
- **Warnings for Next Agent**:
  - ⚠️ **No browser smoke-test**. Brace/paren balance checks passed, no dangling references detected, but regression risk exists on dialog round-trips, tab switching, state sync after mutations. Before deploying, spin up the dev stack and exercise the smoke-test checklist from `task and plan/saas_org_page_refactor_002.md`.
  - ⚠️ `OrgDialogs.tsx` is 353 lines — over the 300-line limit. Flag for a future split (one file per dialog, or group by related pairs).
  - ⚠️ `useOrganizationDetail.ts` is 254 lines. Under the limit but close; if it grows, split into `useOrgData` + `useOrgActions`.
  - ⚠️ All tab components and the hook use `@ts-nocheck`. Type-tightening is tempting but out of scope; track separately.

---

### Session: 2026-04-18 (part 2 — partial refactor + plans for LOW items)
- **Agent**: Claude Code (Opus 4.7, 1M)
- **Status**: ✅ DONE
- **Worked On**: Partial refactor of `organizations/[id]/page.tsx` (1503 → 592 lines). Wrote continuation plan + plans for three deferred WORKMAP LOW items.
- **Files Modified**:
  - `src/app/(privileged)/(saas)/organizations/[id]/page.tsx` — wired up existing `_components/` exports (OverviewTab, BillingTab, AddonsTab, OrgDialogs × 5, UsageMeter, ModuleCard); pruned orphan state/handlers/imports.
  - `task and plan/saas_org_page_refactor_002.md` — NEW. Continuation plan to extract remaining Modules/Users/Sites/Usage tabs + hook, targeting <300 lines.
  - `task and plan/kernel_module_dep_graph_ui_001.md` — NEW. Full plan for dep graph UI (WORKMAP LOW). 1–2 days, low risk.
  - `task and plan/kernel_module_hot_reload_001.md` — NEW. Placeholder plan with research questions. High risk, needs staging env.
  - `task and plan/kernel_rollback_001.md` — NEW. Placeholder plan with research questions. High risk, needs snapshot strategy decision.
  - `.agent/WORKMAP.md` — marked refactor as IN PROGRESS with progress note; promoted Dep Graph UI to MEDIUM; linked plans to the two remaining LOW items.
- **Git Versions**: None (see warning below about the refactor commit).
- **Discoveries**:
  - The extracted components under `_components/` (BillingTab, AddonsTab, OverviewTab, OrgDialogs with 5 dialogs, UsageMeter, ModuleCard) were already present but unused — page.tsx had inline duplicates. Refactor was mostly wiring, not rebuilding.
  - The refactor used a Python script via `Bash` (not `Edit`) to surgically replace long JSX line ranges — safer than trying to match 200+-line strings exactly.
  - Module dependencies are declared per-manifest: `erp_backend/apps/*/manifest.json` with a `dependencies` array. Core modules and most individual modules have no deps; `ecommerce`, `mcp`, `pos`, `client_portal`, `supplier_portal`, `workspace` have real graphs.
- **Warnings for Next Agent**:
  - ⚠️ **History is messy.** Commit `3040002a feat(mobile): add long-press action menu + move-to-parent dialog` bundles my page.tsx refactor with unrelated mobile work from a parallel process. The mobile process committed between my commits (check reflog: `cc603ade` and `3040002a` are mobile commits from outside this session). Don't be confused by the mismatched commit subject; the refactor IS in that commit. A follow-up split via interactive rebase would clean this up if desired.
  - ⚠️ `page.tsx` is still 592 lines (over 300-line limit). Continuation plan is `task and plan/saas_org_page_refactor_002.md` — 3–5 hours to finish. Smoke-test checklist included in the plan.
  - ⚠️ The Modules / Users / Sites / Usage tabs are still inline in page.tsx. They use imported `UsageMeter` and `ModuleCard` helpers, which works but means the page.tsx file still holds their JSX bodies.
  - ⚠️ I did not browser-smoke-test the refactor (no dev server available in this env). Brace/paren balance check passed and orphan-reference check is clean, but regressions are possible on tab switching, dialog interactions, or state sync after mutations. Next agent should spin up the dev stack and verify before deploying.
  - ⚠️ The Hot-Reload and Kernel Rollback plans are **placeholders with research questions**, not implementation plans. Treat them as prompts for a dedicated planning session.

---

### Session: 2026-04-18 (rules + WORKMAP MEDIUM items)
- **Agent**: Claude Code (Opus 4.7, 1M)
- **Status**: ✅ DONE
- **Worked On**: Reconciled Kernel OS v2.0 primitives with legacy `.agent/rules`; cleared three WORKMAP MEDIUM items (PWA icon, Plan Switch UI refresh race, Direct CRM Profile link).
- **Files Modified**:
  - `.agent/rules/kernel-os-v2.md` — NEW. Documents `TenantOwnedModel`, `AuditLogMixin`/`AuditableModel`, `emit_event`, `get_config`, `@require_permission`, and a compatibility table between legacy and OS v2.0 patterns.
  - `.agent/rules/architecture.md` — added section 8 pointing at `kernel-os-v2.md`.
  - `src/app/(privileged)/(saas)/organizations/[id]/page.tsx` — Plan switch handler now refetches sequentially (usage → billing), retries billing once with a 600ms delay if history hasn't grown (handles async journal-entry event), and calls `router.refresh()`. CRM Profile button now uses `billing.client.crm_contact_id` when present (direct link to `/crm/contacts/${id}`) with search fallback.
- **Discoveries**:
  - The billing endpoint at `erp_backend/erp/views_saas_org_billing.py:344-365` already resolves `crm_contact_id` by looking up the CRM Contact in the SaaS org by email. The frontend simply wasn't using it.
  - Icons at `public/icons/icon-192.png` (597 B) and `icon-512.png` (1.9 KB) already exist; the WORKMAP PWA entry was stale.
  - `TenantOwnedModel` stores its FK as `tenant_id` (db column) but the Python attribute is `organization` — the naming convention bridges the legacy "organization" rule and the kernel's "tenant" vocabulary.
  - `AuditLogMixin` in real code is an alias for `AuditableModel` (`kernel/audit/mixins.py:147`).
  - `src/app/(privileged)/(saas)/organizations/[id]/page.tsx` is 1503 lines (code-quality.md limit is 300). NOT refactored in this session — flagged for a dedicated plan.
- **Warnings for Next Agent**:
  - ⚠️ The 1503-line `organizations/[id]/page.tsx` is far over the 300-line limit. Needs a dedicated refactor plan — extract dialogs into `_components/` (some already live in `OrgDialogs.tsx` but the inline PlanSwitchDialog / ClientAssignDialog duplicates are still in the page).
  - ⚠️ The plan-switch retry uses a fixed 600 ms delay. If event processing is slower on a loaded system, billing may still look stale after the retry. A better long-term fix is for the backend to return a post-commit `billing_preview` in the `changeOrgPlan` response.
  - ⚠️ `crm_contact_id` lookup in the billing endpoint is by email — if the SaaSClient's email changes without running `sync_to_crm_contact`, the link will break silently.

---

### Session: 2026-04-15 (v2.9.0-b003)
- **Agent**: Antigravity
- **Status**: ✅ DONE
- **Worked On**: SaaS Billing → Finance Ledger integration, POS register integrity guards, Sidebar favorites bugfixes
- **Files Modified**:
  - `erp_backend/apps/finance/events.py` — Implemented `_on_subscription_payment` handler: creates real journal entries for subscription payments. Fixed event name mismatch (`subscription:updated` → now handled).
  - `erp_backend/erp/views_saas_org_billing.py` — Captured `payment_id` from `SubscriptionPayment.create()` and included in ConnectorEngine event payload.
  - `erp_backend/apps/pos/models/register_models.py` — Added `get_stock_warehouse` property (warehouse → branch fallback).
  - `erp_backend/apps/pos/views/register_lobby.py` — Added optional `register_id` site-scoping to `verify-manager` endpoint.
  - `src/components/admin/Sidebar.tsx` — Fixed React key warning and `toggleFavorite` call signature.
  - `src/context/FavoritesContext.tsx` — Sanitized all 3 data ingestion paths to strip stale `{icon, color}` keys.
- **Git Versions**: v2.9.0-b003
- **Discoveries**:
  - Billing dispatches `subscription:updated` but finance only listened for `subscription:renewed` — event name mismatch was the root cause of silent failures.
  - CRM contact $0.00 balance was downstream of missing journal entries, not a sync bug.
  - `system_role` on ChartOfAccount provides a reliable fallback for COA account resolution when posting rules aren't configured.
- **Warnings for Next Agent**:
  - ⚠️ The SaaS org needs posting rules configured for `saas.subscription_revenue` and `saas.accounts_receivable` for optimal journal entry creation. Without them, the handler falls back to `system_role='REVENUE'` and `system_role='RECEIVABLE'`.
  - ⚠️ No Django migrations needed for any of these changes.
  - ⚠️ WORKMAP HIGH priority items are now CLEAR — no CRITICAL or HIGH items remain.
