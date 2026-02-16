# Product Data Quality / Maintenance Mode

## Goal
Product-centric data maintenance tool for bulk editing product attributes, fixing missing data, and generating barcodes. Accessed from the existing Inventory Maintenance page via the "Data Quality" tab.

## Features
- **Data Quality KPIs**: Clickable cards showing counts of missing barcodes, categories, brands, zero TVA, zero cost/selling prices
- **Inline Editing**: Spreadsheet-like table where you can edit name, category, brand, TVA rate, cost prices, selling prices directly
- **Issue Filtering**: Click any KPI card to filter products with that specific issue
- **Batch Barcode Generation**: Generate EAN-13 barcodes for selected products or all products missing barcodes (uses existing BarcodeService)
- **Bulk Save**: Pending edits are tracked client-side and saved in one batch operation

## Pages

### Data Quality Page (`/inventory/maintenance/data-quality`)
- **Goal**: Browse all products, identify data quality issues, fix them inline
- **Data READ**: `GET /inventory/products/data-quality/`, `GET /inventory/products/`, `GET /inventory/categories/`, `GET /inventory/brands/`, `GET /inventory/units/`
- **Data SAVED**: `POST /inventory/products/bulk_update/`, `POST /inventory/products/generate_barcodes/`
- **Variables**: search, issueFilter (all/missing_barcode/missing_category/missing_brand/zero_tva/zero_price), selected products, pending edits

## Backend Endpoints

### `GET /inventory/products/data-quality/`
Returns aggregate counts of data quality issues (missing fields, zero values).

### `POST /inventory/products/bulk_update/`
Accepts `{ updates: [{ id, name?, barcode?, tva_rate?, category?, brand?, ... }] }`. Updates products atomically.
**Allowed fields**: name, barcode, tva_rate, cost_price_ht/ttc, selling_price_ht/ttc, category, brand, unit, parfum, size, description, min_stock_level

### `POST /inventory/products/generate_barcodes/`
Accepts `{ product_ids: [...] }` or `{ all_missing: true }`. Generates EAN-13 barcodes via `BarcodeService.generate_barcode()`.

## Files
- `erp_backend/apps/inventory/views.py` — 3 new endpoints in ProductViewSet
- `src/app/actions/inventory/data-quality.ts` — 5 server actions
- `src/app/(privileged)/inventory/maintenance/data-quality/page.tsx` — Data quality page
- `src/app/(privileged)/inventory/maintenance/page.tsx` — Updated with Data Quality tab
