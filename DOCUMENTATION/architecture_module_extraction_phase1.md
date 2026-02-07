# Architecture Module Extraction – Phase 1

## Goal
Migrate all business models, serializers, services, and URL scaffolding out of the Kernel (`erp/`) into isolated module directories (`apps/[module]/`), following the **Engine → Kernel → Core → Modules** layered architecture.

## Modules Created

### 1. Finance Module (`apps/finance/`)
**Purpose:** Handles all accounting, ledger, tax, and financial management.

**Models (12):** ChartOfAccount, FinancialAccount, FiscalYear, FiscalPeriod, JournalEntry, JournalEntryLine, Transaction, TransactionSequence, BarcodeSettings, Loan, LoanInstallment, FinancialEvent

**Services (7):** LedgerService, FinancialAccountService, SequenceService, BarcodeService, LoanService, FinancialEventService, TaxService

**Serializers (12):** One per model

**Data READ from:** ChartOfAccount, FinancialAccount, JournalEntry, FiscalYear, Transaction tables

**Data SAVED to:** Same tables (all use explicit `db_table`)

---

### 2. Inventory Module (`apps/inventory/`)
**Purpose:** Handles product catalog, stock management, and warehouse operations.

**Models (9):** Product, Unit, Category, Brand, Parfum, ProductGroup, Warehouse, Inventory, InventoryMovement

**Services (1):** InventoryService (stock reception, valuation, reduction)

**Serializers (11):** Including ProductCreateSerializer and BrandDetailSerializer variants

---

### 3. POS Module (`apps/pos/`)
**Purpose:** Handles sales orders, purchases, and transactions.

**Models (2):** Order, OrderLine

**Services (2):** POSService (checkout), PurchaseService (authorize, receive, quick_purchase, invoice_po)

**Serializers (2):** OrderSerializer, OrderLineSerializer

---

### 4. CRM Module (`apps/crm/`)
**Purpose:** Handles customer and supplier contact management.

**Models (1):** Contact

**Serializers (1):** ContactSerializer

---

### 5. HR Module (`apps/hr/`)
**Purpose:** Handles employee management.

**Models (1):** Employee

**Serializers (1):** EmployeeSerializer

---

## Kernel (What Remains in `erp/`)

### Infrastructure Models (in `erp/models.py`)
Organization, TenantModel, User, Role, Permission, Site, SystemModule, OrganizationModule, SystemSettings, SystemUpdate, BusinessType, GlobalCurrency, Country, PlanCategory, SubscriptionPlan, SubscriptionPayment, PackageUpload, StockBatch

### Infrastructure Services (in `erp/services.py`)
ProvisioningService, ConfigurationService

### ViewSets (in `erp/views.py`)
All ViewSets remain in the kernel for now. They work correctly through backward-compatible re-exports from `erp/models.py`, `erp/serializers/core.py`, and `erp/services.py`.

---

## Architecture Flow

### How code is migrated:
1. Code definitions move from `erp/` → `apps/[module]/`
2. All models retain their original `db_table` → **zero database changes**
3. Kernel files add backward-compatible re-exports → **zero code breakage**
4. Module code imports `TenantModel` from kernel → **correct dependency direction**

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

### Kernel (cleaned with re-exports)
| File | Infrastructure | Re-exports |
|------|:-:|:-:|
| `erp/models.py` | 18+ models | 25 re-exports |
| `erp/serializers/core.py` | 10 serializers | 27 re-exports |
| `erp/services.py` | 2 services | 10 re-exports |

### New Module Files
| Module | `models.py` | `serializers.py` | `services.py` | `urls.py` |
|--------|:---:|:---:|:---:|:---:|
| finance | ✓ (12) | ✓ (12) | ✓ (7) | ✓ |
| inventory | ✓ (9) | ✓ (11) | ✓ (1) | ✓ |
| pos | ✓ (2) | ✓ (2) | ✓ (2) | ✓ |
| crm | ✓ (1) | ✓ (1) | — | ✓ |
| hr | ✓ (1) | ✓ (1) | — | ✓ |

## Verification
- `python manage.py check` ✓ passes (only pre-existing auth.W004 warning)
- All backward-compatible re-exports verified working
- No circular import issues
- Zero database changes required
