# INVENTORY MODULE — Master Plan 001

**Created:** 2026-02-22
**Module:** Inventory
**Status:** 🔄 In Progress

---

## Current State

### Backend (`erp_backend/apps/inventory/`)
- **20 files** including models, views, serializers, services, events, signals
- **views.py**: 2105 lines, ~95 outline items covering:
  - UnitViewSet, ProductViewSet, WarehouseViewSet, InventoryViewSet
  - StockAdjustmentOrderViewSet, StockTransferOrderViewSet
  - CountingViewSets (in separate file)
  - Location ViewSets (in separate file)
  - Alert models, valuation service, advanced models

### Frontend Pages (`src/app/(privileged)/inventory/`)
24 page directories:
1. adjustment-orders
2. adjustments
3. alerts
4. analytics
5. attributes
6. barcode
7. brands
8. categories
9. combo
10. countries
11. expiry-alerts
12. global
13. labels
14. locations
15. low-stock
16. maintenance
17. movements
18. requests
19. serials
20. stock-count (4 files)
21. transfer-orders
22. units
23. valuation
24. warehouses (3 files)

### Frontend Actions (`src/app/actions/inventory/`)
16 action files:
1. adjustment-orders.ts
2. data-quality.ts
3. expiry-alerts.ts
4. locations.ts
5. low-stock.ts
6. movements.ts
7. operational-requests.ts
8. product-actions.ts
9. product-analytics.ts
10. stock-alerts.ts
11. stock-count.ts
12. transfer-orders.ts
13. valuation.ts
14. viewer.ts
15. warehouse-locations.ts
16. warehouses.ts

---

## Gap Analysis

### Pages Missing Dedicated Action Files
| Page | Action File Exists? | Fix |
|------|-------------------|-----|
| attributes | ❌ | Create or verify inline fetch |
| barcode | ❌ | Create or verify inline fetch |
| brands | ❌ | Create or verify inline fetch |
| categories | ❌ | Create or verify inline fetch |
| combo | ❌ | Create or verify inline fetch |
| countries | ❌ | Create or verify inline fetch |
| global | ❌ | May use viewer.ts |
| labels | ❌ | Create or verify inline fetch |
| serials | ❌ | Create or verify inline fetch |
| units | ❌ | Create or verify inline fetch |

### Priority Order
1. **Categories & Brands** — Core product taxonomy
2. **Units & Countries** — Required for product creation
3. **Barcode & Labels** — Warehouse operations
4. **Combo & Attributes** — Product enrichment
5. **Serials** — Serial number tracking
6. **Global** — Overview page

---

## Definition of Done

- [ ] All 24 pages render without errors
- [ ] Every page has a working backend connection
- [ ] Missing action files created
- [ ] `npm run build` passes
- [ ] Documentation updated
