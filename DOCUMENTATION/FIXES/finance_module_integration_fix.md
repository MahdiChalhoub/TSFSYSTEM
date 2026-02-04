# Finance Module Integration Fix

## Version: v8.3.2-b044

## Date: 2026-02-04

## Problem
The Django migrations were failing with `ModuleNotFoundError: No module named 'apps.finance'` because:
1. The `erp/views.py` and `erp/serializers.py` were importing from `apps.finance.models`
2. The `apps.finance` module existed but had stub models instead of the actual models
3. The actual finance models were in `erp/models_main.py` which was causing conflicts with `erp/models.py`
4. A migration (0022) referenced a nonexistent `apps_finance` app

## Solution

### 1. Consolidated Finance Models into erp/models.py
Added the following finance models to the main `erp/models.py`:
- `ChartOfAccount` - Chart of accounts for double-entry bookkeeping
- `FinancialAccount` - Cash, bank, and mobile payment accounts
- `FiscalYear` - Fiscal year management
- `FiscalPeriod` - Monthly/quarterly fiscal periods
- `JournalEntry` - General journal entries
- `JournalEntryLine` - Individual debit/credit lines
- `Transaction` - Cash/bank transactions
- `Loan` - Loan contracts
- `LoanInstallment` - Loan repayment schedule
- `FinancialEvent` - Partner capital injections, withdrawals, etc.

### 2. Updated apps.finance Module
Updated `apps/finance/models.py` to re-export models from `erp.models`:
```python
from erp.models import (
    FinancialAccount,
    ChartOfAccount,
    FiscalYear,
    FiscalPeriod,
    JournalEntry,
    JournalEntryLine,
    Loan,
    LoanInstallment,
    FinancialEvent,
    Transaction,
)
```

### 3. Fixed Foreign Key References
Updated references from `'apps_finance.ChartOfAccount'` to `'erp.ChartOfAccount'`:
- `Contact.linked_account`
- `Employee.linked_account`
- `User.cash_register` (now uses direct reference to `FinancialAccount`)

### 4. Fixed Migration Chain
- Deleted problematic migration `0022_alter_employee_linked_account_and_more.py` which had invalid dependency on `apps_finance`
- Updated `0023_systemupdate_and_more.py` to depend on `0021` instead
- Renamed `models_main.py` to `models_main_backup.py.bak` to prevent duplicate model loading

### 5. Applied New Migrations
Migration `0025_organization_billing_contact_id_and_more.py` was successfully applied, creating:
- AuditLog model with indexes
- ApprovalRequest model
- TaskTemplate and TaskQueue models
- WorkflowDefinition model
- Subscription-related organization fields

## Files Modified
- `erp/models.py` - Added finance models, fixed FK references
- `apps/finance/models.py` - Re-exports from erp.models
- `apps/finance/serializers.py` - Uses erp.models
- `erp/migrations/0023_systemupdate_and_more.py` - Fixed dependency chain

## Files Renamed
- `erp/models_main.py` → `erp/models_main_backup.py.bak`

## Files Deleted
- `erp/migrations/0022_alter_employee_linked_account_and_more.py`

## Verification
- `python manage.py check` passes (only warning is the expected username uniqueness warning)
- `python manage.py migrate` completed successfully
