# Inventory Module Audit & Fix Documentation

## Goal
Full audit and remediation of the Inventory module — fixing all critical, high, medium, and low severity issues identified in the audit.

## Version
`v1.3.2-b022`

---

## Files Modified

| File | Fixes Applied |
|------|---------------|
| `apps/inventory/services.py` | C1: Added `adjust_stock()`, C2: Added `get_inventory_financial_status()` |
| `apps/inventory/views.py` | C3, H1-H5, M1, M3, L1, L3, L5, L6 (14 fixes, full rewrite) |
| `apps/inventory/serializers.py` | M2: Explicit field list on `ProductCreateSerializer` |
| `apps/inventory/urls.py` | L6: Registered `InventoryMovementViewSet` |
| `apps/inventory/models.py` | M6: Warehouse unique constraint, M7: Product barcode conditional constraint |
| `apps/inventory/admin.py` | M4: Created with all 9 model registrations |
| `src/app/actions/inventory/warehouses.ts` | L4: Removed dead `address`/`city` fields |

---

## Critical Fixes (C1–C3)

### C1: `adjust_stock` — Was crashing at runtime
- **Method**: `InventoryService.adjust_stock(organization, product, warehouse, quantity, reason, reference)`
- **Logic**: Creates/gets inventory record, applies positive/negative adjustment, validates no negative stock result, creates `ADJUSTMENT` movement record

### C2: `get_inventory_financial_status` — Was crashing at runtime
- **Method**: `InventoryService.get_inventory_financial_status(organization)`
- **Returns**: Total cost value, retail value, margin, low-stock count, SKU count, 30-day movement summary by type

### C3: `storefront` — Was open to abuse
- **Added**: `StorefrontThrottle` at 30 requests/minute
- **Added**: Response limited to safe fields only (no cost/HT prices)
- **Added**: Result cap of 100 products

---

## High Fixes (H1–H5)

### H1: Viewer N+1 → Batch query
- Before: 1 aggregate query per product × per site = thousands of queries
- After: Single `GROUP BY (product_id, warehouse__site_id)` query → dict lookup

### H2: Brand hierarchy N+1 → Prefetch
- Before: Separate queryset per parfum + per group
- After: One `Product.objects.filter(brand=brand)` query, grouped in Python

### H3: Category with_counts N+1 → Annotate
- Before: `for cat: Product.count()` per category
- After: `Category.objects.annotate(product_count=Count('product'))`

### H4: Cross-tenant validation
- `receive_stock` and `adjust_stock` now filter by `organization=organization` when fetching product/warehouse

### H5: bulk_move target validation
- Now validates that the target entity (category/brand/unit/parfum/country) exists and belongs to the same organization before updating

---

## Deferred

- **L2**: camelCase vs snake_case standardization — cross-cutting concern affecting all frontend consumers, deferred to a dedicated refactor
