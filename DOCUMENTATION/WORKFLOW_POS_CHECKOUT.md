# POS Checkout Workflow

## Goal
To process a retail sale (Point of Sale) efficiently, ensuring real-time stock reduction, precise revenue recognition, and accurate cash/bank account updates in the General Ledger.

## From where data is READ
- **Product Catalog**: `Product` table (price, tax rate, barcodes).
- **Inventory/Stock**: `Inventory` table (availability check).
- **Customer**: `User` (Staff) or `Contact` (Customer) - *Optional*.
- **Payment Method**: `FinancialAccount` table (linked Ledger Account).
- **Posting Rules**: `SystemSettings` (revenue, cogs, inventory, tax mapping).

## Where data is SAVED
- **Order History**: `Order` and `OrderLine` tables (Sales record).
- **Journal**: `JournalEntry` and `JournalEntryLine` tables (Financial record).
- **Stock Movement**: `Inventory` (quantity update) and `InventoryMovement` (audit trail).
- **Cash Balance**: `FinancialAccount` (balance update via Ledger).

## Variables user interacts with
- **Cart Items**: List of products and quantities.
- **Warehouse**: The location where stock is deducted.
- **Payment Method**: Cash, Card, etc. (Maps to a Financial Account).

## Step-by-step Workflow
1.  **Cart Assembly**: User scans barcodes or searches products.
2.  **Stock Check**: System verifies efficient quantity (Backend validation).
3.  **Checkout Request**: Frontend sends `items`, `warehouse_id`, `payment_account_id`.
4.  **Transaction Processing (Atomic)**:
    -   **Stock Reduction**: `InventoryService` reduces quantity and returns the current Average Moving Cost (AMC).
    -   **Order Creation**: System creates an `Order` (Type: SALE, Status: COMPLETED).
    -   **Financial Calculation**: Calculates Tax (VAT) and Cost of Goods Sold (COGS).
    -   **Ledger Posting**: `LedgerService` creates a balanced Journal Entry:
        -   **Debit**: Cash/Bank (Asset) - *Increases Asset*
        -   **Credit**: Sales Revenue (Income) - *Increases Income*
        -   **Credit**: VAT Payable (Liability) - *Increases Liability*
        -   **Debit**: COGS (Expense) - *Increases Expense*
        -   **Credit**: Inventory (Asset) - *Decreases Asset*
5.  **Completion**: API returns success with Order ID.

## How the page achieves its goal
The POS interface calls `POST /api/pos/checkout/`, triggering the `POSService.checkout` method. This method acts as an orchestrator, invoking `InventoryService` for logistics and `LedgerService` for accounting within a single atomic database transaction to guarantee data integrity.
