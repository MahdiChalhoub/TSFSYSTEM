# Purchase Order (PO) Workflow

## Goal
To manage the lifecycle of a purchase from initial commitment to stock reception and final financial settlement, ensuring inventory and debt (AP) are correctly reflected in the dual-view ledger.

## From where data is READ
- **Supplier Info**: `Contact` details including payment terms.
- **Product Details**: Buying unit, default cost, and tax rate.
- **System Configuration**: Posting rules for "Accrued Reception" and "Accounts Payable".

## Where data is SAVED
- **Order / OrderLine**: Initial PO details and status updates.
- **Inventory**: Increased stock counts upon reception.
- **JournalEntry**: 
    - **Physical Step**: Dr Inventory, Cr Accrued Reception.
    - **Financial Step**: Dr Accrued Reception, Cr Accounts Payable.

## Step-by-step workflow
1.  **Drafting**: Create a `PURCHASE` type `Order` with status `DRAFT`.
2.  **Authorization**: Mark as `AUTHORIZED`. This locks the quantities and prices.
3.  **Reception**: Record a Physical Reception.
    - System calls `InventoryService.receive_stock`.
    - Inventory increases.
    - Ledger records a liability to receive an invoice (Accrued Reception).
    - Status moves to `RECEIVED`.
4.  **Invoicing**: Receive the supplier's financial invoice.
    - User enters the real invoice date and number.
    - System clears the "Accrued Reception" and moves the liability to "Accounts Payable".
    - Status moves to `INVOICED`.

## How the system achieves its goal
By splitting the reception (physical) from the invoicing (financial), the system provides an accurate view of "Goods in Transit" and "Outstanding Liabilities" even if the supplier sends the invoice weeks after the delivery. This is critical for accurate AMC costing and matching principles.
