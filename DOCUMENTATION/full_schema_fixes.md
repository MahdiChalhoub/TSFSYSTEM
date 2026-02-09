# Full System Schema Fixes

## Goal
Align all Django models with actual PostgreSQL database schema across every module.

## Problem
28 database columns existed in PostgreSQL but were missing from Django models. Any INSERT through Django ORM would fail on NOT NULL columns.

## Tables Fixed

### ERP Kernel (`erp/models.py`) — 5 fields
| Model | Field | Type | Purpose |
|---|---|---|---|
| Permission | created_at | timestamp | Creation time |
| Permission | updated_at | timestamp | Last modification |
| PlanCategory | parent | FK → self | Hierarchical plan categories |
| SubscriptionPayment | journal_entry | FK → JournalEntry | Links payment to accounting |
| SubscriptionPayment | paid_at | timestamp | When payment confirmed |

### Finance Module (`apps/finance/models.py`) — 22 fields
| Model | Fields Added | Key Items |
|---|---|---|
| JournalEntry | 5 | fiscal_period, is_locked, is_verified, posted_at, updated_at |
| JournalEntryLine | 2 | contact FK, employee FK |
| Transaction | 3 | scope (CRITICAL), reference_id, site FK |
| TransactionSequence | 2 | padding, suffix |
| LoanInstallment | 3 | paid_amount, status, paid_at |
| FinancialEvent | 5 | currency, transaction FK, created_at, updated_at, contact (NOT NULL fix) |
| BarcodeSettings | 2 | is_enabled, length |

### Inventory Module (`apps/inventory/models.py`) — 12 fields
| Model | Fields Added | Key Items |
|---|---|---|
| Unit | 5 | type (CRITICAL), allow_fraction, needs_balance, base_unit FK, balance_code_structure |
| Category | 2 | code, short_name |
| Parfum | 1 | short_name |
| ProductGroup | 1 | image |
| Inventory | 1 | batch FK (self-reference) |
| InventoryMovement | 2 | cost_price (CRITICAL), reason |

### POS Module (`apps/pos/models.py`) — 9 fields
| Model | Fields Added | Key Items |
|---|---|---|
| Order | 6 | discount, invoice_price_type, is_locked, is_verified, payment_method, vat_recoverable (all CRITICAL) |
| OrderLine | 3 | airsi_amount, total, batch FK |

## Verification
- `manage.py check` ✅
- Full system audit: **ZERO ISSUES** ✅
- TransactionSequence CRUD test: PASS ✅

## Data Flow
- **READ**: All module pages read from these tables via DRF ViewSets
- **WRITE**: Ledger, POS, Inventory, SaaS billing pages write to these tables

## Files Modified
- `erp_backend/erp/models.py`
- `erp_backend/apps/finance/models.py`
- `erp_backend/apps/inventory/models.py`
- `erp_backend/apps/pos/models.py`
