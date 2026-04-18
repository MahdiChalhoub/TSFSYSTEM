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

### [IN PROGRESS 2026-04-18] Refactor `organizations/[id]/page.tsx` — 1503 → 592 lines
- **Discovered**: 2026-04-18
- **Impact**: Violates `code-quality.md` rule (hard limit 300 lines, mandatory refactor over 400). Any further edits should split first.
- **Files**: `src/app/(privileged)/(saas)/organizations/[id]/page.tsx`
- **Progress 2026-04-18**: Wired up existing `_components/` (Overview, Billing, Addons tabs + OrgDialogs dialog set + UsageMeter/ModuleCard helpers). Pruned orphan state + handlers + dead imports. File now 592 lines, still over the 300-line limit. Commit `3040002a` (bundled with unrelated mobile commit — see WIP).
- **Remaining**: Extract Modules/Users/Sites/Usage tabs into new `_components/` files + extract orchestration into a `useOrganizationDetail` hook. Full plan: `task and plan/saas_org_page_refactor_002.md`.

### [OPEN] Module Dependency Resolution UI (plan written)
- **Discovered**: 2026-02-05 (promoted to MEDIUM 2026-04-18)
- **Impact**: Admins can't see which modules depend on each other before disabling. Dep data lives per-manifest but has no visualization.
- **Plan**: `task and plan/kernel_module_dep_graph_ui_001.md`
- **Estimated effort**: 1–2 days. Additive, low risk.

### [DONE 2026-04-18] PWA Icon Missing
- **Discovered**: 2026-02-09
- **Impact**: Console warning about missing manifest icon at `/icons/icon-192.png`
- **Files**: `public/icons/`, `public/manifest.json`
- **Fix**: Stale item — both `icon-192.png` (597 B) and `icon-512.png` (1.9 KB) are present in `public/icons/` and referenced from `manifest.json`. No code change required; WORKMAP entry was out of date.

---

## 🟢 LOW

### [OPEN] Module Hot-Reload — placeholder plan written 2026-04-18
- **Discovered**: 2026-02-05
- **Impact**: Modules require server restart after installation
- **Plan**: `task and plan/kernel_module_hot_reload_001.md` (placeholder — needs research session before implementation)
- **Notes**: Deferred backlog item from engine.md. Research questions documented in the plan. Blast radius is high; needs staging env before implementation.

### [OPEN] Kernel Rollback Functionality — placeholder plan written 2026-04-18
- **Discovered**: 2026-02-05
- **Impact**: No way to rollback kernel updates (especially ones that include migrations)
- **Plan**: `task and plan/kernel_rollback_001.md` (placeholder — needs research session before implementation)
- **Notes**: Deferred backlog item from engine.md. Needs decision on snapshot strategy + rollback SLA before implementation.

---

## ✅ COMPLETED

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
