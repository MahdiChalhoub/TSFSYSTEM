# Stock Count System

## Goal
Physical inventory counting with dual-person verification and automatic adjustment order generation. Cloned from the standalone "Inventory Mode" app (count.tsfci.com) and integrated natively into TSF using existing product/inventory data.

## Flow
1. **Create session** → select warehouse, category/supplier/qty filters, assign team
2. **Count** → person 1 & 2 enter physical counts per product → system computes differences
3. **Submit for verification** → session status changes to WAITING_VERIFICATION
4. **Manager verifies** → per-line or batch verification → status VERIFIED
5. **Create adjustment order** → auto-generates StockAdjustmentOrder with difference lines → status ADJUSTED

## Pages

### Sessions Dashboard (`/inventory/stock-count`)
- **Goal**: List, create, delete counting sessions
- **Data READ**: `GET /inventory/counting-sessions/`
- **Data SAVED**: `POST /inventory/counting-sessions/`, `DELETE /inventory/counting-sessions/:id/`
- **Features**: KPI cards (in-progress/pending/completed), search, status filter, create dialog with warehouse/category/supplier/qty filters and product count preview

### Counting Page (`/inventory/stock-count/:id/count`)
- **Goal**: Enter physical counts for each product
- **Data READ**: `GET /inventory/counting-sessions/:id/`, `GET /inventory/counting-lines/?session_id=:id`
- **Data SAVED**: `PATCH /inventory/counting-lines/:id/submit-count/`
- **Features**: Progress bar, product table with search/filter (all/uncounted/counted/differences), count entry dialog, submit-for-verification button

### Verification Page (`/inventory/stock-count/:id/verify`)
- **Goal**: Manager compares Person 1 vs Person 2 counts, verifies lines, creates adjustment orders
- **Data READ**: Same as counting
- **Data SAVED**: `POST /inventory/counting-lines/:id/verify-line/`, `POST /inventory/counting-sessions/:id/verify/`, `POST /inventory/counting-sessions/:id/adjust/`
- **Features**: Dual-person comparison table, diff badges, match indicator, per-line & batch verify, verify-all, create-adjustment-order, read-only mode for adjusted sessions

## Database Tables

### `inventory_session`
| Column | Type | Purpose |
|--------|------|---------|
| location | varchar | Warehouse/location name |
| section | varchar | Category section label |
| warehouse_id | FK | Links to warehouse |
| session_date | date | Count date |
| status | varchar | IN_PROGRESS, WAITING_VERIFICATION, VERIFIED, ADJUSTED, CANCELLED |
| person1_name | varchar | Counter 1 name |
| person2_name | varchar | Counter 2 name |
| category_filter | varchar | Category filter used |
| supplier_filter | FK | Supplier filter used |
| qty_filter | varchar | zero, non_zero, custom |
| assigned_users | JSON | Array of {user_id, user_name} |
| adjustment_order_id | FK | Generated adjustment order |

### `inventory_session_line`
| Column | Type | Purpose |
|--------|------|---------|
| session_id | FK | Parent session |
| product_id | FK | Product being counted |
| system_qty | decimal | System quantity at count time |
| physical_qty_person1 | decimal | Person 1 physical count |
| physical_qty_person2 | decimal | Person 2 physical count |
| difference_person1 | decimal | person1 - system |
| difference_person2 | decimal | person2 - system |
| is_same_difference | bool | Both persons agree |
| needs_adjustment | bool | Difference found |
| is_verified | bool | Line verified by manager |
| is_adjusted | bool | Adjustment order created |

## Backend Files
- `erp_backend/apps/inventory/counting_models.py` — InventorySession, InventorySessionLine
- `erp_backend/apps/inventory/counting_serializers.py` — serializers with computed fields
- `erp_backend/apps/inventory/counting_views.py` — ViewSets with workflow endpoints

## Frontend Files
- `src/app/actions/inventory/stock-count.ts` — 14 server actions
- `src/app/(privileged)/inventory/stock-count/page.tsx` — sessions dashboard
- `src/app/(privileged)/inventory/stock-count/[id]/count/page.tsx` — counting page
- `src/app/(privileged)/inventory/stock-count/[id]/verify/page.tsx` — verification page
