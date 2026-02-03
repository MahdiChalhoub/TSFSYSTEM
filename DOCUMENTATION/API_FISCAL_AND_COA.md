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
   - `POST /api/accounting/fiscal_years/` with `{ "name": "FY-202X", "start_date": "...", "end_date": "..." }`.
   - **Validation Fix**: `organization` is now read-only in the serializer. The backend automatically injects the current tenant ID via `create`.
   - **Auto-Generation**: Creating a Fiscal Year automatically generates 12 monthly `FiscalPeriods` (e.g., "P01-202X") based on the start/end dates.

   
## Endpoint: `/api/accounting/coa/`

### Goal
Manage the Chart of Accounts ledger.

### Data Interaction
- **GET /coa/**: Lists accounts.
- **GET /coa/templates/**: Lists available standard templates (e.g., IFRS, USA GAP, Lebanese PCN).
- **POST /apply_template/**: Applies a selected template to the current organization.

### Logic & Workflow
1. **Template Listing**:
   - Frontend calls `templates` action to get available standards.
   - Used in "Migration" or "Setup" wizards.
2. **Applying Template**:
   - Backend expects `template_key`.
   - `LedgerService` wipes existing (if `reset=True`) and applies new structure.
