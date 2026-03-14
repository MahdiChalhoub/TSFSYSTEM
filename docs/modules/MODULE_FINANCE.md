# Finance Module

## Overview
The Finance module provides comprehensive financial management capabilities including:
- Chart of Accounts (COA) management
- Journal entries and double-entry accounting
- Multi-currency support with real-time conversion
- Tax calculation engine (inclusive/exclusive, multi-jurisdiction)
- Invoicing (sales and purchase)
- Payment processing and reconciliation
- Financial reporting and analytics
- Bank reconciliation
- Asset management
- Loan tracking
- Budget management

**Location**: `erp_backend/apps/finance/` + `src/app/(privileged)/finance/`

## Features

### Core Capabilities
- **Chart of Accounts**: Hierarchical account structure with templates (IFRS, GAAP, etc.)
- **Double-Entry Accounting**: Automatic journal entry creation with balance validation
- **Multi-Currency**: Support for 100+ currencies with automatic conversion
- **Tax Engine**: Complex tax calculations with jurisdictions, rates, and rules
- **Invoicing**: Create, send, and track invoices with payment status
- **Bank Reconciliation**: Match transactions with bank statements
- **Financial Reporting**: Balance sheet, P&L, cash flow, trial balance
- **Budget Management**: Create and track budgets vs actuals
- **Asset Tracking**: Fixed assets with depreciation schedules
- **Loan Management**: Track loans, repayments, and interest

### Advanced Features
- COA templates (IFRS, GAAP, industry-specific)
- Tax compliance for 50+ jurisdictions
- Multi-company consolidation
- Intercompany transactions
- Automated posting rules
- Recurring invoices and payments
- Payment terms and credit limits
- Early payment discounts
- Late payment fees and reminders

## Models

### FinancialAccount
Main chart of accounts model.

**Key Fields**:
- `code` - Account code (e.g., "1010")
- `name` - Account name
- `account_type` - ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
- `parent` - Parent account for hierarchy
- `is_control` - Whether account has sub-accounts
- `currency` - Default currency for account
- `organization` - Tenant isolation

**Key Methods**:
- `get_balance(date=None)` - Get account balance at specific date
- `get_children()` - Get child accounts
- `get_full_code()` - Get hierarchical code (e.g., "1010.001")

### JournalEntry
Records all financial transactions.

**Key Fields**:
- `entry_number` - Auto-generated sequence
- `entry_date` - Transaction date
- `description` - Entry description
- `reference` - External reference (invoice#, PO#, etc.)
- `currency` - Entry currency
- `status` - DRAFT, POSTED, VOID
- `organization` - Tenant isolation

**Key Methods**:
- `post()` - Post entry (makes it immutable)
- `void()` - Void entry (creates reversing entry)
- `is_balanced()` - Validate debits = credits

### JournalLine
Individual debit/credit lines.

**Key Fields**:
- `journal_entry` - Parent entry
- `account` - Financial account
- `debit` - Debit amount
- `credit` - Credit amount
- `description` - Line description
- `cost_center` - Optional cost center
- `analytic_tags` - Optional tags

### Invoice
Sales and purchase invoices.

**Key Fields**:
- `invoice_number` - Auto-generated
- `invoice_type` - SALES, PURCHASE
- `invoice_date` - Invoice date
- `due_date` - Payment due date
- `customer` / `supplier` - Contact reference
- `currency` - Invoice currency
- `subtotal`, `tax`, `total` - Amounts
- `payment_status` - UNPAID, PARTIAL, PAID, OVERDUE
- `journal_entry` - Auto-created journal entry

**Key Methods**:
- `calculate_totals()` - Recalculate all amounts
- `apply_tax()` - Apply tax rules
- `record_payment(amount)` - Record partial/full payment
- `send_email()` - Email invoice to customer
- `generate_pdf()` - Create PDF invoice

### TaxRule
Tax calculation rules.

**Key Fields**:
- `name` - Tax name (e.g., "VAT 20%")
- `rate` - Tax rate (e.g., 0.20)
- `tax_type` - SALES, PURCHASE, BOTH
- `calculation_method` - INCLUSIVE, EXCLUSIVE
- `jurisdiction` - Country/region
- `account` - GL account for tax payable/receivable

**Key Methods**:
- `calculate(amount)` - Calculate tax on amount
- `get_effective_rate(date)` - Get rate effective on date

## API Endpoints

### GET /api/finance/accounts/
List chart of accounts.

**Auth**: Required
**Permissions**: `finance.view_account`
**Query Params**:
- `account_type` - Filter by type (ASSET, LIABILITY, etc.)
- `parent` - Filter by parent account
- `is_control` - Filter control accounts

**Returns**:
```json
{
  "count": 150,
  "results": [
    {
      "id": 1,
      "code": "1010",
      "name": "Cash",
      "account_type": "ASSET",
      "balance": 50000.00,
      "currency": "USD"
    }
  ]
}
```

### POST /api/finance/journal-entries/
Create journal entry.

**Auth**: Required
**Permissions**: `finance.create_journalentry`
**Body**:
```json
{
  "entry_date": "2026-03-14",
  "description": "Payment for services",
  "lines": [
    {"account_id": 10, "debit": 1000.00, "description": "Expense"},
    {"account_id": 20, "credit": 1000.00, "description": "Cash"}
  ]
}
```

**Returns**: Created entry with auto-generated entry_number

### GET /api/finance/reports/balance-sheet/
Generate balance sheet.

**Auth**: Required
**Permissions**: `finance.view_reports`
**Query Params**:
- `date` - As of date (default: today)
- `currency` - Reporting currency (default: base currency)
- `format` - json, pdf, xlsx

**Returns**: Balance sheet with assets, liabilities, equity

### POST /api/finance/invoices/{id}/record-payment/
Record payment on invoice.

**Auth**: Required
**Permissions**: `finance.create_payment`
**Body**:
```json
{
  "amount": 500.00,
  "payment_date": "2026-03-14",
  "payment_method": "BANK_TRANSFER",
  "reference": "TXN123456"
}
```

**Returns**: Updated invoice with new payment_status

## Business Logic

### Double-Entry Validation
All journal entries MUST balance (debits = credits). System validates before posting.

```python
def validate_journal_entry(entry):
    """Ensure debits equal credits."""
    total_debits = sum(line.debit for line in entry.lines.all())
    total_credits = sum(line.credit for line in entry.lines.all())

    if abs(total_debits - total_credits) > 0.01:  # Allow 1 cent rounding
        raise ValidationError(f"Entry out of balance: {total_debits} != {total_credits}")
```

### Tax Calculation
Supports inclusive and exclusive tax calculations.

**Exclusive Tax** (US/Canada):
- Subtotal: $100.00
- Tax (10%): $10.00
- Total: $110.00

**Inclusive Tax** (EU VAT):
- Total: $110.00
- Tax (10%): $10.00
- Net: $100.00

### Multi-Currency Conversion
All amounts stored in local currency + base currency for reporting.

```python
def convert_currency(amount, from_currency, to_currency, date=None):
    """Convert amount between currencies using exchange rate."""
    rate = get_exchange_rate(from_currency, to_currency, date)
    return amount * rate
```

## Events Published

### `finance.invoice_created`
Fired when new invoice is created.

**Payload**:
```json
{
  "invoice_id": 123,
  "invoice_type": "SALES",
  "customer_id": 45,
  "total": 1500.00,
  "currency": "USD"
}
```

**Subscribers**: CRM (update customer balance), Inventory (reserve stock)

### `finance.payment_received`
Fired when payment is recorded.

**Payload**:
```json
{
  "invoice_id": 123,
  "amount": 500.00,
  "payment_method": "BANK_TRANSFER"
}
```

**Subscribers**: Accounting (create journal entry), Notifications (email receipt)

### `finance.journal_posted`
Fired when journal entry is posted.

**Payload**:
```json
{
  "entry_id": 789,
  "entry_number": "JE-2026-001",
  "total_amount": 1000.00
}
```

**Subscribers**: Audit log, Reporting (update cached balances)

## Events Consumed

### `pos.sale_completed`
Creates sales invoice from POS transaction.

**Trigger**: POS module completes sale
**Action**: Auto-create invoice + journal entry

### `inventory.stock_received`
Creates purchase invoice from goods receipt.

**Trigger**: Inventory module receives goods
**Action**: Create purchase invoice (if linked to PO)

## Configuration

### Settings

**`FINANCE_BASE_CURRENCY`**: Default currency for organization (e.g., "USD")
**`FINANCE_AUTO_POST_INVOICES`**: Auto-post invoices on creation (default: False)
**`FINANCE_INVOICE_NUMBER_PREFIX`**: Prefix for invoice numbers (e.g., "INV-")
**`FINANCE_TAX_INCLUSIVE_DEFAULT`**: Default tax calculation method (default: False)
**`FINANCE_ALLOW_NEGATIVE_BALANCES`**: Allow overdrafts (default: False)

### Kernel Config

```python
from kernel.config import get_config

# Get invoice prefix from kernel.config (overrides settings)
prefix = get_config('finance.invoice_prefix', default='INV-')

# Get auto-posting behavior
auto_post = get_config('finance.auto_post', default=False, config_type='bool')
```

## Testing

### Unit Tests
Run finance module tests:
```bash
python manage.py test apps.finance
```

### Business Logic Tests
Frontend tests for finance calculations:
```bash
npm run test -- src/__tests__/business/finance
```

### Integration Tests
Full invoice creation flow:
```bash
python manage.py test apps.finance.tests.test_invoice_flow
```

## Common Workflows

### Creating an Invoice

1. **Create Invoice**:
   ```python
   invoice = Invoice.objects.create(
       organization=request.tenant,
       invoice_type=InvoiceType.SALES,
       customer=customer,
       invoice_date=date.today(),
       currency='USD'
   )
   ```

2. **Add Line Items**:
   ```python
   InvoiceLine.objects.create(
       invoice=invoice,
       description='Consulting Services',
       quantity=10,
       unit_price=100.00,
       tax_rule=tax_rule
   )
   ```

3. **Calculate Totals**:
   ```python
   invoice.calculate_totals()  # Calculates subtotal, tax, total
   invoice.save()
   ```

4. **Post to Accounting**:
   ```python
   invoice.post()  # Creates journal entry, posts to GL
   ```

### Recording a Payment

1. **Create Payment**:
   ```python
   payment = invoice.record_payment(
       amount=500.00,
       payment_date=date.today(),
       payment_method='BANK_TRANSFER',
       reference='TXN123'
   )
   ```

2. **System Auto-Creates**:
   - Journal entry (DR Cash, CR Accounts Receivable)
   - Updates invoice payment_status
   - Emits `finance.payment_received` event

### Generating Reports

1. **Balance Sheet**:
   ```python
   from apps.finance.reports import BalanceSheetReport
   report = BalanceSheetReport(organization, as_of_date=date.today())
   data = report.generate()
   ```

2. **Profit & Loss**:
   ```python
   from apps.finance.reports import ProfitLossReport
   report = ProfitLossReport(organization, start_date, end_date)
   data = report.generate()
   ```

---

**Last Updated**: 2026-03-14
**Module Owner**: Finance Team
**Status**: Production Ready
**Version**: 3.1.0
