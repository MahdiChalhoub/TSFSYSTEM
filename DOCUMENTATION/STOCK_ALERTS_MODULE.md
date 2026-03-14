# Stock Alerts Module Documentation

## Goal
Automatically detect and manage inventory anomalies through configurable alerts.

## Model: StockAlert (`inventory/alert_models.py`)

### Alert Types
| Type | Description |
|------|-------------|
| `LOW_STOCK` | Stock below `min_stock_level` |
| `OUT_OF_STOCK` | Zero stock |
| `OVERSTOCK` | Stock exceeds `max_stock_level` |
| `REORDER` | Stock at or below `reorder_point` |
| `EXPIRY_WARNING` | Items expiring within 30 days |

### Severities
`INFO` → `WARNING` → `CRITICAL` → `EMERGENCY`

### Status Flow
`ACTIVE → ACKNOWLEDGED → RESOLVED`
`ACTIVE → SNOOZED → ACTIVE` (auto-reactivates)

### Key Fields
| Field | Purpose |
|-------|---------|
| `product` | FK to Product |
| `warehouse` | Optional FK to Warehouse |
| `current_stock` | Stock level at alert time |
| `threshold_value` | Threshold that triggered alert |
| `snoozed_until` | When to reactivate |
| `purchase_order` | FK to PO created to resolve |

## Service: StockAlertService

Located in `alert_models.py`, provides:
- `scan_all()` — runs all scan types, returns new alerts
- `_scan_low_stock()` — checks products below `min_stock_level`
- `_scan_out_of_stock()` — checks zero-stock products
- `_scan_overstock()` — checks products above `max_stock_level`
- `_scan_reorder()` — checks products at/below `reorder_point`

### Deduplication
Existing ACTIVE alerts for the same product/type are not duplicated.

## Product Reorder Fields (added to `inventory/models.py`)
- `max_stock_level` — triggers OVERSTOCK alerts
- `reorder_point` — triggers REORDER alerts
- `reorder_quantity` — suggested qty for PO

## Data Flow

### READ
- `GET /api/inventory/stock-alerts/` — list alerts (filterable by status, type, severity)
- `GET /api/inventory/stock-alerts/{id}/` — detail
- `GET /api/inventory/stock-alerts/dashboard/` — summary stats

### WRITE
- `POST /api/inventory/stock-alerts/{id}/acknowledge/`
- `POST /api/inventory/stock-alerts/{id}/resolve/`
- `POST /api/inventory/stock-alerts/{id}/snooze/`
- `POST /api/inventory/stock-alerts/scan-all/` — trigger scan

## Tables Affected
- `inventory_stockalert` — alert records
- `inventory_product` — reorder fields

## Relationships
- `product` → `inventory.Product`
- `warehouse` → `inventory.Warehouse`
- `purchase_order` → `pos.PurchaseOrder`
