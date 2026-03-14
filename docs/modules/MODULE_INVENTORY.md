# Inventory Module

## Overview
The Inventory module manages all product and warehouse operations including:
- Product catalog management
- Multi-warehouse inventory tracking
- Stock movements (receipts, transfers, adjustments)
- Inventory valuation (FIFO, LIFO, Average Cost)
- Stock reservations and allocations
- Barcode/SKU management
- Product categories and attributes
- Reorder point alerts
- Inventory counting and audits

**Location**: `erp_backend/apps/inventory/` + `src/app/(privileged)/inventory/`

## Features

### Core Capabilities
- **Product Management**: Create and manage products with variants, SKUs, barcodes
- **Multi-Warehouse**: Track stock across multiple locations
- **Stock Movements**: Receipts, issues, transfers, adjustments
- **Real-Time Tracking**: Instant stock level updates
- **Valuation Methods**: FIFO, LIFO, Average Cost, Standard Cost
- **Reservations**: Reserve stock for sales orders, manufacturing
- **Lot/Serial Tracking**: Track products by lot number or serial number
- **Expiry Management**: Track expiration dates for perishables
- **Reorder Alerts**: Automatic alerts when stock falls below reorder point
- **Physical Counts**: Cycle counting and full inventory audits

## Models

### Product
Core product catalog.

**Key Fields**:
- `sku` - Stock Keeping Unit (unique)
- `barcode` - Barcode/UPC/EAN
- `name` - Product name
- `category` - Product category
- `product_type` - STOCKABLE, SERVICE, CONSUMABLE
- `unit_of_measure` - UOM (ea, kg, m, etc.)
- `cost` - Purchase cost
- `price` - Selling price
- `track_inventory` - Boolean
- `track_lots` - Track by lot number
- `track_serial` - Track by serial number

**Key Methods**:
- `get_stock(warehouse=None)` - Get current stock level
- `reserve(quantity, reference)` - Reserve stock for order
- `release_reservation(reference)` - Release reserved stock

### Warehouse
Physical or logical storage locations.

**Key Fields**:
- `code` - Warehouse code
- `name` - Warehouse name
- `address` - Physical address
- `is_active` - Active status
- `organization` - Tenant isolation

### StockLevel
Current inventory levels per product per warehouse.

**Key Fields**:
- `product` - Product reference
- `warehouse` - Warehouse reference
- `quantity_on_hand` - Physical quantity
- `quantity_reserved` - Reserved for orders
- `quantity_available` - On hand - reserved
- `reorder_point` - Trigger for reorder
- `reorder_quantity` - Suggested reorder quantity

**Key Methods**:
- `update_quantity(delta)` - Adjust stock level
- `check_availability(quantity)` - Check if quantity available

### StockMovement
Audit trail of all inventory transactions.

**Key Fields**:
- `product` - Product moved
- `warehouse_from` - Source warehouse
- `warehouse_to` - Destination warehouse
- `movement_type` - RECEIPT, ISSUE, TRANSFER, ADJUSTMENT
- `quantity` - Quantity moved
- `unit_cost` - Cost per unit
- `reference` - External reference (PO#, SO#, etc.)
- `created_at` - Movement timestamp

### InventoryCount
Physical inventory counts.

**Key Fields**:
- `count_number` - Auto-generated
- `warehouse` - Warehouse being counted
- `count_date` - Count date
- `status` - DRAFT, IN_PROGRESS, COMPLETED
- `count_type` - FULL, CYCLE, SPOT

## API Endpoints

### GET /api/inventory/products/
List products with current stock levels.

**Auth**: Required
**Permissions**: `inventory.view_product`
**Returns**: Product list with stock quantities

### POST /api/inventory/movements/
Create stock movement.

**Auth**: Required
**Permissions**: `inventory.create_movement`
**Body**:
```json
{
  "product_id": 123,
  "warehouse_to_id": 5,
  "movement_type": "RECEIPT",
  "quantity": 100,
  "unit_cost": 25.00,
  "reference": "PO-2026-001"
}
```

### GET /api/inventory/stock-levels/
Query stock levels across warehouses.

**Query Params**:
- `product_id` - Filter by product
- `warehouse_id` - Filter by warehouse
- `below_reorder` - Show only items below reorder point

## Events Published

### `inventory.stock_updated`
Fired when stock level changes.

**Payload**:
```json
{
  "product_id": 123,
  "warehouse_id": 5,
  "old_quantity": 50,
  "new_quantity": 150,
  "movement_type": "RECEIPT"
}
```

### `inventory.low_stock_alert`
Fired when stock falls below reorder point.

**Payload**:
```json
{
  "product_id": 123,
  "warehouse_id": 5,
  "current_quantity": 5,
  "reorder_point": 10,
  "reorder_quantity": 50
}
```

## Events Consumed

### `pos.sale_completed`
Reduces inventory when POS sale completed.

### `purchase.goods_received`
Increases inventory when purchase order received.

## Configuration

**`INVENTORY_VALUATION_METHOD`**: FIFO, LIFO, AVERAGE (default: FIFO)
**`INVENTORY_ALLOW_NEGATIVE`**: Allow negative stock (default: False)
**`INVENTORY_AUTO_REORDER`**: Auto-create POs when low (default: False)

## Common Workflows

### Receiving Stock

1. Create goods receipt
2. System creates RECEIPT movement
3. Updates StockLevel.quantity_on_hand
4. Emits `inventory.stock_updated` event
5. Finance creates journal entry (DR Inventory, CR AP)

### Issuing Stock

1. Create stock issue (for sale, manufacturing, etc.)
2. System creates ISSUE movement
3. Reduces StockLevel.quantity_on_hand
4. Releases any reservations
5. Emits `inventory.stock_updated` event

---

**Last Updated**: 2026-03-14
**Status**: Production Ready
