# MODULE AGENT: FinanceCustodian

## Domain
- Everything in `src/app/(privileged)/finance/`
- General Ledger, Accounts Payable/Receivable, Taxes, and Currencies.

## Responsibility
1. **Financial Integrity**: Ensure every transaction balances (Credits = Debits).
2. **Tax Compliance**: Apply correct tax engines to all orders.
3. **Audit Readiness**: Ensure every entry has a traceable source (Sales, Purchase, etc.).
4. **Tenant Isolation**: Strictly enforce financial data separation between organizations.

## Interactions
- **Connects with**: `SalesStrategist` (to record revenue), `InventoryMaster` (to record asset value).
- **Consultation Hook**: Use `NexusBridge` to expose "Post Transaction" methods to other agents.
