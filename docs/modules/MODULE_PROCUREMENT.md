# Procurement Module

## Overview
Purchase order and supplier management:
- Supplier/vendor management
- Purchase requisitions
- Purchase orders
- Goods receipt
- Invoice matching (3-way match)
- Supplier performance tracking
- RFQ (Request for Quotation)

**Location**: `erp_backend/apps/procurement/`

## Features
- **Supplier Management**: Maintain supplier database with contacts
- **Purchase Requisitions**: Request approvals for purchases
- **Purchase Orders**: Create and send POs to suppliers
- **Goods Receipt**: Record delivery of goods
- **3-Way Match**: Match PO → Receipt → Invoice
- **Supplier Performance**: Track on-time delivery, quality
- **RFQ Process**: Request quotes from multiple suppliers
- **Contract Management**: Track supplier contracts and terms

## Models

### Supplier
Vendor/supplier record.

**Key Fields**:
- `name` - Supplier name
- `contact` - Contact person
- `email`, `phone` - Contact details
- `payment_terms` - Default payment terms
- `currency` - Preferred currency
- `rating` - Supplier rating (1-5)

### PurchaseOrder
Order to supplier.

**Key Fields**:
- `po_number` - Purchase order number
- `supplier` - Supplier reference
- `order_date` - Order date
- `expected_delivery` - Expected delivery date
- `status` - DRAFT, SENT, CONFIRMED, RECEIVED, CLOSED
- `total` - Order total
- `currency` - Order currency

### GoodsReceipt
Delivery of goods.

**Key Fields**:
- `purchase_order` - Related PO
- `receipt_date` - Delivery date
- `received_by` - User who received
- `status` - PARTIAL, COMPLETE

## API Endpoints

### POST /api/procurement/purchase-orders/
Create purchase order.

### POST /api/procurement/goods-receipts/
Record goods receipt.

## Events Published

### `procurement.po_created`
**Trigger**: PO created
**Subscribers**: Email (send to supplier), Workflow (route for approval)

### `procurement.goods_received`
**Trigger**: Goods delivered
**Subscribers**: Inventory (update stock), Finance (prepare for invoice)

---

**Last Updated**: 2026-03-14
**Status**: Production Ready
