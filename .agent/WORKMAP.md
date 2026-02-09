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

### [OPEN] Missing `auth/register/business/` Endpoint
- **Discovered**: 2026-02-09
- **Impact**: Business registration flow fails — new users can't register
- **Files**: `erp_backend/erp/urls.py`, `erp_backend/erp/views.py`
- **Notes**: The frontend calls this endpoint during business registration but it returns 404

---

## 🟠 HIGH

### [OPEN] Finance Module Not Ready
- **Discovered**: 2026-02-09
- **Impact**: ConnectorEngine finance hooks silently fail, no ledger entries created for plan changes
- **Files**: `erp_backend/apps/finance/`
- **Notes**: Plan switch creates SubscriptionPayment records but can't push to finance ledger. CRM Contact balance stays at $0.00.

### [OPEN] CRM Contact Balance Not Synced
- **Discovered**: 2026-02-09
- **Impact**: CRM contacts show $0.00 balance even after subscription payments
- **Files**: `erp_backend/erp/models.py` (sync_to_crm_contact), `apps/crm/models.py`
- **Depends On**: Finance module integration

---

## 🟡 MEDIUM

### [OPEN] Plan Switch UI Refresh
- **Discovered**: 2026-02-09
- **Impact**: After confirming plan switch, usage/billing data may not visually update without page refresh
- **Files**: `src/app/(privileged)/(saas)/organizations/[id]/page.tsx`
- **Notes**: The state refresh logic works but may have race conditions with large data loads

### [OPEN] Direct CRM Profile Link
- **Discovered**: 2026-02-09
- **Impact**: "View CRM Profile" button navigates to search instead of direct contact record
- **Files**: `src/app/(privileged)/(saas)/organizations/[id]/page.tsx`
- **Notes**: Needs CRM Contact ID stored on SaaSClient or Organization model

### [OPEN] PWA Icon Missing
- **Discovered**: 2026-02-09
- **Impact**: Console warning about missing manifest icon at `/icons/icon-192.png`
- **Files**: `public/icons/`, `public/manifest.json`

---

## 🟢 LOW

### [OPEN] Module Hot-Reload
- **Discovered**: 2026-02-05
- **Impact**: Modules require server restart after installation
- **Notes**: Deferred backlog item from engine.md

### [OPEN] Kernel Rollback Functionality
- **Discovered**: 2026-02-05
- **Impact**: No way to rollback kernel updates
- **Notes**: Deferred backlog item from engine.md

### [OPEN] Module Dependency Resolution UI
- **Discovered**: 2026-02-05
- **Impact**: No visual dependency graph between modules
- **Notes**: Deferred backlog item from engine.md

---

## ✅ COMPLETED

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
