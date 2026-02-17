# Dashboard 404 Fix — URL Registration

## Goal
Fix all dashboard API 404 errors caused by failed module URL registration on the production server.

## Root Causes Found

### 1. Missing `SerialLog` re-export (`apps/inventory/models.py`)
- `SerialLog` model is in `apps/inventory/advanced_models.py`
- `views.py` imports it from `models.py`
- `models.py` was not re-exporting `SerialLog`
- **Effect:** Entire inventory module fails to import → all inventory URLs skipped

### 2. Top-level `PDFService` import crash (`apps/pos/views.py`)
- `views.py` imports `PDFService` at top level
- `PDFService` imports `xhtml2pdf` which is not installed on the server
- **Effect:** Entire POS module fails to import → all POS URLs skipped

### 3. DRF `format_suffix` converter conflict (`erp/urls.py`)
- Multiple router `include()` calls trigger DRF's converter re-registration
- Retry handler had a flaw: re-called `include()` which could trigger secondary errors
- **Fix:** Pre-register the converter before the module loop

### 4. Missing `basename` in inventory router (`apps/inventory/urls.py`)
- `InventorySessionViewSet` and `InventorySessionLineViewSet` override `get_queryset()` without a class-level `queryset`
- Router registrations lacked `basename`, causing DRF's assertion to crash
- **Effect:** Entire inventory URL include() fails

## Files Modified

| File | Change |
|------|--------|
| `erp_backend/apps/inventory/models.py` | Added `SerialLog` to advanced_models re-export |
| `erp_backend/apps/pos/views.py` | Made `PDFService` import lazy with try/except |
| `erp_backend/erp/urls.py` | Pre-registered DRF `format_suffix` converter |
| `erp_backend/apps/inventory/urls.py` | Added `basename` to counting ViewSet registrations |

## Data Flow

### URL Registration (erp/urls.py)
1. Django starts → loads `erp/urls.py`
2. Kernel router registers kernel ViewSets
3. Dynamic loop iterates `apps/` directory alphabetically
4. For each module: `importlib.import_module()` → `path('', include(...))` + `path('module/', include(...))`
5. DRF `format_suffix` converter registered on first `include()`

### Dashboard Data Fetching (dashboard/page.tsx)
- `erpFetch('pos/pos/daily-summary/?days=30')` → namespaced mount → `POSViewSet.daily_summary`
- `erpFetch('inventory/low-stock/')` → flat mount → `InventoryViewSet.low_stock`
- `erpFetch('inventory/inventory-movements/')` → namespaced mount → `InventoryMovementViewSet`

## Verification
- All endpoints return **401** (auth required) instead of **404** (not found)
- Health endpoint returns **200**
- Both flat and namespaced mounts work for all modules
