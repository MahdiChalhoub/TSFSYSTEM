# Point of Sale (POS) Integration Workflow

## Goal
To handle real-time retail transactions, ensuring immediate stock reduction, accurate COGS (Cost of Goods Sold) matching via AMC, and automated financial posting to the ledger.

## From where data is READ
- **Inventory**: Checks if item is in stock.
- **Product**: Fetches current selling price, AMC, and tax rate.
- **Posting Rules**: Fetches account mappings for "Sales Revenue", "COGS", "Inventory", and "VAT Payable".

## Where data is SAVED
- **Order / OrderLine**: Records the POS ticket with `type="SALE"`.
- **Inventory**: Reduces stock levels in the specific warehouse/site.
- **InventoryMovement**: Logs an `OUT` movement with the captured AMC.
- **JournalEntry**: 
    - **Physical Step (COGS)**: Dr COGS, Cr Inventory (at AMC).
    - **Financial Step (Revenue)**: Dr Cash/Card, Cr Sales Revenue, Cr VAT Payable.

## Step-by-step workflow
1.  **Selection**: Checkout clerk scans or selects items.
2.  **Payment**: Total amount is calculated (Price + Tax). Clerk selects "Cash" or "Card".
3.  **Checkout (Atomic)**:
    - Order is created in `COMPLETED` status.
    - Each item's stock is reduced via `InventoryService.reduce_stock`.
    - Captured AMC from `reduce_stock` is stored in the `OrderLine` for margin analysis.
    - Financial journal entry is posted automatically.
4.  **Completion**: POS Ticket is finalized, and stock is immediately updated globally.

## How the system achieves its goal
By tightly coupling the POS checkout with the `InventoryService` and `LedgerService`, the system ensures that "The book reflects the shelf." Every scanner beep triggers a full accounting chain from the warehouse shelf to the P&L report, maintaining both Operational and Financial integrity in real-time.
