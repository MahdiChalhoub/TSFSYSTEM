# TSFSYSTEM — Inventory Module Guide

**Updated:** 2026-02-22  
**Module:** inventory  
**Backend:** `erp_backend/apps/inventory/`  
**Frontend:** `src/app/(privileged)/inventory/`  
**Actions:** `src/app/actions/inventory/` + `src/app/actions/barcode-settings.ts` + `src/app/actions/attributes.ts`

---

## 1. Backend Structure (`erp_backend/apps/inventory/`)

| File | Purpose |
|------|---------|
| `models.py` (22KB) | Product, Unit, Warehouse, Inventory, InventoryMovement, Brand, Category, Parfum, ProductGroup, StockAdjustmentOrder/Line, StockTransferOrder/Line |
| `advanced_models.py` (8.5KB) | ComboProduct, OperationalRequest, DataQualityIssue |
| `alert_models.py` (9.5KB) | StockAlert, ExpiryAlert configurations |
| `counting_models.py` (6KB) | StockCount, StockCountLine, StockCountSchedule |
| `location_models.py` (5KB) | WarehouseZone, WarehouseLocation |
| `views.py` (88KB, 2105 lines) | All ViewSets: Product, Unit, Warehouse, Inventory, Brand, Category, Country, etc. |
| `serializers.py` (21KB) | All DRF serializers with computed fields |
| `services.py` (24KB) | Business logic: stock movements, valuation, adjustments |
| `valuation_service.py` (10KB) | FIFO/LIFO/WAC inventory valuation |
| `events.py` (3.4KB) | Cross-module event definitions |
| `signals.py` (1.3KB) | Signal receivers |
| `urls.py` (2.5KB) | URL routing for all ViewSets |
| `manifest.json` | Module identity |

---

## 2. Frontend Pages (24 directories)

| Page | Path | Data Source | Status |
|------|------|------------|--------|
| Adjustment Orders | `/inventory/adjustment-orders/` | `actions/inventory/adjustment-orders.ts` | ✅ |
| Adjustments | `/inventory/adjustments/` | Inline erpFetch | ✅ |
| Alerts | `/inventory/alerts/` | `actions/inventory/stock-alerts.ts` | ✅ |
| Analytics | `/inventory/analytics/` | `actions/inventory/product-analytics.ts` | ✅ |
| Attributes | `/inventory/attributes/` | `actions/attributes.ts` | ✅ |
| Barcode | `/inventory/barcode/` | `actions/barcode-settings.ts` | ✅ |
| Brands | `/inventory/brands/` | Inline erpFetch | ✅ |
| Categories | `/inventory/categories/` | Inline erpFetch | ✅ |
| Combo | `/inventory/combo/` | `lib/erp-fetch` | ✅ |
| Countries | `/inventory/countries/` | Inline erpFetch | ✅ |
| Expiry Alerts | `/inventory/expiry-alerts/` | `actions/inventory/expiry-alerts.ts` | ✅ |
| Global | `/inventory/global/` | `actions/inventory/viewer.ts` | ✅ |
| Labels | `/inventory/labels/` | Client-side fetch | ✅ |
| Locations | `/inventory/locations/` | `actions/inventory/locations.ts` | ✅ |
| Low Stock | `/inventory/low-stock/` | `actions/inventory/low-stock.ts` | ✅ |
| Maintenance | `/inventory/maintenance/` | Inline erpFetch | ✅ |
| Movements | `/inventory/movements/` | `actions/inventory/movements.ts` | ✅ |
| Requests | `/inventory/requests/` | `actions/inventory/operational-requests.ts` | ✅ |
| Serials | `/inventory/serials/` | `SerialTracker` component | ✅ |
| Stock Count | `/inventory/stock-count/` | `actions/inventory/stock-count.ts` | ✅ |
| Transfer Orders | `/inventory/transfer-orders/` | `actions/inventory/transfer-orders.ts` | ✅ |
| Units | `/inventory/units/` | Inline erpFetch | ✅ |
| Valuation | `/inventory/valuation/` | `actions/inventory/valuation.ts` | ✅ |
| Warehouses | `/inventory/warehouses/` | `actions/inventory/warehouses.ts` | ✅ |

---

## 3. Frontend Action Files (16 + 2 root-level)

### Module Actions (`src/app/actions/inventory/`)
| File | Functions |
|------|-----------|
| `adjustment-orders.ts` | CRUD for stock adjustment orders |
| `data-quality.ts` | Product data quality checks |
| `expiry-alerts.ts` | Expiry alert management |
| `locations.ts` | Warehouse location/zone management |
| `low-stock.ts` | Low stock detection and alerts |
| `movements.ts` | Stock movement tracking |
| `operational-requests.ts` | Operational request lifecycle |
| `product-actions.ts` | Product search and CRUD |
| `product-analytics.ts` | Product analytics dashboard data |
| `stock-alerts.ts` | Stock alert configuration |
| `stock-count.ts` | Physical stock counting workflows |
| `transfer-orders.ts` | Inter-warehouse transfer orders |
| `valuation.ts` | Inventory valuation reports |
| `viewer.ts` | Global inventory viewer |
| `warehouse-locations.ts` | Warehouse location assignments |
| `warehouses.ts` | Warehouse CRUD |

### Root-Level Actions
| File | Used By |
|------|---------|
| `src/app/actions/barcode-settings.ts` | Barcode configuration page |
| `src/app/actions/attributes.ts` | Product attributes page |

---

## 4. Key Components

| Component | Path | Used By |
|-----------|------|---------|
| `BrandManager` | `src/components/admin/BrandManager.tsx` | Brands page |
| `CountryManager` | `src/components/admin/CountryManager.tsx` | Countries page |
| `AttributeManager` | `src/components/admin/AttributeManager.tsx` | Attributes page |
| `UnitTree` | `src/components/admin/UnitTree.tsx` | Units page |
| `CategoryTree` | `src/components/admin/categories/CategoryTree.tsx` | Categories page |
| `CreateUnitButton` | `src/components/admin/CreateUnitButton.tsx` | Units page |
| `CreateCategoryButton` | `src/components/admin/categories/CreateCategoryButton.tsx` | Categories page |
| `UnitCalculator` | `src/components/admin/UnitCalculator.tsx` | Units page |
| `SerialTracker` | `src/components/modules/inventory/SerialTracker.tsx` | Serials page |

---

## 5. Build Status

✅ **All 24 inventory pages compile successfully** (`npm run build` exit code 0, verified 2026-02-22)

---

*This guide should be updated when modifying the inventory module.*
