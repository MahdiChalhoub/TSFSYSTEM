# Finance API Documentation (Django ERP Core)

## Goal
Provide a robust, multi-tenant financial foundation for the hybrid SaaS stack, handling double-entry ledger bookkeeping, automated financial account creation, and fiscal management.

## Architecture
- **Framework**: Django REST Framework (DRF)
- **Database**: PostgreSQL (Shared with Next.js)
- **Isolation**: Mandatory `X-Tenant-Id` header required for all requests (Injected by Next.js ERP Proxy).
- **Service Layer**: Business logic (Sequential COA code generation, trial balance validation) is encapsulated in `erp/services.py`.

## Data Model (READ/WRITE)
| Entity | Read Source | Write Destination | Key Fields |
| :--- | :--- | :--- | :--- |
| **ChartOfAccount (COA)** | `postgresql.ChartOfAccount` | `postgresql.ChartOfAccount` | `code`, `name`, `type`, `sub_type`, `balance` |
| **FinancialAccount** | `postgresql.FinancialAccount` | `postgresql.FinancialAccount` | `name`, `type`, `currency`, `ledger_account` |
| **JournalEntry** | `postgresql.JournalEntry` | `postgresql.JournalEntry` | `transaction_date`, `reference`, `status`, `scope` |
| **FiscalYear/Period** | `postgresql.FiscalYear` | `postgresql.FiscalYear` | `start_date`, `end_date`, `is_closed` |

## Key Workflows

### 1. Automated Financial Account Creation
- **Trigger**: `POST /api/accounts/`
- **Logic**:
    1. Resolve root COA account by `sub_type` (e.g. 'CASH').
    2. Generate next sequential code (e.g. `5700.001`).
    3. Create `ChartOfAccount` (Ledger) account with `is_system_only=True`.
    4. Create `FinancialAccount` linked to the new COA.
- **Security**: Automatically scoped to the active organization.

### 2. Double-Entry Journal Recording
- **Trigger**: `POST /api/journal/`
- **Logic**:
    1. Resolve active `FiscalYear` and `FiscalPeriod` based on `transaction_date`.
    2. Validate `Total Debit == Total Credit`.
    3. If `status == 'POSTED'`, automatically increment/decrement account balances in the COA.
- **Integrity**: Enforced via standard accounting principles.

## Endpoints
- `GET /api/health/`: Cross-stack connectivity check.
- `GET /api/sites/`: Manage business sites.
- `GET /api/accounts/`: Manage cash/bank/mobile accounts.
- `POST /api/journal/`: Create double-entry journal entries.
- `GET /api/coa/`: View Chart of Accounts and live balances.
