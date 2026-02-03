# Fiscal Year and Chart of Accounts API Documentation

## Overview
Documentation for managing Fiscal Years and Chart of Accounts (COA) in the multi-tenant ERP system.

## Endpoint: `/api/accounting/fiscal_years/`

### Goal
Manage fiscal years (open/close periods) for the tenant.

### Data Sources (READ)
- `erp.models.FiscalYear`: Tenant-scoped.

### Data Targets (WRITE)
- `erp.models.FiscalYear`: Creates new fiscal years.

### Workflows
1. **Creation**:
   - `POST /api/accounting/fiscal_years/` with `{ "name": "FY-202X", "start_date": "...", "end_date": "...", "frequency": "MONTHLY" }`.
   - **Auto-Generation**: Creating a Fiscal Year automatically generates 12 monthly `FiscalPeriods` (e.g., "P01-202X") based on the start/end dates.

2. **Closing & Locking**:
   - **Soft Close (Year)**: 
     `PATCH /api/accounting/fiscal_years/{id}/` with `{ "is_closed": true }`.
     *Prevents new transactions unless user has specific override permissions.*
   - **Hard Lock (Year)**:
     `PATCH /api/accounting/fiscal_years/{id}/` with `{ "is_hard_locked": true }`.
     *Permanently freezes the year. No changes allowed.*
   - **Close Period**:
     `PATCH /api/accounting/fiscal_periods/{id}/` with `{ "is_closed": true }`.

   
## Endpoint: `/api/accounting/coa/`

### Goal
Manage the Chart of Accounts ledger.

### Actions
- **GET /coa/**: Lists accounts with rollup balances.
  - Params: `scope` ('OFFICIAL'|'INTERNAL'), `include_inactive` (true/false).
  - Returns structure with `temp_balance` (raw) and `rollup_balance` (recursive sum).

- **GET /coa/templates/**: Lists available standard templates (e.g., SYSCOHADA, IFRS).

- **POST /coa/apply_template/**: Applies a selected template to the current organization.
  - Body: `{ "template_key": "SYSCOHADA", "reset": false }`
  - **Reset=True**: Wipes all existing accounts (fails if transactions exist).
  - **Reset=False**: Merges new template accounts into existing structure (used for Migration).

- **GET /coa/{id}/statement/**: detailed ledger statement.
  - Params: `start_date`, `end_date`, `scope`.
  
- **GET /coa/trial_balance/**: Full organization trial balance.
  - Params: `as_of` (date), `scope`.

## Migration Workflow (API Perspective)
The functional [Chart of Accounts Migration](../CHART_OF_ACCOUNTS_MIGRATION.md) is achieved via:
1. `POST /coa/apply_template/` (`reset=false`) to seed the new target accounts.
2. `POST /api/accounting/journal-entries/` to post the **Reclassification Entry** (Dr New / Cr Old).
3. `PATCH /coa/{id}/` to set `is_active=false` on old accounts.
