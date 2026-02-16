# Inventory Valuation Report

## Goal
Show per-product stock valuation using FIFO, LIFO, or Weighted Average costing methods, optionally filtered by warehouse.

## Page: `/inventory/valuation`

### Data READ
- `GET /inventory/stock-valuation/` — per-product valuation detail
- `GET /inventory/warehouses/` — warehouse list for filter

### Data SAVED
- No writes from this page (read-only)

### Variables
- **warehouseFilter**: warehouse ID or 'all'
- **search**: text search on product name/SKU
- **sortKey**: `product_name` | `quantity` | `total_value` | `avg_cost`
- **sortDir**: `asc` | `desc`

### Workflow
1. Page loads and fetches stock valuation for all warehouses
2. Shows 3 KPI cards: Total Stock Value, Products with Stock, Total Units
3. Top-8 products bar chart
4. Detail table with sortable columns, search, and warehouse filter
5. User can filter by warehouse — triggers re-fetch from backend

### How It Works
- Backend first tries `ValuationService.get_stock_valuation_summary()` which uses `StockValuationEntry` records with FIFO/LIFO/WA costing
- Falls back to simple `cost_price * quantity` if no valuation entries exist
- Frontend does client-side sorting and search

## Files
- `erp_backend/apps/inventory/valuation_service.py` — `ValuationService.get_stock_valuation_summary()`
- `erp_backend/apps/inventory/views.py` — `InventoryViewSet.stock_valuation` endpoint
- `src/app/actions/inventory/valuation.ts` — Server actions
- `src/app/(privileged)/inventory/valuation/page.tsx` — Page component
