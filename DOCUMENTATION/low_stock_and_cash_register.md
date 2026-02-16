# Low Stock Alerts

## Goal
Monitor products where current stock is at or below the configured minimum stock level, with severity classification and restock cost estimation.

## Page: `/inventory/low-stock`

### Data READ
- `GET /inventory/low-stock/` — all products below min_stock_level

### Data SAVED
- No writes (read-only)

### Variables
- **activeFilter**: `OUT` | `CRITICAL` | `LOW` | null
- **search**: text search on product name/barcode
- **sortKey/sortDir**: column sorting

### Workflow
1. Page loads all products below minimum stock level
2. Classifies severity: OUT (0 stock), CRITICAL (≤30% of min), LOW (≤100% of min)
3. Shows 5 KPI cards: Total Alerts, Out of Stock, Critical, Low, Restock Cost
4. Click severity cards to filter table
5. Table shows product, stock progress bar, shortage, unit cost, restock value

### How It Works
- Backend iterates active products, checks inventory quantity vs `min_stock_level`
- Calculates shortage = min_stock_level - current_stock
- Calculates restock_value = shortage × cost_price

## Files
- `erp_backend/apps/inventory/views.py` — `InventoryViewSet.low_stock`
- `src/app/actions/inventory/low-stock.ts` — Server action
- `src/app/(privileged)/inventory/low-stock/page.tsx` — Page component

---

# Cash Register / Daily Summary

## Goal
Daily transaction summary for POS operations — sales revenue, returns, payment method breakdown, cashier performance, and hourly activity chart.

## Page: `/finance/cash-register`

### Data READ
- `GET /pos/pos/daily-summary/?date=YYYY-MM-DD` or `?days=N`

### Data SAVED
- No writes (read-only)

### Variables
- **selectedDate**: date picker for specific day
- **period**: `today` | `week` | `month`

### Workflow
1. Page loads today's summary by default
2. Shows 4 KPI cards: Sales Revenue, Net Revenue, Returns, Tax Collected
3. Payment Methods card shows breakdown (Cash/Card/Mobile etc.)
4. Cashier Performance card shows per-user sales totals
5. Hourly Activity chart shows 24-hour bar distribution
6. Recent Transactions table shows last 20 orders

### How It Works
- Backend queries `Order` model filtered by date range
- Aggregates sales/purchases/returns with counts and totals
- Builds payment method and per-user breakdowns from sales orders
- Computes hourly distribution from `created_at` timestamps

## Files
- `erp_backend/apps/pos/views.py` — `POSViewSet.daily_summary`
- `src/app/actions/pos/daily-summary.ts` — Server action
- `src/app/(privileged)/finance/cash-register/page.tsx` — Page component
