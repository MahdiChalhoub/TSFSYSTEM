# HMZ Tax System & Feature Parity

## Goal
Achieve feature parity with the HMZ system by implementing core financial functionalities missing in TSF.

## What Was Implemented

### Phase 1: TaxCalculator Service
- **`apps/finance/tax_calculator.py`** — Centralized tax engine with methods for:
  - `get_tax_mode()`: Resolves HT/TTC mode based on company type
  - `can_reclaim_vat()`: VAT reclaimability per company type
  - `get_airsi_treatment()`: AIRSI tax handling
  - `calculate_tax()`, `calculate_line_tax()`, `calculate_order_tax()`
  - `resolve_effective_cost()`: Effective cost for inventory
- **`TaxGroup` model** in `apps/finance/models.py` — Named tax rate groups (e.g., "Standard VAT 11%")
- **API**: `TaxGroupViewSet` at `/api/tax-groups/`

### Phase 2: Returns & Credit Notes
- **`apps/pos/returns_models.py`** — 5 models:
  - `SalesReturn`, `SalesReturnLine` — Customer return lifecycle
  - `CreditNote` — Auto-generated credit documents
  - `PurchaseReturn`, `PurchaseReturnLine` — Supplier return lifecycle
- **`apps/pos/returns_service.py`** — `ReturnsService`:
  - `create_sales_return()`, `approve_sales_return()`, `cancel_sales_return()`
  - `create_purchase_return()`, `complete_purchase_return()`
  - Restocking, credit note generation, reversing GL entries
- **API**: `/api/sales-returns/`, `/api/credit-notes/`, `/api/purchase-returns/`

### Phase 3: Payments & Collections
- **`apps/finance/payment_models.py`** — 3 models:
  - `Payment` — Universal payment record (supplier/customer/refund)
  - `CustomerBalance` — Running AR per customer
  - `SupplierBalance` — Running AP per supplier
- **`apps/finance/payment_service.py`** — `PaymentService`:
  - `record_supplier_payment()`, `record_customer_receipt()`
  - `release_vat_on_payment()` — Cash-basis VAT
  - `get_aged_receivables()`, `get_aged_payables()`
- **API**: `/api/payments/`, `/api/customer-balances/`, `/api/supplier-balances/`

### Phase 4: Django Signals
- **`apps/pos/signals.py`** — Order lifecycle, return status changes, balance updates
- **`apps/finance/signals.py`** — Payment posted → cash-basis VAT release
- **`apps/inventory/signals.py`** — Stock adjustment/transfer posted

### Phase 5: Advanced Inventory
- **`apps/inventory/advanced_models.py`** — 4 models:
  - `ProductBatch` — Full batch tracking with lifecycle
  - `ProductSerial` — Individual serial number tracking
  - `ExpiryAlert` — Near-expiry/expired notifications
  - `StockValuationEntry` — FIFO/LIFO/AVG with running balance
- **`apps/inventory/valuation_service.py`** — `ValuationService`:
  - `record_stock_in()`, `record_stock_out()`
  - `check_expiry_alerts()`
  - `get_stock_valuation_summary()`

## Data Flow

### Sales Return Flow
1. Customer requests return → `ReturnsService.create_sales_return()`
2. Manager approves → `ReturnsService.approve_sales_return()`
3. System auto: restocks items, creates `CreditNote`, posts reversing GL entry
4. Signal updates customer balance

### Payment Flow
1. Supplier payment → `PaymentService.record_supplier_payment()`
2. GL: Dr. AP → Cr. Cash/Bank
3. Signal: If REAL company + declareTVA → cash-basis VAT release
4. Supplier balance updated

### Stock Valuation Flow
1. Stock in → `ValuationService.record_stock_in()` → running balance updated
2. Stock out → `ValuationService.record_stock_out()` → cost by FIFO/LIFO/AVG
3. Periodic → `ValuationService.check_expiry_alerts()` → alerts generated

## Database Tables Added
| Table | Module | Model |
|-------|--------|-------|
| `taxgroup` | finance | TaxGroup |
| `sales_return` | pos | SalesReturn |
| `sales_return_line` | pos | SalesReturnLine |
| `credit_note` | pos | CreditNote |
| `purchase_return` | pos | PurchaseReturn |
| `purchase_return_line` | pos | PurchaseReturnLine |
| `payment` | finance | Payment |
| `customer_balance` | finance | CustomerBalance |
| `supplier_balance` | finance | SupplierBalance |
| `product_batch` | inventory | ProductBatch |
| `product_serial` | inventory | ProductSerial |
| `expiry_alert` | inventory | ExpiryAlert |
| `stock_valuation_entry` | inventory | StockValuationEntry |

## API Endpoints Added
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tax-groups/` | CRUD | Tax group management |
| `/api/tax-groups/set_default/` | POST | Set default tax group |
| `/api/sales-returns/` | CRUD | Sales return management |
| `/api/sales-returns/create_return/` | POST | Create sales return |
| `/api/sales-returns/{id}/approve/` | POST | Approve + restock + credit note |
| `/api/sales-returns/{id}/cancel/` | POST | Cancel pending return |
| `/api/credit-notes/` | CRUD | Credit note listing |
| `/api/purchase-returns/` | CRUD | Purchase return management |
| `/api/purchase-returns/create_return/` | POST | Create purchase return |
| `/api/purchase-returns/{id}/complete/` | POST | Complete + destock + GL |
| `/api/payments/` | CRUD | Payment records |
| `/api/payments/supplier_payment/` | POST | Record supplier payment |
| `/api/payments/customer_receipt/` | POST | Record customer receipt |
| `/api/payments/aged_receivables/` | GET | Aged AR report |
| `/api/payments/aged_payables/` | GET | Aged AP report |
| `/api/customer-balances/` | CRUD | Customer balance listing |
| `/api/supplier-balances/` | CRUD | Supplier balance listing |
