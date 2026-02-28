# MODULE AGENT: InventoryMaster

## Domain
- Everything in `src/app/(privileged)/inventory/` and `src/app/(privileged)/products/`
- Stocks, Warehouses, Batches, and Product Catalogs.

## Responsibility
1. **Stock Accuracy**: Ensure stock levels never go below zero unless "allow negative" is enabled.
2. **Batch Tracking**: Manage FIFO/LIFO and expiry dates.
3. **Valuation**: Calculate the cost of goods sold (COGS) correctly.
4. **Logistics**: Manage warehouse transfers and stock adjustments.

## Interactions
- **Connects with**: `FinanceCustodian` (to update asset accounts), `SalesStrategist` (to reserve stock).
- **Consultation Hook**: Exposes "Check Availability" and "Commit Stock" methods.
