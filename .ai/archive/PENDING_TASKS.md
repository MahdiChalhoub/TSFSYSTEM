# Pending Tasks — Module Connector Roadmap

Track remaining work to complete the full module connector architecture.
Mark items `[x]` when done. Stay focused — finish one before starting the next.

---

## ✅ Completed

- [x] **Module Event Handlers** — `events.py` for all 5 modules (Finance, CRM, Inventory, POS, HR)
- [x] **ProvisioningService Refactor** — Kernel uses ConnectorEngine events only
- [x] **ConnectorEngine Enhancement** — Dual discovery + buffering + result chaining
- [x] **Universal Import Gating** — All cross-module imports gated with try/except
- [x] **Kernel Re-exports Gated** — models.py, views.py, serializers/core.py
- [x] **Agent Rule** — `.agent/workflows/module-isolation.md` enforces the rule

---

## 🔜 Next Up

### 1. [x] End-to-End Provisioning Test ✅
- Provisioned a new tenant org and verified full event chain
- Finance: FiscalYear=1, Periods=12, CoA=18, CashDrawer=1, PostingRules+Settings saved
- CRM: Billing Contact created in SaaS org, billing_contact_id linked
- **Bonus fixes discovered during test:**
  - Warehouse model: added missing `type`/`can_sell` NOT NULL fields
  - ChartOfAccount model: added 6 missing NOT NULL fields
  - Order model: removed orphaned `warehouse` FK not in DB
  - ConfigurationService: rewrote to use `Organization.settings` JSON
  - Finance events: fixed `linked_coa` kwarg

### 2. [x] Module Contracts Registration ✅
- Created `register_contracts` management command
- Registered 5 contracts: finance, crm, inventory, hr, pos
- Each contract declares: provides (endpoints, events), needs (event subscriptions), rules (degradation)
- Provisioning test verified dual discovery (DB contracts + filesystem scan) works
- Documentation: `DOCUMENTATION/module_contracts.md`

### 3. [x] Event Replay Mechanism ✅
- Fixed `replay_buffered()` to handle EVENT-type requests via `_deliver_event()`
- Added `replay_all_pending()` and `get_buffer_stats()` to ConnectorEngine
- Created `replay_buffered_events` command: `--stats`, `--cleanup`, `--module`, `--org` flags
- Documentation: `DOCUMENTATION/event_replay_mechanism.md`

### 4. [x] PWA Offline Mode for POS ✅
- Service Worker with cache-first/network-first strategies
- IndexedDB offline storage: products cache + pending order queue
- Sync queue with Background Sync + manual replay
- React hooks: `useOnlineStatus`, `useOfflineProducts`, `usePendingOrders`
- Offline indicator component + ProductGrid offline fallback
- Documentation: `DOCUMENTATION/pwa_offline_pos.md`

### 5. [x] Frontend Module Isolation ✅
- Sidebar already had `module` field + `installedModules` filtering
- Added `ModuleGate` route guard for direct URL access
- Documentation: `DOCUMENTATION/frontend_module_isolation.md`

### 6. [x] Per-Module API Routing ✅
- Dynamic URL auto-discovery from `apps/` directory
- Dual-mount: flat (backward compat) + namespaced (new standard)
- Zero frontend changes needed
- Documentation: `DOCUMENTATION/per_module_api_routing.md`

---

## 📋 Upcoming — Feature Expansion Roadmap

### 7. [x] PWA Mobile App ✅
- **Status:** Fully implemented
- `manifest.json` — Full enterprise app (name, icons, shortcuts, scope)
- `sw.js` — Cache-first + network-first strategies, offline fallback page, background sync
- Layout: manifest link, SW registration, Apple PWA meta tags
- Installable on iOS (Add to Home Screen) and Android (Install App prompt)
- **Design rule created:** `.agent/workflows/design-standards.md` — all features must be PWA-suitable, mobile-responsive, theme-compliant

### 8. [x] Bank Reconciliation UI ✅
- **Status:** Already built at `/finance/bank-reconciliation/page.tsx`
- Account drill-in, auto-matching, manual match confirmation
- Uses TypicalListView with proper columns
- **Future enhancement:** Drag-and-drop UI, AI suggestions

### 9. [ ] Tax Export Engine (FEC/CSV/XML)
- **Effort:** 2 sessions | **Priority:** Medium
- Export tax data in government-required formats (FEC for France, CSV for Lebanon, etc.)
- Leverage existing Universal Tax Engine calculations
- Per-country export format plugins
- NOT direct API submission — file export for manual upload to government portals

### 10. [ ] Payroll Engine
- **Effort:** 5-7 sessions | **Priority:** Medium
- Salary calculation engine with deductions/contributions rules
- Payslip generation (PDF + on-screen)
- Auto-post payroll journal entries via ConnectorEngine (HR → Finance)
- **Prerequisites:** HR module with employees, departments, contracts already exists
- **Country-specific:** Deduction rules, social security rates, tax brackets vary by country

### 11. [ ] Country-Specific Tax & Payroll Rules
- **Effort:** Ongoing | **Priority:** Future
- Pluggable country packs: Lebanon, France, OHADA zone, UAE, etc.
- Each pack defines: tax brackets, social contributions, filing formats, fiscal calendar
- Direct government e-filing APIs (per-country, where available)
- **Note:** This is the most complex item — each country is a separate project. Start with Lebanon + France.

---

> **Rule:** Always finish the current task before starting the next one.
> **Rule:** Never add a new task mid-flight — finish first, then plan.
