# Phase 3 — Module Enrichment

## 3.1 CRM Enhancement

### Goal
Add customer analytics (purchase history, lifetime value) and a loyalty program (earn/burn points, auto-tier) to the Contact model.

### Data Model Changes (Contact)

| Field | Type | Purpose |
|-------|------|---------|
| `first_purchase_date` | DateTime | First order date (auto-set) |
| `last_purchase_date` | DateTime | Most recent order date |
| `total_orders` | Int | Completed order count |
| `lifetime_value` | Decimal | Total revenue from customer |
| `average_order_value` | Decimal | Auto-computed LTV / orders |

### Loyalty Service (`apps/crm/loyalty_service.py`)

| Method | Description |
|--------|-------------|
| `earn_points(contact, order_total)` | Award points (1 per 10 units), auto-tier |
| `burn_points(contact, points)` | Redeem (100 pts = 1 unit discount) |
| `calculate_tier(lifetime_value)` | STANDARD / VIP (≥5K) / WHOLESALE (≥50K) |
| `get_customer_analytics(contact)` | Full analytics summary |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/crm/contacts/{id}/loyalty/` | GET | Loyalty analytics |
| `/crm/contacts/{id}/earn-points/` | POST | Award points |
| `/crm/contacts/{id}/burn-points/` | POST | Redeem points |

---

## 3.2 Supplier Enhancement

### Data Model Changes (Contact)

| Field | Type | Purpose |
|-------|------|---------|
| `overall_rating` | Decimal(3,1) | Weighted average 1-5 |
| `quality_rating` | Decimal(3,1) | Quality rating |
| `delivery_rating` | Decimal(3,1) | Delivery reliability |
| `pricing_rating` | Decimal(3,1) | Price competitiveness |
| `service_rating` | Decimal(3,1) | Customer service |
| `total_ratings` | Int | Rating count |
| `supplier_total_orders` | Int | Total POs |
| `on_time_deliveries` | Int | On-time count |
| `late_deliveries` | Int | Late count |
| `total_purchase_amount` | Decimal | Total PO value |
| `avg_lead_time_days` | Decimal(6,1) | Average lead time |
| `is_eu_supplier` | Bool | EU compliance flag |
| `vat_number_eu` | Char(50) | EU VAT number |
| `country_code` | Char(3) | ISO country code |
| `opening_balance` | Decimal | Starting balance |
| `current_balance` | Decimal | Running balance |
| `default_cost_basis` | Char(3) | HT or TTC |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/crm/contacts/{id}/scorecard/` | GET | Supplier scorecard |
| `/crm/contacts/{id}/rate/` | POST | Submit rating |
| `/crm/contacts/{id}/record-delivery/` | POST | Log delivery |

---

## 3.3 Category Auto-Computed Fields

### New Fields on Category

| Field | Type | Purpose |
|-------|------|---------|
| `level` | Int | Tree depth (0=root) |
| `full_path` | Char(1000) | Breadcrumb: "Electronics > Phones" |
| `products_count` | Int | Cached active product count |
| `barcode_sequence` | Int | Auto-SKU sequence counter |

### Methods
- `save()` → auto-computes `level` + `full_path`, cascades to children
- `refresh_products_count()` → updates cached count
- `next_barcode()` → generates `{CODE}-00001`

---

## 3.4 Warehouse Location System

### Models (`apps/inventory/location_models.py`)

| Model | Key Fields |
|-------|-----------|
| `WarehouseZone` | warehouse (Site FK), code, zone_type |
| `WarehouseAisle` | zone FK, code |
| `WarehouseRack` | aisle FK, code, max_weight_kg |
| `WarehouseShelf` | rack FK, code |
| `WarehouseBin` | shelf FK, code, full_location_code |
| `ProductLocation` | product FK, bin FK, quantity, min/max_quantity |

### API Endpoints (under `/inventory/`)

zones/, aisles/, racks/, shelves/, bins/, product-locations/ — full CRUD

Special actions:
- `zones/{id}/layout/` — full zone hierarchy tree
- `product-locations/by-product/{id}/` — all bins for product
- `product-locations/by-bin/{id}/` — all products in bin

---

## 3.5 HR Expansion

### New Models (`apps/hr/models.py`)

| Model | Key Fields |
|-------|-----------|
| `Department` | name, code, manager (Employee FK), parent (self FK) |
| `Shift` | name, start_time, end_time, break_minutes, site FK |
| `Attendance` | employee FK, date, check_in/out, status, shift FK |
| `Leave` | employee FK, leave_type, start/end_date, status, approved_by |

### API Endpoints (under `/hr/`)

| Route | ViewSet | Special Actions |
|-------|---------|----------------|
| `departments/` | DepartmentViewSet | `tree/` — flat list with parent_id |
| `shifts/` | ShiftViewSet | duration_hours computed |
| `attendance/` | AttendanceViewSet | `{id}/check-in/`, `{id}/check-out/` |
| `leaves/` | LeaveViewSet | `{id}/approve/`, `{id}/reject/` |

### Leave Types
ANNUAL, SICK, UNPAID, MATERNITY, PATERNITY, COMPENSATORY, OTHER

### Attendance Status
PRESENT, ABSENT, LATE, LEAVE, HALF_DAY
