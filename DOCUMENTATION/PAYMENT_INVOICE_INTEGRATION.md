# Payment & Invoice Integration Documentation

## Goal
Enable proper payment recording, allocation, and auto-status transitions for invoices.

## Service: InvoiceService (`finance/invoice_service.py`)

### Methods
| Method | Purpose |
|--------|---------|
| `allocate_payment(payment, invoice, amount)` | Allocate part/all of a payment to an invoice. Validates unallocated balance and invoice balance_due. |
| `record_payment_for_invoice(invoice, amount, method, payment_account_id, ...)` | Creates a Payment record and immediately allocates it to the invoice. |
| `check_overdue_invoices(organization)` | Scans invoices past due_date with status SENT/PARTIAL_PAID and marks them OVERDUE. |
| `get_invoice_payment_summary(invoice)` | Returns all allocations for an invoice with payment details. |

## Auto-Status Transitions (Invoice)
```
DRAFT → (send) → SENT
SENT → (partial payment) → PARTIAL_PAID
SENT/PARTIAL_PAID → (full payment) → PAID (sets paid_at)
SENT/PARTIAL_PAID → (past due_date) → OVERDUE
DRAFT/SENT/OVERDUE → (cancel) → CANCELLED
```

## Data Flow

### PaymentViewSet Endpoints
| Endpoint | Description |
|----------|-------------|
| `POST /api/payments/supplier_payment/` | Create supplier payment with GL entry |
| `POST /api/payments/customer_receipt/` | Create customer receipt with GL entry |
| `POST /api/payments/{id}/allocate-to-invoice/` | Allocate existing payment to invoice |
| `GET /api/payments/{id}/payment-summary/` | View all allocations for a payment |
| `POST /api/payments/check-overdue/` | Trigger overdue detection scan |
| `GET /api/payments/aged_receivables/` | Customer aging report |
| `GET /api/payments/aged_payables/` | Supplier aging report |

### InvoiceViewSet Endpoints
| Endpoint | Description |
|----------|-------------|
| `POST /api/invoices/{id}/record_payment/` | Record payment (creates Payment + allocation if payment_account_id provided) |
| `POST /api/invoices/{id}/send_invoice/` | Mark as SENT |
| `POST /api/invoices/{id}/cancel_invoice/` | Cancel unpaid invoice |
| `POST /api/invoices/{id}/add_line/` | Add line to DRAFT |
| `GET /api/invoices/dashboard/` | Invoice summary stats |

## Tables Affected
- `payment` — Payment records
- `payment_allocation` — Payment ↔ Invoice allocations
- `invoice` — Status and paid_amount updates

## Relationships
- `Payment.invoice` → `Invoice` (optional direct link)
- `PaymentAllocation.payment` → `Payment`
- `PaymentAllocation.invoice` → `Invoice`
