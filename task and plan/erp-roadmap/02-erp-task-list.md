# TSFSYSTEM ERP — Master Task List

> Derived from: `01-erp-roadmap.md`
> **Last Updated**: 2026-04-13

---

## Phase 0: Finish Finance Core 🔴

### 0.1 — Posting Rules → Ledger Integration
- [x] 0.1.1 — Verify PostingRule engine resolves correct debit/credit accounts for each event type ✅
- [x] 0.1.2 — Test: Create manual journal entry → verify it appears in ledger ✅
- [ ] 0.1.3 — Test: Trigger auto-posting (e.g. "goods received") → verify journal entry auto-created
- [x] 0.1.4 — Verify PostingEvent catalog covers all transaction types (PO, Invoice, Payment, Stock, etc.) ✅

### 0.2 — Tax Calculation → Invoice Lines
- [ ] 0.2.1 — Verify tax engine calculates correct tax for a product line (HT→TTC and TTC→HT)
- [ ] 0.2.2 — Test multi-tax scenarios (VAT + custom tax rules like Zakat, Eco Tax)
- [ ] 0.2.3 — Verify CounterpartyTaxProfile applies per-customer/supplier tax overrides
- [ ] 0.2.4 — Verify OrgTaxPolicy default rules apply when no counterparty profile exists

> **SCHEMA DRIFT FIXED** (2026-04-13):
> - `journalentry.policy_snapshot` → made nullable, default `{}`
> - `journalentry.required_levels_frozen` → made nullable, default 0
> - `journalentry.is_verified` → made nullable, default false
> - `JournalEntry.save()` → guarded `finance_hard_locked_at` with `hasattr()`

### 0.3 — COA Balance Queries
- [x] 0.3.1 — Build/verify `get_account_balance(account_id, date_range)` service ✅ (via BalanceService)
- [x] 0.3.2 — Verify debit/credit aggregation across JournalEntryLine ✅
- [x] 0.3.3 — Test: Post 3 entries → query balance → confirm correct sum ✅ (post + reversal zeroed)
- [x] 0.3.4 — Build Trial Balance query (all accounts, debit vs credit columns) ✅ (live fallback works)

### 0.4 — Payment Posting
- [x] 0.4.1 — Verify payment creation auto-posts journal entry (debit Bank, credit AR/AP) ✅ (PaymentPostingService reviewed)
- [ ] 0.4.2 — Test partial payment scenarios
- [ ] 0.4.3 — Test payment reversal/void

### 0.5 — Fiscal Period Management
- [ ] 0.5.1 — Verify fiscal year/period CRUD
- [ ] 0.5.2 — Build period closing logic (lock period → no more postings)
- [ ] 0.5.3 — Build opening balance carry-forward on new fiscal year

---

## Phase 1: Cross-Cutting Engines 🟠

### 1A — Document Lifecycle Engine
- [ ] 1A.1 — Create `erp/services/lifecycle.py` with `LifecycleService` class
- [ ] 1A.2 — Implement `lock(obj, user)` → set status=LOCKED, create TransactionStatusLog
- [ ] 1A.3 — Implement `verify(obj, user, level)` → check TransactionVerificationConfig for required levels
- [ ] 1A.4 — Implement `confirm(obj, user)` → final confirmation, immutable
- [ ] 1A.5 — Implement `unlock(obj, user, reason)` → requires comment, create audit log
- [ ] 1A.6 — Create API endpoints: `/api/lifecycle/{type}/{id}/lock/`, `/verify/`, `/confirm/`, `/unlock/`
- [ ] 1A.7 — Create `<LifecycleStatusBar>` frontend component (status display + action buttons)
- [ ] 1A.8 — Wire `VerifiableModel` inheritance into: JournalEntry, PurchaseOrder, SalesInvoice, Payment, StockAdjustment
- [ ] 1A.9 — Add ViewSet guards: block edits when `lifecycle_status != 'OPEN'`

### 1B — Dynamic RBAC System
- [ ] 1B.1 — Create permission seeder: auto-generate permissions per module (`finance.view_coa`, `finance.edit_journal`, `inventory.create_product`, `pos.void_order`, etc.)
- [ ] 1B.2 — Create role templates seeder: Admin, Manager, Accountant, Warehouse Manager, Cashier, Viewer
- [ ] 1B.3 — Build `@require_permission('code')` decorator for ViewSets
- [ ] 1B.4 — Build `usePermission('code')` frontend hook for UI gating
- [ ] 1B.5 — Build Role management page (create/edit roles, assign permissions)
- [ ] 1B.6 — Build User → Role assignment UI
- [ ] 1B.7 — Allow orgs to clone default roles and customize permissions
- [ ] 1B.8 — Apply `@require_permission` to all existing ViewSets (incremental, module by module)

### 1C — Auto Task Engine
- [ ] 1C.1 — Create `AutoTask` model (`title, assigned_to_user, assigned_to_role, related_type, related_id, status, due_date, priority`)
- [ ] 1C.2 — Create `TaskRule` model (`trigger_model, trigger_status, assign_to_role, title_template, priority, auto_due_days`)
- [ ] 1C.3 — Build signal handlers: `post_save` on transaction models → check TaskRule → create AutoTask
- [ ] 1C.4 — Bridge to Notification: when AutoTask created → also create Notification
- [ ] 1C.5 — Build Task inbox frontend (sidebar widget or top header dropdown)
- [ ] 1C.6 — Build Task management page (list, filter by status/priority/assignee)
- [ ] 1C.7 — Seed default task rules (PO confirmed → "Receive goods", Invoice created → "Approve invoice", etc.)

---

## Phase 2: Master Data 📦

### 2A — Product Catalogue Verification
- [ ] 2A.1 — Verify Category CRUD (create, edit, delete, tree structure)
- [ ] 2A.2 — Verify Brand CRUD
- [ ] 2A.3 — Verify Unit of Measure CRUD
- [ ] 2A.4 — Verify Product CRUD: create product → set price → assign category/brand → assign to warehouse
- [ ] 2A.5 — Verify Product Variants: attribute system → variant generation
- [ ] 2A.6 — Verify Packaging Levels: unit ↔ package pricing
- [ ] 2A.7 — Add Product → COA links: `revenue_account`, `cogs_account`, `inventory_account` (for auto-posting)

### 2B — CRM Contacts ↔ Accounting Bridge
- [ ] 2B.1 — Verify Contact CRUD (Customer + Supplier types)
- [ ] 2B.2 — Build: Auto-create AR sub-account when creating Customer contact
- [ ] 2B.3 — Build: Auto-create AP sub-account when creating Supplier contact
- [ ] 2B.4 — Verify CounterpartyTaxProfile linkage (already exists)
- [ ] 2B.5 — Verify payment_terms assignment on contacts
- [ ] 2B.6 — Build customer balance view (total invoiced - total paid)
- [ ] 2B.7 — Build supplier balance view (total owed - total paid)

### 2C — Warehouse Setup
- [ ] 2C.1 — Verify Warehouse CRUD (location hierarchy: warehouse → zone → bin)
- [ ] 2C.2 — Build stock initialization flow (opening balances via StockAdjustment)
- [ ] 2C.3 — Verify stock quantity queries per warehouse/product

---

## Phase 3: Purchase Cycle 🛒

### 3.1 — Purchase Order Flow
- [ ] 3.1.1 — Create PO: select supplier + products → generate PO with lines
- [ ] 3.1.2 — PO Lifecycle: DRAFT → LOCKED → VERIFIED by manager → CONFIRMED
- [ ] 3.1.3 — RBAC: only `procurement.create_po` can create, `procurement.approve_po` can verify
- [ ] 3.1.4 — Auto Task: PO confirmed → task "Receive goods" to warehouse role

### 3.2 — Goods Receipt
- [ ] 3.2.1 — Receive goods against PO → create StockMovement + StockCostLayer
- [ ] 3.2.2 — Auto-posting: Receipt → journal entry (debit Inventory, credit GR/IR clearing)
- [ ] 3.2.3 — Partial receipt support
- [ ] 3.2.4 — Auto Task: Receipt done → task "Match supplier invoice" to accounting role

### 3.3 — Supplier Invoice
- [ ] 3.3.1 — Create supplier invoice → match to PO + receipt
- [ ] 3.3.2 — Tax calculation from CounterpartyTaxProfile
- [ ] 3.3.3 — Auto-posting: Invoice → journal entry (debit GR/IR + Tax, credit AP)
- [ ] 3.3.4 — Invoice Lifecycle: DRAFT → LOCKED → VERIFIED → CONFIRMED

### 3.4 — Payment to Supplier
- [ ] 3.4.1 — Create payment against supplier invoice
- [ ] 3.4.2 — Auto-posting: Payment → journal entry (debit AP, credit Bank)
- [ ] 3.4.3 — Partial payment support
- [ ] 3.4.4 — Verify: after full payment, supplier balance = 0

### 3.5 — End-to-End Purchase Test
- [ ] 3.5.1 — Full flow: PO → Receipt → Invoice → Payment → verify all ledger entries correct
- [ ] 3.5.2 — Verify Trial Balance after purchase cycle
- [ ] 3.5.3 — Verify supplier balance

---

## Phase 4: Sales Cycle 💰

### 4.1 — Sales Order / Invoice
- [ ] 4.1.1 — Create sales order/invoice: select customer + products
- [ ] 4.1.2 — Tax calculation from customer's CounterpartyTaxProfile
- [ ] 4.1.3 — Auto-posting: Invoice → journal entry (debit AR, credit Revenue + Tax)
- [ ] 4.1.4 — Inventory: decrease stock on delivery

### 4.2 — POS Terminal
- [ ] 4.2.1 — POS sale = Order + Invoice + Payment in one step
- [ ] 4.2.2 — Verify POS auto-posts correctly
- [ ] 4.2.3 — POS returns → credit note → reverse stock + financials

### 4.3 — Payment Collection
- [ ] 4.3.1 — Collect payment from customer
- [ ] 4.3.2 — Auto-posting: Payment → journal entry (debit Bank, credit AR)
- [ ] 4.3.3 — Partial payment + aging tracking

### 4.4 — End-to-End Sales Test
- [ ] 4.4.1 — Full flow: Sale → Invoice → Deliver → Collect → verify all ledger entries
- [ ] 4.4.2 — Verify Trial Balance after sales cycle
- [ ] 4.4.3 — Verify customer balance

---

## Phase 5: Reconciliation & Reports 📊

### 5.1 — Financial Reconciliation
- [ ] 5.1.1 — Ledger view: all journal entries, filter by account/period
- [ ] 5.1.2 — Trial Balance report (auto-calculated)
- [ ] 5.1.3 — Bank reconciliation: match bank statements to payments
- [ ] 5.1.4 — VAT Return report: aggregate tax from posted invoices
- [ ] 5.1.5 — Period closing: lock fiscal period from edits

### 5.2 — Financial Statements
- [ ] 5.2.1 — P&L (Income Statement)
- [ ] 5.2.2 — Balance Sheet
- [ ] 5.2.3 — Cash Flow Statement

### 5.3 — Operational Reports
- [ ] 5.3.1 — Sales analytics (by product, customer, period)
- [ ] 5.3.2 — Inventory valuation report
- [ ] 5.3.3 — Supplier performance report
- [ ] 5.3.4 — Aging reports (AR + AP)

---

> **Total items**: ~95 tasks across 5 phases
> **Critical path**: Phase 0 → Phase 1A/1B → Phase 2 → Phase 3 → Phase 4 → Phase 5
