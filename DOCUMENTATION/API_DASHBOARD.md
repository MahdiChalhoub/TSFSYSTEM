# Dashboard API Documentation

## Endpoint: `/api/dashboard/financial_stats/`

### Goal
Provides aggregated financial data for the Finance Dashboard, including Cash Position, P&L, and Inventory Integrity status.

### Data Sources (READ)
- `erp.models.FinancialAccount` (Cash balances)
- `erp.models.JournalEntryLine` (P&L aggregation)
- `erp.services.InventoryService` (Stock Value)
- `erp.models.ChartOfAccount` (Ledger Balances for Inventory)

### Parameters
- `scope`: `OFFICIAL` (Tax View) or `INTERNAL` (Management View).

### Response Structure
```json
{
    "totalCash": 15000.00,
    "monthlyIncome": 5000.00,
    "monthlyExpense": 3000.00,
    "netProfit": 2000.00,
    "inventoryStatus": {
        "totalValue": 12500.50,         // Physical Stock Value (AMC * Qty)
        "ledgerBalance": 12000.00,      // GL Account Balance
        "discrepancy": 500.50,          // totalValue - ledgerBalance (>0 means Surplus, <0 means Shortage)
        "itemCount": 150,
        "isMapped": true                // Whether a GL account is configured for Inventory
    }
}
```

### Logic
- **Inventory Discrepancy**: Calculated as `Stock Value - Ledger Balance`. 
  - If `0`, the books match the warehouse.
  - If `Map Missing` (`isMapped=false`), discrepancy cannot be calculated.
