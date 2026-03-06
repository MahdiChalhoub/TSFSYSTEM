# Module Documentation Lookup

Retrieve comprehensive documentation for a specific ERP module.

## Usage

```bash
/module-doc [module-name]
```

**Arguments**:
- `module-name` (required): finance, inventory, pos, sales, crm, hr, ecommerce, purchase, workspace

---

## What This Command Does

1. Reads `DOCUMENTATION/MODULE_{MODULE}.md`
2. Reads `.agents/modules/{module-name}.md` (specialist definition)
3. Lists backend structure (`erp_backend/apps/{module}/`)
4. Lists frontend structure (`src/app/(privileged)/{module}/`)
5. Identifies key TypeScript types
6. Summarizes API endpoints
7. Lists common gotchas from `LESSONS_LEARNED.md`

---

## Example Output

```
📚 Module Documentation: FINANCE

## Overview
The Finance module handles all financial operations including:
- Tax calculations (inclusive/exclusive, multi-rate)
- Currency management and conversion
- Invoice generation and management
- Payment processing and reconciliation
- Chart of Accounts (COA)
- Journal entries and double-entry bookkeeping
- Financial reporting (P&L, Balance Sheet, Cash Flow)

## Module Specialist
**Agent**: finance-agent (uses finance-custodian specialist)
**Expertise**: Tax, currency, invoices, payments, accounting
**Invoke with**: `/finance [task]` or let module-bridge coordinate

## File Structure

### Backend (`erp_backend/apps/finance/`)
```
finance/
├── models/
│   ├── invoice_models.py      # Invoice, InvoiceLine
│   ├── payment_models.py      # Payment, PaymentMethod
│   ├── tax_models.py          # Tax, TaxRate
│   ├── currency_models.py     # Currency, ExchangeRate
│   ├── journal_models.py      # JournalEntry, JournalLine
│   └── account_models.py      # Account, AccountType (COA)
├── views/
│   ├── invoice_views.py       # Invoice CRUD
│   ├── payment_views.py       # Payment processing
│   ├── tax_views.py           # Tax management
│   ├── report_views.py        # Financial reports
│   └── journal_views.py       # Journal entry views
├── serializers/
│   └── finance_serializers.py # DRF serializers
├── services/
│   ├── tax_engine.py          # Tax calculation logic
│   ├── currency_service.py    # Currency conversion
│   ├── journal_service.py     # Double-entry logic
│   └── invoice_service.py     # Invoice generation
├── migrations/
└── tests/
```

### Frontend (`src/app/(privileged)/finance/`)
```
finance/
├── invoices/
│   ├── page.tsx               # Invoice list
│   ├── [id]/
│   │   └── page.tsx           # Invoice detail
│   └── new/
│       └── page.tsx           # Create invoice
├── payments/
│   ├── page.tsx               # Payment list
│   └── [id]/
│       └── page.tsx           # Payment detail
├── taxes/
│   └── page.tsx               # Tax configuration
├── reports/
│   ├── page.tsx               # Report dashboard
│   ├── profit-loss/
│   │   └── page.tsx           # P&L report
│   └── balance-sheet/
│       └── page.tsx           # Balance sheet
└── settings/
    ├── currencies/
    │   └── page.tsx           # Currency management
    └── accounts/
        └── page.tsx           # Chart of Accounts
```

### Components (`src/components/finance/`)
```
InvoiceCard.tsx
InvoiceForm.tsx
InvoiceTable.tsx
PaymentForm.tsx
TaxCalculator.tsx
CurrencySelector.tsx
JournalEntryViewer.tsx
ReportFilters.tsx
```

### TypeScript Types (`src/types/finance.ts`)
```typescript
interface Invoice {
  id: number
  invoice_number: string
  customer: Customer
  currency: string
  subtotal: string  // Decimal as string
  tax_amount: string
  total: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  lines: InvoiceLine[]
}

interface Payment {
  id: number
  invoice: Invoice
  amount: string  // Decimal as string
  currency: string
  method: PaymentMethod
  reference?: string
  date: string
}

interface Tax {
  id: number
  name: string
  rate: string  // Decimal as string (0.15 for 15%)
  type: 'inclusive' | 'exclusive'
  is_active: boolean
}
```

## API Endpoints

### Invoices
- `GET /api/finance/invoices/` - List invoices (paginated, filterable)
- `POST /api/finance/invoices/` - Create invoice
- `GET /api/finance/invoices/:id/` - Get invoice detail
- `PUT /api/finance/invoices/:id/` - Update invoice
- `DELETE /api/finance/invoices/:id/` - Delete invoice (soft delete)
- `POST /api/finance/invoices/:id/send/` - Send invoice to customer
- `POST /api/finance/invoices/:id/mark-paid/` - Mark as paid

### Payments
- `GET /api/finance/payments/` - List payments
- `POST /api/finance/payments/` - Record payment
- `GET /api/finance/payments/:id/` - Get payment detail
- `POST /api/finance/payments/:id/refund/` - Process refund

### Taxes
- `GET /api/finance/taxes/` - List tax rates
- `POST /api/finance/taxes/` - Create tax rate
- `PUT /api/finance/taxes/:id/` - Update tax rate

### Reports
- `GET /api/finance/reports/profit-loss/` - P&L report (date range)
- `GET /api/finance/reports/balance-sheet/` - Balance sheet (as of date)
- `GET /api/finance/reports/cash-flow/` - Cash flow statement

## Key Services

### TaxEngine (`services/tax_engine.py`)
```python
class TaxEngine:
    @staticmethod
    def calculate_tax(
        amount: Decimal,
        tax_rate: Decimal,
        is_inclusive: bool
    ) -> Decimal:
        \"\"\"
        Calculate tax amount.

        Inclusive: tax = amount - (amount / (1 + rate))
        Exclusive: tax = amount * rate
        \"\"\"
```

### CurrencyService (`services/currency_service.py`)
```python
class CurrencyService:
    @staticmethod
    def convert(
        amount: Decimal,
        from_currency: str,
        to_currency: str,
        date: Optional[date] = None
    ) -> Decimal:
        \"\"\"Convert amount from one currency to another.\"\"\"
```

### JournalService (`services/journal_service.py`)
```python
class JournalService:
    @staticmethod
    def create_invoice_journal_entry(invoice: Invoice) -> JournalEntry:
        \"\"\"
        Create double-entry journal for invoice.

        DR Accounts Receivable
        CR Revenue
        CR Tax Payable (if applicable)
        \"\"\"
```

## Common Gotchas (from LESSONS_LEARNED.md)

1. **Decimal Precision**
   - ALWAYS use Decimal, never float
   - Round to 2 decimal places for display: `amount.quantize(Decimal('0.01'))`
   - Backend uses `decimal.Decimal`, frontend uses string representation

2. **Currency Handling**
   - Store amounts with currency code
   - Never assume default currency
   - Use CurrencyService for ALL conversions
   - Rounding happens AFTER conversion

3. **Tax Calculation**
   - Inclusive tax: `tax = subtotal - (subtotal / (1 + rate))`
   - Exclusive tax: `tax = subtotal * rate`
   - Multi-rate: calculate per line, then sum
   - Round each line's tax, then sum (don't sum then round)

4. **Journal Entries**
   - MUST balance (debits = credits)
   - Use JournalService, don't create manually
   - Include tenant context in all entries
   - Audit log ALL journal modifications

5. **Invoice States**
   - Draft → Sent → Paid (normal flow)
   - Can't delete if payments exist (only soft delete)
   - Can't edit after "Sent" (must create credit note)
   - Overdue calculated client-side (due_date < today && status != 'paid')

## Security Considerations

- All endpoints require `finance.view_invoice`, `finance.add_invoice`, etc.
- Tenant isolation via `request.tenant` filter
- Audit logging via `AuditLogMixin` on all models
- Payment information logged (but card details are NEVER stored)
- Journal entries are immutable (soft delete only)

## Testing

Run finance-specific tests:
```bash
npm run typecheck:finance
npm run test  # Includes finance module tests
bash scripts/agent-verify.sh finance
```

## Related Modules

- **CRM**: Customer data for invoices
- **Inventory**: Product data for invoice lines
- **POS**: Payment processing integration
- **Ecommerce**: Online payment gateway integration

---

**Last Updated**: 2026-03-03
**Maintainer**: finance-agent (uses finance-custodian specialist)
```

---

## Available Modules

| Module | Backend App | Frontend Path | Specialist Agent |
|--------|-------------|---------------|------------------|
| finance | `apps/finance/` | `(privileged)/finance/` | finance-agent |
| inventory | `apps/inventory/` | `(privileged)/inventory/` | inventory-agent |
| pos | `apps/pos/` | `(privileged)/sales/pos-*` | sales-agent |
| sales | `apps/pos/` | `(privileged)/sales/` | sales-agent |
| crm | `apps/crm/` | `(privileged)/crm/` | crm-agent |
| hr | `apps/hr/` | `(privileged)/hr/` | hr-agent |
| ecommerce | `apps/ecommerce/` | `(privileged)/ecommerce/` | ecommerce-agent |
| purchase | `apps/procurement/` (TBD) | `(privileged)/purchase/` (TBD) | purchase-agent |
| workspace | `apps/workspace/` | `(privileged)/workspace/` | (general) |

---

## Related Commands

- `/preflight` - Research protocol before working on module
- `/verify-module [module]` - Run verification pipeline
- `/[module] [task]` - Invoke module agent directly
- `/bug-hunt` - Debug module-specific issues

---

**Pro Tip**: Run `/module-doc [module]` before starting ANY work on that module.
