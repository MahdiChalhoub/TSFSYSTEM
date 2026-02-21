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

### [DONE 2026-02-21] Finance Module Subscription Integration (v2.7.0-b012)
- **Discovered**: 2026-02-09
- **Impact**: ConnectorEngine finance hooks silently fail, no ledger entries created for plan changes
- **Files**: `erp_backend/apps/finance/events.py`, `erp_backend/erp/views_saas_modules.py`
- **Fix**: Replaced broken `route_write` with `dispatch_event('subscription:payment_created')`. Implemented `_on_subscription_payment_created` handler that creates journal entries (DR AR/CR Revenue) in SaaS master org.

### [DONE 2026-02-21] CRM Contact Balance Sync (v2.7.0-b012)
- **Discovered**: 2026-02-09
- **Impact**: CRM contacts show $0.00 balance even after subscription payments
- **Files**: `erp_backend/apps/crm/events.py`
- **Fix**: Implemented `_on_subscription_payment_created` CRM handler that updates billing contact balance via SaaSClient email lookup.

---

## 🟡 MEDIUM

### [DONE 2026-02-21] Plan Switch UI Refresh (v2.7.0-b013)
- **Discovered**: 2026-02-09
- **Impact**: After confirming plan switch, usage/billing data may not visually update without page refresh
- **Files**: `src/app/(privileged)/(saas)/organizations/[id]/page.tsx`
- **Fix**: Plan switch now refreshes ALL state (org, usage, billing, modules, addons), not just usage+billing. Modules tab and header badge now update immediately.

### [DONE 2026-02-21] Direct CRM Profile Link (v2.7.0-b013)
- **Discovered**: 2026-02-09
- **Impact**: "View CRM Profile" button navigates to search instead of direct contact record
- **Files**: `src/app/(privileged)/(saas)/organizations/[id]/page.tsx`
- **Fix**: Added `auto_select=true` query param for CRM contacts page to auto-select the matching contact.

### [DONE 2026-02-21] PWA Icon Verified (v2.7.0-b013)
- **Discovered**: 2026-02-09
- **Impact**: Console warning about missing manifest icon at `/icons/icon-192.png`
- **Files**: `public/icons/icon-192.png`, `public/manifest.json`
- **Fix**: Verified icons exist and manifest references are correct — may have been a caching issue.

---

## 🟢 LOW

### [DONE 2026-02-21] Module Hot-Reload (v2.7.0-b015)
- **Discovered**: 2026-02-09
- **Impact**: Modules require server restart after installation
- **Files**: `erp_backend/erp/module_manager.py`, `erp_backend/erp/views_saas_modules.py`, `src/app/(privileged)/(saas)/organizations/[id]/actions.ts`, `src/app/(privileged)/(saas)/organizations/[id]/page.tsx`
- **Fix**: Added `hot_reload()` method (DB sync + import cache invalidation + URL resolver reset). Auto-called after `upgrade()`. Exposed via API and frontend button.

### [DONE 2026-02-21] Kernel Rollback Functionality (v2.7.0-b016)
- **Discovered**: 2026-02-05
- **Impact**: No way to rollback kernel updates
- **Files**: `erp_backend/erp/kernel_manager.py`, `erp_backend/erp/views_kernel.py`
- **Fix**: Added `list_backups()` and `rollback()` to `KernelManager`. Exposed via `GET /api/kernel/backups/` and `POST /api/kernel/rollback/` endpoints. Rollback creates safety backup before restoring.

---

## ✅ COMPLETED

### [DONE 2026-02-21] Module Dependency Resolution UI (v2.7.0-b014)
- **Discovered**: 2026-02-09
- **Impact**: No visual dependency graph for modules — admins can't see dependency chains
- **Files**: `erp_backend/erp/views_saas_modules.py`, `src/app/(privileged)/(saas)/organizations/[id]/page.tsx`
- **Fix**: Added `dependencies` and `version` to modules API. Built SVG-based dependency graph with layered layout, color-coded nodes, Bézier curve edges, and dependency warnings.

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
