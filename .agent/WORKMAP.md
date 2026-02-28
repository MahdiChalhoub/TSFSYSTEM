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

### [DONE 2026-02-28] Finance Module Not Ready (v3.1.3-AG-260228.2259)
- **Status**: The `_on_subscription_updated` event chain is correctly implemented in both Finance and CRM.
- **Fix**: SaaSClient CRM sync was failing because of missing automation in the model and a balance reset bug. Added `save()` override to `SaaSClient` and fixed `sync_to_crm_contact()` to preserve balances.

### [DONE 2026-02-28] CRM Contact Balance Not Synced (v3.1.3-AG-260228.2259)
- **Fix**: CRM handler now correctly receives updates without them being reset by the SaaSClient model sync.

### [DONE 2026-02-28] Inventory Module — Page Audit & Fix (v3.1.3-AG-260228.2259)
- **Audit**: Verified 25 inventory directories (24 in docs + pos-settings). 
- **Actions**: Verified 20 action files (up from 16). 
- **Docs**: Updated `DOCUMENTATION/MODULE_INVENTORY.md` with correct paths and counts.

### [DONE 2026-02-22] Inventory Documentation Outdated
- **Discovered**: 2026-02-22
- **Impact**: MODULE_INVENTORY.md doesn't reflect current state of inventory module
- **Files**: `DOCUMENTATION/MODULE_INVENTORY.md`
- **Notes**: Fully rewritten — now documents all 24 pages, 18 action files, 9 components

---

## 🟡 MEDIUM

### [DONE 2026-02-28] Plan Switch UI Refresh (v3.1.3-AG-260228.2336)
- **Impact**: After confirming plan switch, usage/billing data now visually updates instantly via `reloadData()` and `router.refresh()`.
- **Files**: `src/app/(privileged)/(saas)/organizations/[id]/page.tsx`
- **Fix**: Centralized data fetching into `reloadData` and ensured it's called after successful plan changes.

### [DONE 2026-02-28] Direct CRM Profile Link (v3.1.3-AG-260228.2236)
- **Discovered**: 2026-02-09
- **Impact**: "View CRM Profile" button navigates to search instead of direct contact record
- **Files**: `erp_backend/erp/views_saas_org_billing.py`, `src/app/(privileged)/(saas)/organizations/[id]/page.tsx`, `src/types/erp.ts`
- **Fix**: billing endpoint now resolves `crm_contact_id` via CRM Contact lookup by email in the SaaS org. Frontend uses it to navigate directly to `/crm/contacts/{id}`.

### [DONE 2026-02-28] PWA Icon Missing (v3.1.3-AG-260228.2336)
- **Impact**: Replaced missing/corrupt icons with premium 512x512 and 192x192 PNGs at `/icons/icon-*.png`.
- **Files**: `public/icons/`, `public/manifest.json`
- **Fix**: Icons generated using Antigravity design system and correctly linked.

---

## 🟢 LOW

### [DONE 2026-02-28] Module Hot-Reload (v3.1.3-AG-260228.2336)
- **Impact**: Modules no longer require manual process restart for registry/manifest changes.
- **Notes**: Added `trigger_reload()` to `ModuleManager` which touches `settings.py` to trigger Django's auto-reloader.

### [DONE 2026-02-28] Kernel Rollback Functionality (v3.1.3-AG-260228.2336)
- **Impact**: Added ability to list and restore from core kernel backups in the SaaS Hub.
- **Notes**: Implemented in `KernelManager` and exposed via API endpoints.

### [DONE 2026-02-28] Module Dependency Resolution UI (v3.1.3-AG-260228.2336)
- **Impact**: Clear visual feedback on dependency status (Installed/Missing) in the Global Registry.
- **Notes**: Added status icons and tooltips to the Registry UI.

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
