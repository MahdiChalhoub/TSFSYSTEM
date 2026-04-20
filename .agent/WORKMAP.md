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

### [OPEN] Fiscal Years `/new` + `/[id]` are broken scaffold pages
- **Discovered**: 2026-04-19
- **Impact**: `src/app/(privileged)/finance/fiscal-years/new/page.tsx` renders a form with the placeholder `<p>No form fields available</p>` and submits an empty `{}` to `POST /finance/fiscal-years/` — the route is unusable. The real creation flow is the inline Wizard inside `viewer.tsx`. `src/app/(privileged)/finance/fiscal-years/[id]/page.tsx` is a scaffold that dumps `Object.entries(item)` as raw JSON and its Edit button navigates to `/finance/fiscal-years/${id}/edit` — a route that **does not exist** (404).
- **Options**: (a) delete both scaffolds and ensure nothing links to them — but check first; (b) finish them properly; (c) replace with redirects back to the main list. Needs product call.

### [OPEN] Dead fiscal-years components: `wizard.tsx` + `year-card.tsx`
- **Discovered**: 2026-04-19
- **Impact**: `src/app/(privileged)/finance/fiscal-years/wizard.tsx` (226 lines) and `year-card.tsx` (258 lines) export default React components that are **never imported anywhere**. `viewer.tsx` reimplements both inline. Dead code.
- **Fix**: Per `.agent/rules/cleanup.md`, archive rather than delete — move to `/ARCHIVE/src/app/(privileged)/finance/fiscal-years/` preserving the folder shape.

### [OPEN] `fiscal-years/viewer.tsx` is 1363 lines (over 300-line limit)
- **Discovered**: 2026-04-19
- **Impact**: Violates `code-quality.md` hard limit. Any further edits should refactor first. Not refactored this session — modal-escape fixes were additive and the file was already over-limit.
- **Fix**: Extract the three bespoke modals (Wizard, Draft Audit, Year-End Close) into `_components/`. Extract the year/period rendering into `_components/YearPanel.tsx`. Extract the `openWizard` gap-detection logic + state into `_hooks/useFiscalYearsViewer.ts`. Target: page ≤ 250 lines of orchestration. Est: 3–4 hours.

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
