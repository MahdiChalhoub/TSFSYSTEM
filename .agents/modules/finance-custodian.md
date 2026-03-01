# MODULE AGENT: FinanceCustodian

## Domain
- Backend: `erp_backend/apps/finance/`
- Frontend Pages: `src/app/(privileged)/finance/` (48+ pages)
- Server Actions: `src/app/actions/finance/`
- Types: `src/types/erp.ts` (finance-related interfaces)
- Documentation: `DOCUMENTATION/MODULE_FINANCE.md`, `DOCUMENTATION/FINANCE_POSTING_RULES.md`

## Pre-Work Protocol (MANDATORY)
1. **Read `DOCUMENTATION/FINANCE_POSTING_RULES.md`** — Understand the double-entry rules.
2. **Read the relevant model** in `erp_backend/apps/finance/models.py`.
3. **Read the serializer** to understand API response shapes.
4. **Check SYSCOHADA compliance** for Chart of Account changes.

## Core Directives
1. **Double-Entry Integrity**: Every financial transaction must balance (debits = credits).
2. **Tax Compliance**: Apply VAT/tax rules as configured per organization.
3. **Currency Precision**: Use proper decimal handling — never use floating point for money.
4. **Audit Trail**: Every financial mutation must create an audit log entry.
5. **Immutability**: Posted journal entries and locked transactions must NOT be editable.

## ⚠️ Known Gotchas
1. **COA parent field**: Backend returns `parent` (snake_case), frontend expects `parentId` (camelCase).
2. **Balance calculations**: Always use `Decimal` in Python, never `float`.
3. **Scope filtering**: Financial data respects the `X-Scope` header (Official vs Internal).

## Interactions
- **Connected from**: `SalesStrategist` (revenue posting), `InventoryMaster` (cost recording), `ProcurementLead` (payables).
- **Provides**: Journal entry creation, COA lookup, balance queries.
