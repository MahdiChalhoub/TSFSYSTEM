# Aging Report (Receivables & Payables)

## Goal
Show outstanding receivables (customers owe you) and payables (you owe suppliers) broken down into aging buckets: Current (0-30 days), 31-60 days, 61-90 days, and 90+ days.

## Page: `/finance/aging`

### Data READ
- `GET /finance/payments/aged_receivables/` — customer aging from completed/invoiced SALE orders
- `GET /finance/payments/aged_payables/` — supplier aging from completed/invoiced PURCHASE orders

### Data SAVED
- No writes from this page (read-only report)

### Variables
- **tab**: `receivables` | `payables`
- **activeBucket**: `null` (all) | `current` | `31_60` | `61_90` | `over_90`

### Workflow
1. Page loads → fetches both AR and AP data in parallel
2. User toggles between Receivables (AR) and Payables (AP)
3. 4 KPI cards show totals per bucket with progress bars
4. Stacked bar shows proportional distribution
5. Click any KPI card to filter the detail table to that bucket
6. Detail table shows: Order ID, Customer/Supplier, Amount, Days old, Date, Bucket

### How It Works
- Backend queries all COMPLETED/INVOICED orders, calculates remaining balance (total - paid)
- Groups by age bucket based on days since order creation
- Frontend displays with interactive filtering

## Files
- `erp_backend/apps/finance/payment_service.py` — `get_aged_receivables()`, `get_aged_payables()`
- `erp_backend/apps/finance/views.py` — `PaymentViewSet.aged_receivables`, `.aged_payables`
- `src/app/actions/finance/reports.ts` — Server actions
- `src/app/(privileged)/finance/aging/page.tsx` — Aging report page
- `src/components/admin/Sidebar.tsx` — Added "Aging Report" under Finance > Reports
