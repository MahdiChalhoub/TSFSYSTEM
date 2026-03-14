# 🏛️ TSFSYSTEM Financial Engine Architecture v2.0
## Enterprise-Grade — Adapted from SAP, Odoo & Oracle Financials

**Date**: 2026-03-10 | **Status**: Implementation Complete | **Version**: 2.0

---

## 1. Core Principle: Layered Architecture

The finance engine is built as **layers**, not just models. Each layer has a
single responsibility and communicates downward only.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TSFSYSTEM BUSINESS MODULES                       │
│                                                                     │
│ Sales | POS | Purchases | Inventory | Payroll | Fixed Assets        │
│ CRM   | HRM | Expenses  | Partners  | Tax     | Banking             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   SUBLEDGER / SOURCE DOCUMENT LAYER                 │
│                                                                     │
│ Sales Invoice | POS Sale | Purchase Invoice | Goods Receipt         │
│ Stock Adjustment | Expense Claim | Payroll Slip | Asset Depreciation│
│ Partner Contribution | Withdrawal | Tax Settlement | Bank Transfer  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    POSTING RULES / ACCOUNT MAPPING                  │
│                                                                     │
│ Dynamic rules from organization.settings                            │
│ No hardcoded COA codes                                              │
│ Rule resolution by transaction type + scope + org settings          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      POSTING / JOURNAL ENGINE                       │
│                                                                     │
│ Validate document → Build journal lines → Balance check             │
│ Scope routing → Approval check → Lock check → Atomic posting        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GENERAL LEDGER / COA ENGINE                      │
│                                                                     │
│ Chart of Accounts | Journal Entries | Journal Entry Lines           │
│ Opening Balances | Period Balances | Reconciliation | Audit Trail   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                ▼                 ▼                 ▼
┌────────────────────┐ ┌────────────────────┐ ┌──────────────────┐
│ RECONCILIATION     │ │ FISCAL PERIOD      │ │ MULTI-CURRENCY   │
│ AR/AP/Bank matching│ │ lock/close/reopen  │ │ FX/rates/revalue │
└────────────────────┘ └────────────────────┘ └──────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│               REPORTING / GOVERNANCE / CLOSING                      │
│                                                                     │
│ Trial Balance | P&L | Balance Sheet | Cash Flow                     │
│ Fiscal Close | Revaluation | Period Lock | Year-End Carry Forward   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 8 Major Engines

### A. Chart of Accounts Engine (✅ Implemented)

**File**: `apps/finance/models/coa_models.py`

The structural base — not just a list of accounts, but the **semantic map**
used by every other engine.

```python
ChartOfAccount
├── code, name, description                    # Identity
├── type: ASSET|LIABILITY|EQUITY|INCOME|EXPENSE # Classification
├── sub_type                                    # Fine-grained (RECEIVABLE, PAYABLE, BANK, CASH)
├── normal_balance: DEBIT|CREDIT               # ← NEW: auto-resolved from type
├── class_code: 1-9                            # ← NEW: universal reporting class
├── class_name                                 # ← NEW: "Assets", "Liabilities", etc.
├── allow_posting: True/False                  # ← NEW: header vs postable
├── allow_reconciliation: True/False           # ← NEW: AR/AP/Bank lines
├── is_control_account: True/False             # ← NEW: subledger control
├── subledger_type: CUSTOMER|SUPPLIER|etc      # ← NEW: subledger linking
├── currency, allow_multi_currency             # ← NEW: multi-currency support
├── revaluation_required: True/False           # ← NEW: FX revaluation flag
├── path: "1000.1100.1110"                     # ← NEW: materialized path
├── parent: FK(self)                           # Tree hierarchy
├── balance, balance_official                  # Dual-scope balances
├── is_active, is_system_only, is_hidden       # Flags
├── requires_zero_balance                      # Fiscal close control
├── syscohada_code, syscohada_class            # Cross-standard refs
├── created_by, updated_by                     # ← NEW: audit fields
└── locked_at, locked_by                       # ← NEW: account locking
```

**Normal Balance Matrix** (auto-resolved on save):
```
Type        │ Normal Balance │ Class Code
────────────│────────────────│──────────
ASSET       │ DEBIT          │ 1
EXPENSE     │ DEBIT          │ 5
LIABILITY   │ CREDIT         │ 2
EQUITY      │ CREDIT         │ 3
INCOME      │ CREDIT         │ 4
```

---

### B. Posting Rules Engine (✅ Already Existed)

**File**: `erp/services.py` → `ConfigurationService`

Converts operational events into accounting accounts dynamically.

```
POS Sale
→ PostingRuleResolver loads:
  - sales.receivable → COA account ID
  - sales.revenue → COA account ID
  - sales.vat_collected → COA account ID
  - sales.cogs → COA account ID
  - sales.inventory → COA account ID
→ JournalBuilder creates balanced JE
```

**Rule Resolution Inputs**:
- Organization
- Module (sales, purchases, inventory, pos)
- Document type (invoice, receipt, adjustment)
- Scope (OFFICIAL / INTERNAL)
- Tax mode
- Payment method

---

### C. Journal Engine (✅ Enhanced)

**File**: `apps/finance/models/ledger_models.py`

Nothing hits the ledger unless it passes through this engine.

```python
JournalEntry (enhanced)
├── Core: transaction_date, description, reference, scope
├── journal_type: GENERAL|SALES|PURCHASE|CASH|BANK|etc  # ← NEW
├── source_module: "sales" | "purchases" | "pos"        # ← NEW: prevents double-posting
├── source_model: "Invoice" | "Order" | "StockMove"     # ← NEW
├── source_id: 42                                        # ← NEW: source document PK
├── currency, exchange_rate                              # ← NEW: multi-currency
├── total_debit, total_credit                            # ← NEW: denormalized totals
├── fiscal_year, fiscal_period                           # Period enforcement
├── status: DRAFT → POSTED → REVERSED
├── created_by, posted_by, posted_at
└── entry_hash, previous_hash                            # Immutable audit chain

JournalEntryLine (enhanced)
├── account, debit, credit, description
├── partner_type: CUSTOMER|SUPPLIER|EMPLOYEE|PARTNER     # ← NEW: subledger
├── partner_id: FK to contact/user                       # ← NEW
├── currency, exchange_rate, amount_currency             # ← NEW: multi-currency
├── financial_account: FK → FinancialAccount             # ← NEW: cash flow tracking
├── product: FK → Product                                # ← NEW: COGS analysis
├── cost_center: "KITCHEN" | "WAREHOUSE-A"               # ← NEW: management accounting
├── tax_line: FK → TaxGroup                              # ← NEW
├── is_reconciled: True/False                            # ← NEW
└── reconciled_amount: Decimal                           # ← NEW
```

**Validation Pipeline** (in `create_journal_entry`):
```
1. ☑ Debits == Credits (balanced)
2. ☑ Fiscal period is OPEN (SOFT_LOCKED → supervisor only)
3. ☑ Fiscal year not hard-locked
4. ☑ Account allows posting (allow_posting=True)
5. ☑ System-only account check (no manual posting)
6. ☑ Source document not already posted (source_module + source_id)
7. ☑ Scope authorization
```

---

### D. Fiscal Period Engine (✅ Enhanced)

**File**: `apps/finance/models/fiscal_models.py`

```python
FiscalYear (enhanced)
├── name, start_date, end_date
├── status: OPEN | CLOSED | FINALIZED          # ← NEW
├── is_closed, is_hard_locked
├── closed_at, closed_by                        # ← NEW: audit
└── closing_journal_entry                       # ← NEW: year-end closing JE

FiscalPeriod (enhanced)
├── fiscal_year, name, start_date, end_date
├── status: OPEN | SOFT_LOCKED | HARD_LOCKED | CLOSED | FUTURE  # ← ENHANCED
├── is_adjustment_period: True/False            # ← NEW: 13th audit period
├── closed_at, closed_by                        # ← NEW: audit
├── is_posting_allowed → True only if OPEN
└── is_supervisor_posting_allowed → True if OPEN or SOFT_LOCKED
```

**Period Statuses**:
```
OPEN        → Normal posting allowed
SOFT_LOCKED → Supervisor-only posting (month-end adjustments)
HARD_LOCKED → No posting (period finalized)
CLOSED      → No posting + reports frozen
FUTURE      → No posting (not yet started)
```

---

### E. Subledger Engine (✅ Implemented via JEL fields)

**File**: `apps/finance/models/ledger_models.py` → `JournalEntryLine`

```
Control Account (GL)
   ↳ many subledger entities via partner_type + partner_id

Example:
  1110 Accounts Receivable (is_control_account=True)
   ↳ Customer A (partner_type=CUSTOMER, partner_id=101)
   ↳ Customer B (partner_type=CUSTOMER, partner_id=102)
   ↳ Customer C (partner_type=CUSTOMER, partner_id=103)
```

**Query for customer statement**:
```sql
SELECT * FROM journalentryline
WHERE account_id = (AR account)
AND partner_type = 'CUSTOMER'
AND partner_id = 101
ORDER BY journal_entry.transaction_date
```

---

### F. Reconciliation Engine (✅ Implemented)

**File**: `apps/finance/models/reconciliation_models.py`

```python
ReconciliationMatch
├── account: FK → ChartOfAccount (reconcilable)
├── match_type: AUTO | MANUAL | PAYMENT | WRITE_OFF | REVERSAL
├── status: MATCHED | PARTIAL | BROKEN
├── partner_type, partner_id
├── matched_amount, write_off_amount
└── matched_at, matched_by, unmatched_at, unmatched_by

ReconciliationLine
├── reconciliation: FK → ReconciliationMatch
├── journal_entry_line: FK → JournalEntryLine
├── matched_amount
└── is_debit_side
```

**Flow**:
```
Invoice (Dr AR 5,000) → UNRECONCILED
Payment (Cr AR 3,000) → UNRECONCILED
                        ↓
ReconciliationMatch(status=PARTIAL, matched=3,000)
  ├── Line: Invoice JEL → 3,000
  └── Line: Payment JEL → 3,000
Remaining: 2,000 still unreconciled

Second Payment (Cr AR 2,000)
                        ↓
ReconciliationMatch(status=MATCHED, matched=5,000)
  ├── Line: Invoice JEL → 5,000
  ├── Line: Payment 1 → 3,000
  └── Line: Payment 2 → 2,000
```

---

### G. Balance Engine (✅ Implemented)

**File**: `apps/finance/models/balance_snapshot.py`

Three balance strategies:

| Strategy | Source | Speed | Use |
|----------|--------|-------|-----|
| Transactional truth | `JournalEntryLine` aggregate | Slow | Audit verification |
| Account balance | `ChartOfAccount.balance` | Instant | Dashboard, account detail |
| Period snapshot | `AccountBalanceSnapshot` | Fast | Reports, financial statements |

```python
AccountBalanceSnapshot
├── account, fiscal_period, scope
├── opening_debit, opening_credit       # Brought forward
├── movement_debit, movement_credit     # Period activity
├── closing_debit, closing_credit       # = opening + movement
├── transaction_count                   # Audit verifiable
├── is_stale                            # Triggers recomputation
└── computed_at                         # Freshness timestamp
```

**Self-recomputation**: Each snapshot can call `.recompute()` to recalculate
from JournalEntryLine source data.

---

### H. Opening Balance Engine (✅ Implemented)

**File**: `apps/finance/models/opening_balance.py`

Separated from migration journal entries per SAP/Odoo/Oracle standard.

```python
OpeningBalance
├── account: FK → ChartOfAccount
├── fiscal_year: FK → FiscalYear
├── debit_amount, credit_amount
├── scope: OFFICIAL | INTERNAL
├── source: TRANSFER | MANUAL | MIGRATION
├── currency, amount_currency
├── created_at, created_by, notes
```

**Year-End Close Flow**:
```
FiscalYear 2025 (CLOSING)
    │
    ▼
For Balance Sheet accounts (ASSET, LIABILITY, EQUITY):
  → Create OpeningBalance(2026, source=TRANSFER)
  → debit_amount = account closing debit balance
  → credit_amount = account closing credit balance

For P&L accounts (INCOME, EXPENSE):
  → Net Income → Retained Earnings (equity)
  → All P&L accounts → Reset to zero
  → No opening balance for P&L in new year
```

---

## 3. Clean Service Architecture

Following the user's recommended service split:

```
ConfigurationService           → reads rules/settings
  └→ PostingRuleResolver       → resolves account IDs dynamically

PostingEligibilityService      → checks lock/approval/state
JournalBuilder                 → builds proposed lines
JournalValidationService       → checks debit=credit/account status/scope
JournalPostingService          → writes JE + lines atomically (existing: create_journal_entry)

BalanceService                 → updates snapshots / current balances
ReconciliationService          → matches open items
ClosingService                 → handles period close / year close
```

---

## 4. Posting Flow Examples

### POS Cash Sale
```
POS Order completed
   ↓
AccountingPostingService receives event
   ↓
PostingRuleResolver loads:
  - sales.receivable → Cash account
  - sales.revenue → Revenue account
  - sales.vat_collected → VAT account
  - sales.cogs → COGS account
  - sales.inventory → Inventory account
   ↓
JournalBuilder creates:
  Dr Cash                   1,000
  Cr Revenue                  850
  Cr VAT Collected            150
  Dr COGS                    600
  Cr Inventory                600
   ↓
JournalEngine validates + posts atomically
   ↓
POS order marked POSTED (source_module='pos', source_id=order.id)
```

### Purchase with Deferred Invoice
```
Goods received (no invoice yet)
   ↓
Dr Inventory / Stock Interim    5,000
Cr GRNI / Reception Suspense    5,000
  (journal_type=PURCHASE, source_module='purchases', source_model='GoodsReceipt')

Invoice received later
   ↓
Dr Reception Suspense           5,000
Dr VAT Recoverable               550
Cr Supplier Payable             5,550
  (journal_type=PURCHASE, source_module='purchases', source_model='Invoice')
```

---

## 5. Complete Model Map

| Model | File | Status |
|-------|------|--------|
| `ChartOfAccount` | `coa_models.py` | ✅ Enhanced (15 new fields) |
| `FinancialAccount` | `coa_models.py` | ✅ Existing |
| `FiscalYear` | `fiscal_models.py` | ✅ Enhanced (status, audit, closing JE) |
| `FiscalPeriod` | `fiscal_models.py` | ✅ Enhanced (SOFT/HARD_LOCKED, audit) |
| `JournalEntry` | `ledger_models.py` | ✅ Enhanced (source tracking, type, currency) |
| `JournalEntryLine` | `ledger_models.py` | ✅ Enhanced (partner, currency, dimensions) |
| `OpeningBalance` | `opening_balance.py` | ✅ **NEW** |
| `AccountBalanceSnapshot` | `balance_snapshot.py` | ✅ **NEW** |
| `ReconciliationMatch` | `reconciliation_models.py` | ✅ **NEW** |
| `ReconciliationLine` | `reconciliation_models.py` | ✅ **NEW** |

---

## 6. Implementation Phases

### Phase 1 — ✅ DONE (This Session)
- [x] `normal_balance` on ChartOfAccount
- [x] `class_code` / `class_name` universal classification
- [x] `allow_posting` / `allow_reconciliation` / `is_control_account`
- [x] `subledger_type` linking
- [x] `currency` / `allow_multi_currency` / `revaluation_required`
- [x] `path` materialized path
- [x] Audit fields (`created_by`, `updated_by`, `locked_at`, `locked_by`)
- [x] FiscalPeriod: `SOFT_LOCKED`, `HARD_LOCKED`, `is_adjustment_period`
- [x] JournalEntry: `journal_type`, `source_module/model/id`, multi-currency, totals
- [x] JournalEntryLine: `partner_type/id`, multi-currency, dimensions, reconciliation
- [x] `OpeningBalance` model
- [x] `AccountBalanceSnapshot` model
- [x] `ReconciliationMatch` + `ReconciliationLine` models
- [x] Database migration generated

### Phase 2 — ✅ DONE
- [x] Wire `allow_posting` check into `create_journal_entry`
- [x] Wire `is_control_account` enforcement (warning on missing partner_type)
- [x] Wire `is_active` account check (blocked)
- [x] Wire source document duplicate-posting prevention
- [x] Wire `SOFT_LOCKED` / `HARD_LOCKED` / `FUTURE` period enforcement
- [x] Pass through new JEL fields (partner_type/id, currency, etc.)
- [x] Store denormalized `total_debit`/`total_credit` on post
- [x] Mark `AccountBalanceSnapshot` as stale on post
- [x] Implement `BalanceService` (refresh_snapshots, get_trial_balance, generate_snapshots_for_period)
- [x] Implement `ClosingService` (close_period, soft_lock, hard_lock, reopen, close_fiscal_year, generate_opening_balances)
- [x] Implement `ReconciliationService` (create_match, unmatch, auto_match, get_unreconciled_lines, get_reconciliation_status)
- [x] Delegate `FiscalYearService.close_fiscal_year` → `ClosingService`
- [x] Populate `path` for all existing accounts (data migration — 20/20 accounts)
- [x] Populate `normal_balance` + `class_code` for all existing accounts

### Phase 2.5 — ✅ DONE (Gap Fixes)
- [x] Add `posted_journal_entry` FK to `PostableMixin` (ledger link for all postable docs)
- [x] Fix `FiscalYearSerializer.get_status` conflict (now uses model field)
- [x] Enhance `ChartOfAccountSerializer` with computed properties (level, is_debit_normal)
- [x] Create `ChartOfAccountTreeSerializer` for dropdown/tree views
- [x] Create serializers for new models: `OpeningBalance`, `AccountBalanceSnapshot`, `ReconciliationMatch/Line`

### Phase 3 — ✅ DONE (Enterprise Engine)
- [x] `Currency` model — ISO 4217 registry with base currency flag
- [x] `ExchangeRate` model — Spot/Average/Closing/Budget rates with inverse
- [x] `CurrencyRevaluation` + `CurrencyRevaluationLine` — period-end FX revaluation
- [x] `RevaluationService` — full revaluation run with JE generation
- [x] `RecurringJournalTemplate` + `RecurringJournalLine` + `RecurringJournalExecution` — automated JE generation
- [x] `RecurringJournalService` — process due templates, auto-post, schedule advancement
- [x] `Budget` + `BudgetLine` — budget header with versions, per-account/period/cost-center lines
- [x] `BudgetService` — refresh actuals, variance analysis, commitment control
- [x] `ConsolidationGroup` — multi-entity reporting group
- [x] `ConsolidationEntity` — subsidiary with ownership% and method (Full/Proportional/Equity)
- [x] `IntercompanyRule` — IC elimination rules (Revenue/Expense, AR/AP, Investment/Equity)
- [x] `ConsolidationRun` + `ConsolidationLine` — execution results with FX translation

### Phase 4 — Future
- [ ] ConsolidationService (full execution logic)
- [ ] Multi-currency statement conversion report
- [ ] Budget approval workflow (via LifecycleViewSet)
- [ ] Recurring journal UI (calendar view)
- [ ] IC transaction detection engine
- [ ] Cost center / profit center dimension models
- [ ] Segment reporting

---

## 7. Complete Service File Map

| Service | File | Responsibilities |
|---------|------|-----------------|
| `LedgerCoreMixin` | `ledger_core.py` | `create_journal_entry`, `post_journal_entry`, `reverse`, `recalculate` |
| `BalanceService` | `balance_service.py` | Snapshot refresh, trial balance, period generation |
| `ClosingService` | `closing_service.py` | Period close, year-end close, opening balance generation |
| `ReconciliationService` | `reconciliation_service.py` | AR/AP/Bank matching, auto-match, unmatch |
| `FiscalYearService` | `fiscal_service.py` | Year creation, delegates close to ClosingService |
| `RevaluationService` | `revaluation_service.py` | FX revaluation at period-end, rate lookup |
| `RecurringJournalService` | `recurring_journal_service.py` | Template processing, JE creation, schedule advancement |
| `BudgetService` | `budget_service.py` | Actuals refresh, variance analysis, availability check |
| `ConfigurationService` | `erp/services.py` | Posting rules read/write/auto-detect |

---

## 8. Complete Model Map

| Model | File | Status | Fields |
|-------|------|--------|--------|
| `ChartOfAccount` | `coa_models.py` | ✅ Enhanced (15 new fields) | 55 |
| `FinancialAccount` | `coa_models.py` | ✅ Existing | — |
| `FiscalYear` | `fiscal_models.py` | ✅ Enhanced (status, audit, closing JE) | 16 |
| `FiscalPeriod` | `fiscal_models.py` | ✅ Enhanced (SOFT/HARD_LOCKED, audit) | 16 |
| `JournalEntry` | `ledger_models.py` | ✅ Enhanced (source, type, currency, totals) | 57 |
| `JournalEntryLine` | `ledger_models.py` | ✅ Enhanced (partner, currency, dimensions) | 21 |
| `OpeningBalance` | `opening_balance.py` | ✅ **v2.0** | — |
| `AccountBalanceSnapshot` | `balance_snapshot.py` | ✅ **v2.0** | — |
| `ReconciliationMatch` | `reconciliation_models.py` | ✅ **v2.0** | — |
| `ReconciliationLine` | `reconciliation_models.py` | ✅ **v2.0** | — |
| `Currency` | `currency_models.py` | ✅ **v3.0** | 11 |
| `ExchangeRate` | `currency_models.py` | ✅ **v3.0** | 8 |
| `CurrencyRevaluation` | `currency_models.py` | ✅ **v3.0** | — |
| `CurrencyRevaluationLine` | `currency_models.py` | ✅ **v3.0** | — |
| `RecurringJournalTemplate` | `recurring_journal_models.py` | ✅ **v3.0** | 20 |
| `RecurringJournalLine` | `recurring_journal_models.py` | ✅ **v3.0** | — |
| `RecurringJournalExecution` | `recurring_journal_models.py` | ✅ **v3.0** | — |
| `Budget` | `budget_models.py` | ✅ **v3.0** | 14 |
| `BudgetLine` | `budget_models.py` | ✅ **v3.0** | 13 |
| `ConsolidationGroup` | `consolidation_models.py` | ✅ **v3.0** | 10 |
| `ConsolidationEntity` | `consolidation_models.py` | ✅ **v3.0** | — |
| `IntercompanyRule` | `consolidation_models.py` | ✅ **v3.0** | — |
| `ConsolidationRun` | `consolidation_models.py` | ✅ **v3.0** | 12 |
| `ConsolidationLine` | `consolidation_models.py` | ✅ **v3.0** | — |


