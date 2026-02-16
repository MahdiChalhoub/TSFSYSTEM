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

### Procurement Lifecycle & Accounting

The dedicated purchase order system follows a 4-stage lifecycle ensuring physical and financial integrity:

1.  **DRAFT (RFQ)**: Request for Quotation. No accounting or stock impact.
2.  **AUTHORIZED (PO)**: Confirmed order. Becomes a legal commitment.
3.  **RECEIVED (Stock Entry)**:
    - **Physical**: Stock levels increase in the target warehouse.
    - **Financial**: `Debit Inventory` / `Credit Accrued Reception` (Suspense Liability).
    - **Partial Support**: Orders can stay in `PARTIAL_RECEIVED` status until fully delivered.
4.  **INVOICED (Vendor Bill)**:
    - **Closing the Loop**: `Debit Accrued Reception` / `Credit Accounts Payable`.
    - Matches physical receptions to financial liabilities.

### User Interaction Workflow

- **Procurement Center**: Unified dashboard at `/purchases` to track all procurement KPIs.
- **Formal RFQ Form**: `/purchases/new-order` for line-by-line negotiations.
- **Document Printing**: HIGH-FIDELITY PDF generation for RFQs and POs via the "Print" action.
- **Receiving Interface**: Select warehouse and confirm reception on the PO detail page.

### Accounting Posting Rules (Mandatory Configuration)

Ensure the following accounts are mapped in `Settings > Posting Rules`:
- `purchases.inventory`: Target account for stock value.
- `suspense.reception`: Liability account for accrued receptions (Clears on invoice).
- `purchases.payable`: Final account for vendor liabilities (Accounts Payable).

## Implementation Details
- Uses `PurchaseService` for transaction-heavy logic.
- Integrates with `LedgerService` for specialized procurement accounting entries.
- Supports `Scope-Aware` reporting (Official vs Internal).
