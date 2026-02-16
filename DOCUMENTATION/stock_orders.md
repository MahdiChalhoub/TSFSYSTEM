# Stock Orders & Operational Requests

## Goal
Order-based stock management with multi-level verification. Stock adjustments and transfers go through the lifecycle pipeline before executing inventory operations.

---

## Stock Adjustment Orders

### Models (`apps/inventory/models.py`)

#### StockAdjustmentOrder
- **Table**: `stock_adjustment_order`
- **Inherits**: `VerifiableModel` (lifecycle support)
- **Key Fields**: reference, date, warehouse, supplier, reason, notes, is_posted
- **Computed**: total_qty_adjustment, total_amount_adjustment
- **Read by**: `StockAdjustmentOrderViewSet`
- **Written by**: `StockAdjustmentOrderViewSet.perform_create()`, request conversion

#### StockAdjustmentLine
- **Table**: `stock_adjustment_line`
- **Key Fields**: product, qty_adjustment, amount_adjustment, warehouse, reason, recovered_amount, reflect_transfer
- **Read by**: Nested in order serializer
- **Written by**: `add_line` action

### API Endpoints (`/api/inventory/adjustment-orders/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List orders (filter: `?status=`, `?warehouse=`) |
| POST | `/` | Create order (auto-generates reference) |
| GET | `/{id}/` | Get order with nested lines |
| POST | `/{id}/add_line/` | Add product line |
| DELETE | `/{id}/remove_line/{line_id}/` | Remove line |
| POST | `/{id}/lock/` | Lock for review |
| POST | `/{id}/verify/` | Verify (advances level) |
| POST | `/{id}/post_order/` | Execute adjustments (must be CONFIRMED) |
| GET | `/{id}/lifecycle_history/` | Audit trail |

### Workflow
1. Create order → OPEN
2. Add product lines with qty/amount adjustments
3. Lock → LOCKED
4. Verify → VERIFIED/CONFIRMED
5. Post → executes `InventoryService.adjust_stock()` for each line

---

## Stock Transfer Orders

### Models

#### StockTransferOrder
- **Table**: `stock_transfer_order`
- **Key Fields**: from_warehouse, to_warehouse, driver, supplier, reason
- **Computed**: total_qty_transferred

#### StockTransferLine
- **Table**: `stock_transfer_line`
- **Key Fields**: product, qty_transferred, from_warehouse, to_warehouse, reason, recovered_amount

### API Endpoints (`/api/inventory/transfer-orders/`)
Same pattern as adjustment orders. Post action executes `InventoryService.transfer_stock()`.

---

## Operational Requests

### Models

#### OperationalRequest
- **Table**: `operational_request`
- **Inherits**: `TenantModel` (not VerifiableModel — simpler workflow)
- **Types**: PURCHASE_ORDER, STOCK_ADJUSTMENT, STOCK_TRANSFER
- **Priorities**: LOW, NORMAL, HIGH, URGENT
- **Statuses**: PENDING → APPROVED → CONVERTED (or REJECTED/CANCELLED)
- **Key Fields**: request_type, requested_by, priority, status, description

#### OperationalRequestLine
- **Table**: `operational_request_line`
- **Key Fields**: product, quantity, warehouse, reason

### API Endpoints (`/api/inventory/requests/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List (filter: `?type=`, `?status=`, `?priority=`) |
| POST | `/` | Create request |
| POST | `/{id}/add_line/` | Add item line |
| POST | `/{id}/approve/` | Approve (PENDING → APPROVED) |
| POST | `/{id}/reject/` | Reject with reason |
| POST | `/{id}/convert/` | Convert to stock order (APPROVED → CONVERTED) |

### Conversion Workflow
1. User submits request (PENDING)
2. Manager approves → APPROVED
3. Manager converts → creates StockAdjustmentOrder or StockTransferOrder
4. Request marked CONVERTED with link to created order
