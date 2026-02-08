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

### 1. [ ] End-to-End Provisioning Test
- Provision a new tenant org through the UI or API
- Verify `org:provisioned` event fires and all handlers execute
- Confirm Finance creates: FiscalYear, 12 Periods, CoA, Cash Drawer, Settings
- Confirm CRM creates: Billing Contact linked to new org
- Fix any runtime issues discovered

### 2. [ ] Module Contracts Registration
- Create Django migration or management command to register ModuleContract records
- Each module declares what events it subscribes to
- Verify contract-based discovery path works alongside filesystem scan

### 3. [ ] Event Replay Mechanism
- Build management command: `python manage.py replay_buffered_events`
- Or periodic Celery task to auto-replay when modules come online
- Add admin UI to view/manage buffered events

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
