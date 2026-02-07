# Architecture Module Extraction – Phase 1

## Goal
Migrate all business models, serializers, and URL scaffolding out of the Kernel (`erp/`) into isolated module directories (`apps/[module]/`), following the **Engine → Kernel → Core → Modules** layered architecture.

## Modules Created

### 1. Finance Module (`apps/finance/`)
**Purpose:** Handles all accounting, ledger, tax, and financial management.

**Models:** ChartOfAccount, FinancialAccount, FiscalYear, FiscalPeriod, JournalEntry, JournalEntryLine, Transaction, TransactionSequence, BarcodeSettings, Loan, LoanInstallment, FinancialEvent

**Data READ from:** `ChartOfAccount`, `FinancialAccount`, `JournalEntry`, `FiscalYear`, `Transaction` tables

**Data SAVED to:** Same tables (all use explicit `db_table`)

**Key Variables:** account code, balance, debit, credit, fiscal year dates, loan amounts

---

### 2. Inventory Module (`apps/inventory/`)
**Purpose:** Handles product catalog, stock management, and warehouse operations.

**Models:** Product, Unit, Category, Brand, Parfum, ProductGroup, Warehouse, Inventory, InventoryMovement

**Data READ from:** `Product`, `Inventory`, `Warehouse`, `Category`, `Brand` tables

**Data SAVED to:** Same tables

**Key Variables:** SKU, barcode, cost_price, selling_price, quantity, min_stock_level

---

### 3. POS Module (`apps/pos/`)
**Purpose:** Handles sales orders, purchases, and transactions.

**Models:** Order, OrderLine

**Data READ from:** `Order`, `OrderLine` tables

**Data SAVED to:** Same tables

**Key Variables:** order type (SALE/PURCHASE), status, total_amount, quantity, unit_price

---

### 4. CRM Module (`apps/crm/`)
**Purpose:** Handles customer and supplier contact management.

**Models:** Contact

**Data READ from:** `Contact` table

**Data SAVED to:** `Contact` table

**Key Variables:** type (CUSTOMER/SUPPLIER/LEAD), name, linked_account, balance

---

### 5. HR Module (`apps/hr/`)
**Purpose:** Handles employee management.

**Models:** Employee

**Data READ from:** `Employee` table

**Data SAVED to:** `Employee` table

**Key Variables:** employee_id, name, salary, linked_account, department

---

## Architecture Flow

### How models are migrated:
1. Model definitions move from `erp/models.py` → `apps/[module]/models.py`
2. All models retain their original `db_table` → **zero database changes**
3. `erp/models.py` adds backward-compatible re-exports → **zero code breakage**
4. Module models import `TenantModel` from kernel → **correct dependency direction**

### Dependency Direction:
```
Module → Kernel → Core (CORRECT ✓)
Kernel → Module (via re-exports only, transitional)
```

### Cross-Module References:
Foreign keys between modules use Django string references:
- `'finance.ChartOfAccount'` (from CRM and HR)
- `'crm.Contact'` (from Finance and POS)
- `'inventory.Product'` (from POS)
- `'inventory.Warehouse'` (from POS)

## Files Modified

### Kernel (cleaned)
- `erp/models.py` — Now contains only infrastructure models + re-exports
- `erp/serializers/core.py` — Now contains only kernel serializers + re-exports

### New Module Files
| Module | `__init__.py` | `apps.py` | `models.py` | `serializers.py` | `urls.py` |
|--------|:---:|:---:|:---:|:---:|:---:|
| finance | ✓ | ✓ | ✓ | ✓ | ✓ |
| inventory | ✓ | ✓ | ✓ | ✓ | ✓ |
| pos | ✓ | ✓ | ✓ | ✓ | ✓ |
| crm | ✓ | ✓ | ✓ | ✓ | ✓ |
| hr | ✓ | ✓ | ✓ | ✓ | ✓ |

## Verification
- `python manage.py check` passes with only pre-existing auth.W004 warning
- All backward-compatible re-exports verified working
- No circular import issues
