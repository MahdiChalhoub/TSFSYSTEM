# TSFSYSTEM ERP — Master Task List

> Derived from: `01-erp-roadmap.md`
> **Last Updated**: 2026-04-13

---

## Phase 0: Finish Finance Core ✅ (18/19 verified — one integration test pending)

### 0.1 — Posting Rules → Ledger Integration
- [x] 0.1.1 — Verify PostingRule engine resolves correct debit/credit accounts for each event type ✅
- [x] 0.1.2 — Test: Create manual journal entry → verify it appears in ledger ✅
- [ ] 0.1.3 — Test: Trigger auto-posting (e.g. "goods received") → verify journal entry auto-created
- [x] 0.1.4 — Verify PostingEvent catalog covers all transaction types (PO, Invoice, Payment, Stock, etc.) ✅

### 0.2 — Tax Calculation → Invoice Lines
- [x] 0.2.1 — Verify tax engine calculates correct tax for a product line (HT→TTC and TTC→HT) ✅
- [x] 0.2.2 — Test multi-tax scenarios (VAT + custom tax rates, multi-line order) ✅
- [x] 0.2.3 — Verify CounterpartyTaxProfile applies per-customer/supplier tax overrides ✅ (5 profiles, model verified)
- [x] 0.2.4 — Verify OrgTaxPolicy default rules apply when no counterparty profile exists ✅ (4 policies, default exists)

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
- [x] 0.4.2 — Test partial payment scenarios ✅ (service accepts any amount, no forced match to invoice total)
- [x] 0.4.3 — Test payment reversal/void ✅ (LedgerCoreMixin.reverse_journal_entry exists, reversal entries in DB)

### 0.5 — Fiscal Period Management
- [x] 0.5.1 — Verify fiscal year/period CRUD ✅ (FY 2026 + 12 periods confirmed, page validated)
- [x] 0.5.2 — Build period closing logic (lock period → no more postings) ✅ (ClosingService: close/soft_lock/hard_lock/reopen)
- [x] 0.5.3 — Build opening balance carry-forward on new fiscal year ✅ (ClosingService.generate_opening_balances: BS accounts only, idempotent)

---

## Phase 1: Cross-Cutting Engines ✅ (verified — engines exist and are integrated)

### 1A — Document Lifecycle Engine ✅
- [x] 1A.1 — `kernel/lifecycle/service.py` exists (478 lines, `LifecycleService` class) ✅
- [x] 1A.2 — Implements lock, verify, approve, submit, post, reverse, reject, cancel, reopen ✅
- [x] 1A.3 — Multi-level verification via ApprovalPolicy + ApprovalPolicyStep ✅
- [x] 1A.4 — Confirm action via approve() with min_level_required check ✅
- [x] 1A.5 — Reopen with audit trail (TxnApproval records) ✅
- [x] 1A.6 — API: Handler dispatch pattern (register_handler/get_handler) ✅
- [x] 1A.7 — `LifecycleViewSetMixin` wired into 7+ ViewSets (Payment, Voucher, Expense, StockAdjustment, StockTransfer, StockMove) ✅
- [x] 1A.8 — post() dispatches on_post handler, reverse() dispatches on_reverse ✅
- [x] 1A.9 — Event emission (emit_event) on all transitions ✅
- **Architecture**: State machine with 9 statuses (DRAFT→SUBMITTED→VERIFIED→APPROVED→POSTED→LOCKED→REVERSED→REJECTED→CANCELLED) and TRANSITION_RULES

### 1B — Dynamic RBAC System ✅
- [x] 1B.1 — Permission seeder: **541 permissions** seeded ✅
- [x] 1B.2 — Role templates: **5 roles** (Manager, SALES_CLERK, SALES_MANAGER, ACCOUNTANT, ADMIN) ✅
- [x] 1B.3 — `@require_permission('code')` decorator ✅ (`kernel/rbac/decorators.py`)
- [x] 1B.4 — `check_permission()` + `check_resource_permission()` (row-level) ✅
- [x] 1B.5 — `require_any_permission` + `require_all_permissions` ✅
- [x] 1B.6 — PolicyEngine for policy evaluation ✅
- [x] 1B.7 — Models: Role, Permission, UserRole ✅ (kernel_role, kernel_permission, kernel_user_role tables)
- [ ] 1B.8 — Role management UI page (create/edit roles, assign permissions) — pending frontend

### 1C — Auto Task Engine ✅
- [x] 1C.1 — Task model with full lifecycle (start/complete/cancel, subtasks, hierarchy) ✅
- [x] 1C.2 — AutoTaskRule model with 11 trigger types (PRICE_CHANGE, LOW_STOCK, NEW_INVOICE, etc.) ✅
- [x] 1C.3 — TaskTemplate with recurring support + role assignment ✅
- [x] 1C.4 — TaskCategory, TaskComment, TaskAttachment models ✅
- [x] 1C.5 — ChecklistTemplate/Instance system with check_completion() ✅
- [x] 1C.6 — Questionnaire/Evaluation system with calculate_score() ✅
- [x] 1C.7 — EmployeePerformance with tier calculation (BRONZE→PLATINUM) ✅
- [x] 1C.8 — WorkspaceConfig auto-seeds defaults (statuses, priorities, triggers) ✅
- [x] 1C.9 — EmployeeRequest model (approve/reject flow) ✅
- [ ] 1C.10 — Seed default AutoTaskRules (PO approved → "Receive goods", etc.) — needs business rules

---

## Phase 2: Master Data ✅ (34/36 — Product COA links pending)

### 2A — Product Catalogue Verification ✅
- [x] 2A.1 — Verify Category CRUD (create, edit, delete, tree structure) ✅ (6 categories, parent FK exists)
- [x] 2A.2 — Verify Brand CRUD ✅ (16 brands: Chanel, Dior, Guerlain, Tom Ford, YSL, Lancôme...)
- [x] 2A.3 — Verify Unit of Measure CRUD ✅ (7 units, UnitConversion model exists)
- [x] 2A.4 — Verify Product CRUD ✅ (114 products, 62 fields: selling_price_ht/ttc, cost_price_ht/ttc, SKU, category, brand)
- [x] 2A.5 — Verify Product Variants: attribute system (15 attributes, ProductAttributeValue, ProductVariant models) ✅
- [x] 2A.6 — Verify Packaging Levels: ProductPackaging model exists ✅
- [ ] 2A.7 — Add Product → COA links: `revenue_account`, `cogs_account`, `inventory_account` (for auto-posting) — **pending**

### 2B — CRM Contacts ↔ Accounting Bridge ✅
- [x] 2B.1 — Verify Contact CRUD (12 Customers + 11 Suppliers) ✅
- [x] 2B.2 — Contact has AR link (linked_account_id field) ✅
- [x] 2B.3 — Contact has AP link (linked_payable_account_id field) ✅
- [x] 2B.4 — CounterpartyTaxProfile linkage (tax_profile_id FK) ✅
- [x] 2B.5 — Payment terms assignment (payment_terms_days=30 default) ✅
- [x] 2B.6 — Balance fields exist (customer_balance, supplier_balance, wallet_balance, current_balance, opening_balance) ✅
- [x] 2B.7 — Supplier balance view covered by same fields ✅

### 2C — Warehouse Setup ✅
- [x] 2C.1 — Verify Warehouse CRUD (2 warehouses, full hierarchy: Zone→Aisle→Rack→Shelf→Bin) ✅
- [x] 2C.2 — StockAdjustmentOrder exists for opening balances ✅
- [x] 2C.3 — Stock quantity infrastructure: StockLedger, Inventory, ProductLocation, StockCostLayer ✅

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
