# Stock Orders Frontend Pages — Documentation

## Goal
Provide premium UI pages for managing Stock Adjustment Orders, Stock Transfer Orders, and Operational Requests within the Inventory module.

---

## Pages Overview

### 1. Adjustment Orders (`/inventory/adjustment-orders`)
- **Goal**: Create and manage stock adjustment orders with lifecycle pipeline
- **Data READ from**: `GET /api/inventory/adjustment-orders/`, warehouses, products
- **Data SAVED to**: `POST /api/inventory/adjustment-orders/`, line add/remove, lifecycle actions
- **Variables**: date, warehouse, reason, notes, product lines (qty_adjustment, amount_adjustment)
- **Workflow**:
  1. User clicks "New Adjustment" → fills date, warehouse, reason
  2. Order created in OPEN status → user adds product lines
  3. Lock → Verify → Confirmed lifecycle pipeline
  4. Post confirmed order → stock quantities adjusted in warehouse

### 2. Transfer Orders (`/inventory/transfer-orders`)
- **Goal**: Move stock between warehouses with verification pipeline
- **Data READ from**: `GET /api/inventory/transfer-orders/`, warehouses, products
- **Data SAVED to**: `POST /api/inventory/transfer-orders/`, line add/remove, lifecycle actions
- **Variables**: date, from_warehouse, to_warehouse, driver, reason, notes, product lines (qty_transferred)
- **Workflow**:
  1. User clicks "New Transfer" → selects source/destination warehouses + date
  2. Validation: source ≠ destination warehouse
  3. Add transfer lines with products and quantities
  4. Lock → Verify → Confirmed → Post (stock moved between warehouses)

### 3. Operational Requests (`/inventory/requests`)
- **Goal**: Submit, approve, reject, and convert stock requests into orders
- **Data READ from**: `GET /api/inventory/requests/`, warehouses, products
- **Data SAVED to**: `POST /api/inventory/requests/`, line add, approve/reject/convert
- **Variables**: request_type, date, priority, description, notes, product lines (quantity, warehouse)
- **Request Types**: STOCK_ADJUSTMENT, STOCK_TRANSFER, PURCHASE_ORDER
- **Priority Levels**: LOW, NORMAL, HIGH, URGENT
- **Workflow**:
  1. User submits request → picks type, priority, description
  2. Adds product lines with quantities
  3. Manager approves or rejects (rejection requires reason)
  4. Approved requests can be converted to actual orders (with warehouse selection)

---

## Server Actions

| File | Functions |
|------|-----------|
| `adjustment-orders.ts` | getAdjustmentOrders, getAdjustmentOrder, createAdjustmentOrder, addAdjustmentLine, removeAdjustmentLine, postAdjustmentOrder, lockAdjustmentOrder, unlockAdjustmentOrder, verifyAdjustmentOrder, getAdjustmentOrderHistory |
| `transfer-orders.ts` | getTransferOrders, getTransferOrder, createTransferOrder, addTransferLine, removeTransferLine, postTransferOrder, lockTransferOrder, unlockTransferOrder, verifyTransferOrder, getTransferOrderHistory |
| `operational-requests.ts` | getOperationalRequests, getOperationalRequest, createOperationalRequest, addRequestLine, approveRequest, rejectRequest, convertRequest |

---

## UI Components Used
- Summary Cards (gradient backgrounds with stats)
- Status Tabs with counts
- Data Table with expandable rows for line items
- Lifecycle action buttons (Lock, Unlock, Verify, Post)
- Approval buttons (Approve, Reject, Convert)
- Dialog forms for creation, line addition, and comments
- Skeleton loading states
- Empty state illustrations
- Toast notifications for all actions

## Sidebar Navigation
Located under **Inventory → Stock Orders**:
- Adjustment Orders
- Transfer Orders
- Operational Requests
