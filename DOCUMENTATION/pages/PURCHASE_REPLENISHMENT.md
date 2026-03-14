# Documentation: Purchase Replenishment (Quick Purchase)

## Goal
To record a purchase invoice from a supplier, update stock levels, calculate effective costs, and generate financial ledger entries in a single step.

## From where data is READ
- **Suppliers**: Read from `contacts/?type=SUPPLIER`.
- **Warehouses**: Read from `warehouses/`.
- **Products**: Read from `products/` (for line selection).
- **Settings**: Read from backend `ConfigurationService` (pricing cost basis).

## Where data is SAVED
- **Order**: Saved in `Order` table with status `COMPLETED`.
- **Inventory**: Updated via `Inventory` table (increments matching batch/warehouse).
- **Products**: Backend updates `cost_price`, `selling_price_ht`, and `selling_price_ttc`.
- **Journal Entries**: Saved in `JournalEntry` and `JournalEntryLine` tables (AP Credit, Inventory/Tax Debit).

## Variables user interacts with
- `supplierId`: The source supplier.
- `warehouseId`: Destination warehouse for stock.
- `scope`: Official vs Internal.
- `vatRecoverable`: Determines if tax is moved to a separate tax account or capitalized into inventory cost.
- `lines`: Array of items with quantities, costs, and selling prices.

## Step-by-step workflow
1. User enters supplier and warehouse details.
2. User adds products to the grid.
3. For each product, user enters quantities and cost prices (HT or TTC).
4. System calculates totals and tax.
5. User submits the form.
6. Frontend calls `createPurchaseInvoice` action.
7. Action sends payload to backend `purchases/quick_purchase/`.
8. Backend `PurchaseService.quick_purchase` executes:
    *   Calculates effective cost based on global settings.
    *   Creates the COMPLETED order.
    *   Updates stock batches and inventory levels.
    *   Generates a balanced Journal Entry (AP vs Stock vs VAT).
9. User is redirected to the purchases list.

## How the page achieves its goal
By consolidating inventory reception and financial invoicing into one atomic backend transaction, it prevents desynchronization between stock counts and ledger balances.
