
# Sales Import Engine Documentation

## Goal
Allow users to bulk import sales data from external CSV files into the Dajingo POS system.

## Data Movement
### Read From
- Client-side CSV file (uploaded via browser).
- `inventory.Product`: For SKU/Barcode matching.
- `inventory.Warehouse`: For stock deduction.

### Saved To
- `pos.Order` and `pos.OrderLine`: The imported sales records.
- `inventory.InventoryMovement`: To deduct stock.
- `finance.Transaction`: To record income.

## User Interactions
- **Upload CSV**: User selects a file.
- **Mapping**: User maps CSV columns (Date, SKU, Qty, Price) to system fields.
- **Preview**: User views records and errors before final import.
- **Commit**: User clicks "Finish Import".

## Workflow Step-by-Step
1. **Frontend Parsing**: `papaparse` reads the CSV and converts to JSON.
2. **Schema Mapping**: User selects which column represents the SKU, Quantity, etc.
3. **Validation**: Frontend checks if SKUs exist in the system.
4. **Backend Processing**: 
   - Backend iterates through lines.
   - Finds `Product` object.
   - Creates `Order` with `status='COMPLETED'`.
   - Calls `InventoryService.reduce_stock()` for each line.
   - Calls `FinancialService.record_income()` if payment is included.
5. **Reporting**: Backend returns count of successful vs failed imports.

## How it Achieves Goal
By providing a flexible mapping interface, it supports various CSV formats from different external systems.
