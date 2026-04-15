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
