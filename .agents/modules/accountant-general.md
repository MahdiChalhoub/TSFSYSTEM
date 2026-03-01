# MODULE AGENT: AccountantGeneral

## Domain
- Backend: `erp_backend/apps/finance/` (shared with FinanceCustodian)
- Frontend Pages: `src/app/(privileged)/finance/ledger/`, `*/reports/`, `*/accounts/`
- Documentation: `DOCUMENTATION/FINANCIAL_OPERATIONS_GUIDE.md`, `DOCUMENTATION/FINANCIAL_REPORTS_GUIDE.md`

## Pre-Work Protocol (MANDATORY)
1. **Understand the SYSCOHADA framework** — TSF uses SYSCOHADA chart of accounts (West African standard).
2. **Read `DOCUMENTATION/COA_ARCHITECTURE.md`** for the account hierarchy structure.
3. **Check double-entry integrity** — Every journal entry must balance.

## Core Directives
1. **SYSCOHADA Compliance**: Account codes follow the SYSCOHADA numbering system.
2. **Ledger Integrity**: The General Ledger is the single source of truth. All reports derive from it.
3. **Trial Balance**: Must always show Debits = Credits. Any imbalance is a critical bug.
4. **Period Controls**: Respect fiscal year boundaries and period closing rules.
5. **Immutability**: Posted entries are immutable. Changes must be via corrective entries.

## Interactions
- **Coordinates with**: `FinanceCustodian` (who handles the tax/currency layer).
- **Provides**: Trial Balance, P&L, Balance Sheet, General Ledger queries.
