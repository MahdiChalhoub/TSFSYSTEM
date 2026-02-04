# Finance Module Documentation

## Goal
The Finance module provides a self-contained, double-entry bookkeeping system for the TSF ERP. It handles ledger management, financial transactions, fiscal periods, and hierarchical Chart of Accounts (COA).

## Components

### Models
- **ChartOfAccount**: Hierarchical structure of all accounts.
- **FinancialAccount**: Physical accounts (Cash, Bank, Mobile).
- **JournalEntry**: Recording of balanced transactions.
- **FiscalYear / FiscalPeriod**: Time-based accounting buckets.
- **Loan**: Debt management instrument.
- **FinancialEvent**: High-level financial actions (Injections, Repayments).

### Services
- **LedgerService**: Core logic for posting entries and rollup balances.
- **FinancialAccountService**: Lifecycle management of cash/bank accounts.
- **FinancialEventService**: Processing and posting financial events.

### API Endpoints
- `/api/coa/`: Chart of Accounts management.
- `/api/accounts/`: Financial Accounts management.
- `/api/journal/`: Journal entry recording and verification.
- `/api/fiscal-years/`: Accounting period management.

## Workflow: Journal Posting
1. Data READ from `JournalEntry` and `JournalEntryLine` request.
2. Logic validates balance (Debit == Credit).
3. Data SAVED to `JournalEntry` (Status: POSTED).
4. `ChartOfAccount` balances are updated via recursive rollup.

## Multi-Tenancy
All data is isolated by `organization_id` using the `TenantModel` base class. References to core models (Organization, Site) use fully qualified names to ensure modular portability.
