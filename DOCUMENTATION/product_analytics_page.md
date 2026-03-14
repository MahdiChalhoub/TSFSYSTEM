# Product Analytics Page

## Goal
Provide a **product-centric analytical view** showing every product with stock levels, sales metrics, health scores, and operational request lifecycle status — enabling managers to identify products needing replenishment and quickly create purchase or transfer requests.

## Data Flow

### READ from
| Source | API Endpoint | Data |
|--------|-------------|------|
| `Inventory` table | `GET /api/products/product_analytics/` | Stock levels per product (aggregated across warehouses) |
| `InventoryMovement` table | Same endpoint | Sales (OUT) and purchase (IN) movements from last 30 days |
| `OperationalRequest` + `OperationalRequestLine` | Same endpoint | Latest request status per product |
| `Warehouse` table | `GET /api/warehouses/` | Warehouse selector dropdown |
| `Category` table | `GET /api/categories/` | Category filter dropdown |
| `Brand` table | `GET /api/brands/` | Brand filter dropdown |

### WRITE to
| Target | API Endpoint | Action |
|--------|-------------|--------|
| `OperationalRequest` | `POST /api/inventory/requests/` | Create new purchase/transfer request |
| `OperationalRequestLine` | `POST /api/inventory/requests/{id}/add_line/` | Add products to request |

## Variables User Interacts With
- **Search**: Filter by product name, SKU, or barcode
- **Warehouse selector**: Filter stock data by specific warehouse
- **Category dropdown**: Filter by product category
- **Brand dropdown**: Filter by product brand
- **Status filter**: `All | Available | Requested | Order Created | Failed`
- **Hide Completed toggle**: Toggle visibility of completed (CONVERTED) requests
- **Sort columns**: Click column headers to sort
- **Row checkboxes**: Select products for batch actions
- **Row actions**: Create Purchase/Transfer Request per product

## Step-by-Step Workflow

1. **Page loads** → fetches reference data (warehouses, categories, brands) and analytics data in parallel
2. **KPI cards** display: Total Products, Low Stock, Requested, Orders Pending, Failed, Avg Health
3. **User applies filters** → search/category/brand/status/warehouse → analytics data reloads
4. **Table renders** products with: name, SKU, category/brand badges, stock (color-coded), daily sales, request status badge, order type badge, health bar + score, row actions
5. **User selects rows** → batch action bar appears with "Purchase Request" / "Transfer Request" buttons
6. **User clicks action** → request dialog opens showing selected products → user confirms → creates OperationalRequest with lines (one per product)
7. **After creation** → table refreshes, product now shows "Requested" status badge

## How the Page Achieves Its Goal

The page uses a **single backend endpoint** (`product_analytics`) that performs 4 batch database queries to avoid N+1:
1. **Stock aggregation**: `Inventory.objects.filter(...).values('product_id').annotate(total_qty=Sum('quantity'))`
2. **Sales metrics**: `InventoryMovement.objects.filter(type='OUT', last 30 days).values('product_id').annotate(...)`
3. **Purchase metrics**: `InventoryMovement.objects.filter(type='IN', last 30 days).values('product_id').annotate(...)`
4. **Request lifecycle**: `OperationalRequestLine.objects.filter(...).select_related('request').order_by('-request__created_at')`

The **health score** (0-100) is computed server-side based on stock-to-daily-sales ratio:
- ≥30 days stock: 95 | ≥14 days: 80 | ≥7 days: 60 | ≥3 days: 40 | <3 days: 20
- Penalties: -30 if out of stock, -15 if below min_stock_level

## Files Modified/Created

| File | Change |
|------|--------|
| `erp_backend/apps/inventory/serializers.py` | Added `ProductAnalyticsSerializer` |
| `erp_backend/apps/inventory/views.py` | Added `product_analytics` action to `ProductViewSet` |
| `src/app/actions/inventory/product-analytics.ts` | New server actions |
| `src/app/(privileged)/inventory/analytics/page.tsx` | New page component |
| `src/components/admin/Sidebar.tsx` | Added sidebar entry |
