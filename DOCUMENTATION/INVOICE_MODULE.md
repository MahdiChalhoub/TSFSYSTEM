# Invoice Module — Documentation

## Goal
Provide full lifecycle management for Sales and Purchase invoices, including creation, sending, payment tracking, and cancellation. Supports HT/TTC tax modes, multi-currency, FNE/ZATCA e-invoicing fields, and split/partial payments.

## Models

### Invoice (`apps.finance.invoice_models.Invoice`)
**Purpose:** Core invoice record with 7-state lifecycle.

| Field | Type | Description |
|-------|------|-------------|
| `invoice_number` | CharField | Auto-generated via TransactionSequence (e.g., INV-000001) |
| `type` | CharField | SALES, PURCHASE, CREDIT_NOTE, DEBIT_NOTE, PROFORMA |
| `status` | CharField | DRAFT → SENT → PARTIAL_PAID → PAID / OVERDUE / CANCELLED / WRITTEN_OFF |
| `contact` | FK → Contact | Customer or supplier |
| `contact_name/email/address/vat_id` | Snapshot fields | Frozen at creation time |
| `issue_date`, `due_date` | DateField | Issue and payment due dates |
| `payment_terms` | CharField | IMMEDIATE, NET_7/15/30/45/60/90, CUSTOM |
| `display_mode` | CharField | HT (excl. tax) or TTC (incl. tax) |
| `default_tax_rate` | Decimal | Default tax rate for lines |
| `currency`, `exchange_rate` | Multi-currency | Currency code and conversion rate |
| `subtotal_ht`, `tax_amount`, `discount_amount` | Decimal | Calculated from lines |
| `total_amount`, `paid_amount`, `balance_due` | Decimal | Running totals |
| `fne_qr_code`, `zatca_uuid`, `zatca_hash` | TextField | E-invoicing compliance fields |
| `journal_entry` | FK → JournalEntry | GL posting link |

**Key Methods:**
- `recalculate_totals()` — Sums all lines to update subtotal, tax, total, and balance
- `record_payment(amount)` — Updates paid_amount/balance_due and transitions status
- `cancel()` — Moves invoice to CANCELLED state (only if unpaid)
- `save()` — Auto-generates invoice number when status transitions from DRAFT

### InvoiceLine (`apps.finance.invoice_models.InvoiceLine`)
**Purpose:** Individual line items on an invoice.

| Field | Type | Description |
|-------|------|-------------|
| `invoice` | FK → Invoice | Parent invoice |
| `product` | FK → Product (optional) | Product reference |
| `description` | TextField | Line description |
| `quantity`, `unit_price` | Decimal | Quantity and unit price |
| `tax_rate` | Decimal | Line-level tax rate |
| `discount_percent` | Decimal | Line-level discount |
| `line_total_ht`, `tax_amount`, `line_total_ttc` | Decimal | Auto-calculated |

### PaymentAllocation (`apps.finance.invoice_models.PaymentAllocation`)
**Purpose:** Links payments to invoices (many-to-many), enabling split and partial payments.

| Field | Type | Description |
|-------|------|-------------|
| `payment` | FK → Payment | Source payment |
| `invoice` | FK → Invoice | Target invoice |
| `amount_allocated` | Decimal | Amount from payment applied to this invoice |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/finance/invoices/` | List invoices (filterable: type, status, contact_id) |
| POST | `/api/finance/invoices/` | Create invoice (with nested lines) |
| GET | `/api/finance/invoices/{id}/` | Retrieve invoice detail |
| PATCH | `/api/finance/invoices/{id}/` | Update invoice |
| DELETE | `/api/finance/invoices/{id}/` | Delete invoice |
| POST | `/api/finance/invoices/{id}/send_invoice/` | Mark as SENT, auto-generate number |
| POST | `/api/finance/invoices/{id}/record_payment/` | Record payment against invoice |
| POST | `/api/finance/invoices/{id}/cancel_invoice/` | Cancel unpaid invoice |
| POST | `/api/finance/invoices/{id}/add_line/` | Add line item (DRAFT only) |
| GET | `/api/finance/invoices/dashboard/` | Dashboard stats (totals, counts by status) |

## Frontend

### Server Actions (`src/app/actions/finance/invoices.ts`)
- `getInvoices()`, `getInvoice()`, `createInvoice()`, `updateInvoice()`, `deleteInvoice()`
- `sendInvoice()`, `recordInvoicePayment()`, `cancelInvoice()`, `addInvoiceLine()`
- `getInvoiceDashboard()`

### Page (`src/app/(privileged)/finance/invoices/page.tsx`)
- Dashboard cards: Outstanding, Overdue, Collected, Total
- Status-filtered tabs: All, Draft, Sent, Overdue, Paid
- Sortable table with lifecycle action buttons
- Create invoice dialog with type, contact, terms, display mode
- Record payment dialog

### Sidebar
Entry added under Finance → Operations → Invoices

## Data Flow
1. **Read:** Invoices page → `getInvoices()` → `GET /api/finance/invoices/`
2. **Create:** Create dialog → `createInvoice()` → `POST /api/finance/invoices/` → auto-snapshot contact info, calculate due date
3. **Send:** Send button → `sendInvoice()` → `POST .../send_invoice/` → auto-number generated
4. **Payment:** Record Payment → `recordInvoicePayment()` → `POST .../record_payment/` → status auto-transitions
5. **Cancel:** Cancel button → `cancelInvoice()` → `POST .../cancel_invoice/`

## Tables Affected
- **Read from:** `Invoice`, `InvoiceLine`, `PaymentAllocation`, `Contact`, `TransactionSequence`
- **Write to:** `Invoice`, `InvoiceLine`, `PaymentAllocation`, `TransactionSequence`
