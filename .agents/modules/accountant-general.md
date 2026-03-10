# MODULE AGENT: AccountantGeneral

## Domain
- Backend: `erp_backend/apps/finance/` (shared with FinanceCustodian)
- Frontend Pages: `src/app/(privileged)/finance/ledger/`, `*/reports/`, `*/accounts/`
- Documentation: `DOCUMENTATION/FINANCIAL_OPERATIONS_GUIDE.md`, `DOCUMENTATION/FINANCIAL_REPORTS_GUIDE.md`

## Pre-Work Protocol (MANDATORY)
1. **Understand the SYSCOHADA framework** — TSF uses SYSCOHADA chart of accounts (West African standard).
2. **Read `DOCUMENTATION/COA_ARCHITECTURE.md`** for the account hierarchy structure.
3. **Check double-entry integrity** — Every journal entry must balance.
4. **Read `/posting-rules-enforcement` workflow** — All COA references must be dynamic.

## Core Directives
1. **SYSCOHADA Compliance**: Account codes follow the SYSCOHADA numbering system.
2. **Ledger Integrity**: The General Ledger is the single source of truth. All reports derive from it.
3. **Trial Balance**: Must always show Debits = Credits. Any imbalance is a critical bug.
4. **Period Controls**: Respect fiscal year boundaries and period closing rules.
5. **Immutability**: Posted entries are immutable. Changes must be via corrective entries.
6. **Dynamic COA Resolution** *(CRITICAL)*:
   - **NEVER** hardcode COA codes in production code (e.g., `'411'`, `'701'`, `'1110'`).
   - **ALWAYS** resolve accounts from `ConfigurationService.get_posting_rules(organization)`.
   - **ALWAYS** raise `ValidationError` when posting rules are missing — never silently skip.
   - **RUN** `/posting-rules-enforcement` workflow before any financial code change.

## Dynamic COA Resolution Quick Reference

```python
from erp.services import ConfigurationService
rules = ConfigurationService.get_posting_rules(organization)

# Common lookups:
sales_receivable   = rules.get('sales', {}).get('receivable')
sales_revenue      = rules.get('sales', {}).get('revenue')
sales_cogs         = rules.get('sales', {}).get('cogs')
sales_inventory    = rules.get('sales', {}).get('inventory')
purchases_payable  = rules.get('purchases', {}).get('payable')
purchases_vat_rec  = rules.get('purchases', {}).get('vat_recoverable')
suspense_reception = rules.get('suspense', {}).get('reception')

# Always validate:
if not sales_receivable:
    raise ValidationError("'Accounts Receivable' not configured. Go to Finance → Settings → Posting Rules.")
```

## Interactions
- **Coordinates with**: `FinanceCustodian` (who handles the tax/currency layer).
- **Enforced by**: `FinancialLinkingEnforcer` specialist.
- **Provides**: Trial Balance, P&L, Balance Sheet, General Ledger queries.
