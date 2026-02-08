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

### 4. [ ] PWA Offline Mode for POS
- Service Worker for offline caching
- IndexedDB for offline transaction storage
- Sync queue that replays through ConnectorEngine on reconnect

### 5. [ ] Frontend Module Isolation
- Audit Next.js frontend for hardcoded module imports
- Dynamic module loading based on tenant's enabled modules
- Sidebar/routes only show enabled modules

### 6. [ ] Per-Module API Routing
- Each module gets own URL namespace: `/api/v1/finance/`, `/api/v1/pos/`
- Dynamic URL registration based on INSTALLED_APPS
- Remove centralized `erp/urls.py` hardcoded routes

---

> **Rule:** Always finish the current task before starting the next one.
> **Rule:** Never add a new task mid-flight — finish first, then plan.
