# Returns & Credit Notes Documentation

## Overview
The Returns module handles the reversal of sales and purchase transactions. It ensures that stock levels are correctly restored/reduced and that financial records (Ledger, Credit/Debit Notes) are accurately updated.

## Pages & Workflows

### 1. Sales Detail Page (`/sales/[id]`)
- **Goal**: Provide a comprehensive view of a historical sale.
- **Data Source**: READ from `pos/orders/` endpoint.
- **Interactions**: Print Invoice, Initiate Return.
- **Workflow**: Linked from Sales History. Allows users to see exactly what was sold before deciding to return items.

### 2. Customer Returns Registry (`/sales/returns`)
- **Goal**: Centralized management of item returns from customers.
- **Data Source**: READ from `pos/sales-returns/` endpoint.
- **Data Saved**: PUT/POST for Approval to `approve/` action.
- **Workflow**:
    1. A return is initiated from a Sale Detail page.
    2. Supervisor reviews the request in this registry.
    3. Clicking "Approve" triggers restocking and generates a Credit Note.

### 3. Supplier Returns Registry (`/purchases/returns`)
- **Goal**: Track items being sent back to suppliers.
- **Data Source**: READ from `pos/purchase-returns/` endpoint.
- **Data Saved**: PUT/POST for Completion to `complete/` action.
- **Workflow**:
    1. Items are identified for return.
    2. Registry tracks PENDING returns.
    3. Clicking "Ship Out" (Complete) reduces inventory levels.

## Database Integration (Logic)
- **SalesReturn**: Linked to `Order`. Stores refunded amount and items.
- **CreditNote**: Automatically generated when a Sales Return is approved.
- **Stock Reversal**: Restocking (Sales) or Destocking (Purchases) occurs upon final status change.

## Lifecycle Statuses
- **PENDING**: New request, awaiting review.
- **APPROVED / COMPLETED**: Action finalized, stock and finances updated.
- **CANCELLED**: Return aborted.
