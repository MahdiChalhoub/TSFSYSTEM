# Direct Expenses Page

## Goal
Record and manage day-to-day operational expenses with immediate recognition — the counterpart to Deferred Expenses.

## Data Flow

### READ from
- `GET /api/finance/expenses/` → list all direct expenses
- `GET /api/finance/accounts/` → financial accounts (for source account dropdown)

### WRITE to
- `POST /api/finance/expenses/` → create new expense (auto-generates reference via TransactionSequence)
- `PATCH /api/finance/expenses/{id}/` → update draft expense
- `DELETE /api/finance/expenses/{id}/` → delete draft expense
- `POST /api/finance/expenses/{id}/post_expense/` → post expense (creates journal entry + financial event)
- `POST /api/finance/expenses/{id}/cancel_expense/` → cancel draft expense

## Database Table: `directexpense`

| Column | Type | Purpose |
|--------|------|---------|
| name | CharField(200) | Expense description |
| category | CharField(50) | RENT, UTILITIES, OFFICE_SUPPLIES, SALARIES, MAINTENANCE, TRANSPORT, TELECOM, PROFESSIONAL_FEES, TAXES_FEES, MARKETING, OTHER |
| amount | Decimal(15,2) | Expense amount |
| date | DateField | Expense date |
| reference | CharField(100) | Auto-generated (EXP-000001) |
| source_account | FK → FinancialAccount | Cash/bank account paying |
| expense_coa | FK → ChartOfAccount | Expense COA to debit |
| financial_event | FK → FinancialEvent | Set on post |
| journal_entry | FK → JournalEntry | Set on post |
| status | CharField(20) | DRAFT → POSTED or CANCELLED |

## User Interactions
- Search by name/reference/category
- Filter by status tab (All/Draft/Posted/Cancelled)
- Create expense via Dialog form
- Edit/Delete draft expenses inline
- Post draft → creates journal entry (Debit expense COA, Credit source COA)
- Cancel draft expenses

## Workflow
1. User clicks "New Expense" → fills Dialog form
2. System creates DRAFT with auto-generated reference
3. User reviews → clicks "Post" → system atomically creates FinancialEvent + JournalEntry
4. Expense status becomes POSTED (immutable)
