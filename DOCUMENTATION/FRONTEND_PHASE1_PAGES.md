# Frontend Pages Documentation — Phase 1

## Server Actions Created

### `actions/purchases/purchase-orders.ts`
- **Goal:** Full CRUD + lifecycle for PurchaseOrder model
- **Reads from:** `purchase-orders/` API
- **Saves to:** `purchase-orders/` API (POST, PATCH, DELETE)
- **User interactions:** Create/edit PO, submit, approve, reject, send-to-supplier, receive-line, cancel, mark-invoiced, complete, add/remove lines, view dashboard

### `actions/inventory/stock-alerts.ts`
- **Goal:** CRUD + lifecycle for StockAlert model
- **Reads from:** `stock-alerts/` API
- **Saves to:** `stock-alerts/{id}/acknowledge|resolve|snooze/`, `stock-alerts/scan-all/`
- **User interactions:** View alerts, acknowledge, resolve, snooze, trigger full scan, view dashboard

### `actions/finance/payments.ts` (Updated)
- **Goal:** Extended with invoice allocation actions
- **New endpoints:**
  - `allocatePaymentToInvoice()` → `payments/{id}/allocate-to-invoice/`
  - `getPaymentSummary()` → `payments/{id}/payment-summary/`
  - `checkOverdueInvoices()` → `payments/check-overdue/`
  - `recordPaymentForInvoice()` → `invoices/{id}/record_payment/`

### `actions/finance/invoices.ts` (Updated)
- `recordInvoicePayment()` — updated signature to accept structured data object `{ amount, method?, payment_account_id?, description?, reference? }` instead of bare amount

## Pages Created/Updated

### `purchases/page.tsx` (Rewritten)
- **Goal:** Procurement center with PO dashboard
- **Reads from:** `purchase-orders/`, `purchase-orders/dashboard/`
- **Features:** 10-state status badges, priority indicators, 4 KPI cards (drafts, pending approval, incoming stock, total value), sortable table

### `inventory/alerts/page.tsx` (New)
- **Goal:** Stock alerts dashboard
- **Reads from:** `stock-alerts/`, `stock-alerts/dashboard/`
- **Features:** Severity-based icons, alert type classification, KPI cards (active, critical, acknowledged, resolved today), scan-all button, alert feed with product details

### `finance/invoices/page.tsx` (Updated)
- **Change:** Updated `recordInvoicePayment` call to use new structured data signature

## Routes
| Page | URL |
|------|-----|
| Procurement Center | `/purchases` |
| Stock Alerts | `/inventory/alerts` |
| Invoices | `/finance/invoices` |
