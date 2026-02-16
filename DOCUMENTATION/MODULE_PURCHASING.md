# MODULE: Purchase Order & RFQ System

## Goal
The goal of this module is to formalize the procurement process, allowing the user to manage Request for Quotations (RFQ), convert them to Purchase Orders (PO), receive goods physically, and reconcile vendor bills.

## Data Flow
### READ
- **Suppliers**: From CRM `Contact` model.
- **Products**: From Inventory `Product` model.
- **Sites/Warehouses**: From ERP configuration.
- **Orders**: From POS `Order` model (type PURCHASE).

### SAVED
- **Order/OrderLines**: Stored in POS module.
- **Inventory/Batches**: Updated upon "Reception".
- **Journal Entries**: Posted upon "Reception" (Accrued reception) and "Invoicing" (Accounts Payable).

## Status Lifecycle
1. **DRAFT (RFQ)**: Negotiation phase. No stock or accounting impact.
2. **AUTHORIZED (PO)**: Order confirmed with vendor.
3. **RECEIVED**: Goods received at warehouse. 
    - *Accounting*: Debit Inventory, Credit Accrued Reception (Liability).
    - *Stock*: Increases quantity on hand.
4. **INVOICED**: Vendor bill received and matched.
    - *Accounting*: Debit Accrued Reception, Credit Accounts Payable.

## User Interactions
- **Procurement Center (`/purchases`)**: Unified dashboard to track all procurement activities.
- **New RFQ (`/purchases/new-order`)**: Multi-item form to specify needs and negotiate prices.
- **Order Detail (`/purchases/[id]`)**: Hub for state transitions (Confirm, Receive, Invoice).
- **Quick Purchase (`/purchases/new`)**: Rapid stock entry for immediate purchases.

## Implementation Details
- Uses `PurchaseService` for transaction-heavy logic.
- Integrates with `LedgerService` for specialized procurement accounting entries.
- Supports `Scope-Aware` reporting (Official vs Internal).
