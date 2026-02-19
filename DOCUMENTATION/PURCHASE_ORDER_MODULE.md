# Purchase Order Module Documentation

## Goal
Dedicated Purchase Order workflow with a 10-state lifecycle for managing supplier procurement.

## Model: PurchaseOrder (`pos/purchase_order_models.py`)

### Lifecycle States
```
DRAFT → SUBMITTED → APPROVED → ORDERED → PARTIALLY_RECEIVED → RECEIVED → INVOICED → COMPLETED
                  ↘ REJECTED
  Any non-terminal → CANCELLED
```

### Key Fields
| Field | Purpose |
|-------|---------|
| `po_number` | Auto-generated via TransactionSequence |
| `supplier` | FK to Contact (supplier) |
| `warehouse` | Default receiving warehouse |
| `status` | 10-state lifecycle |
| `priority` | LOW / NORMAL / HIGH / URGENT |
| `currency` | ISO 4217 code (default USD) |
| `subtotal_ht`, `tax_amount`, `discount_amount`, `total_amount` | Financial summary |

### Transition Rules
- `DRAFT → SUBMITTED`: requires at least 1 line
- `SUBMITTED → APPROVED`: records `approved_by` and `approved_at`
- `SUBMITTED → REJECTED`: records reason
- `APPROVED → ORDERED`: sent to supplier
- `ORDERED → PARTIALLY_RECEIVED/RECEIVED`: auto from line receipts
- `RECEIVED → INVOICED → COMPLETED`: standard flow

## Model: PurchaseOrderLine

### Fields
- `product`, `quantity`, `unit_price`, `tax_rate`, `discount_percent`
- `qty_received`, `qty_invoiced` — receipt tracking
- Auto-calculated: `line_total`, `line_total_with_tax`

### Receipt Method
`line.receive(qty)` — increments `qty_received`, triggers PO status update.

## Data Flow

### READ
- `GET /api/pos/purchase-orders/` — list all POs
- `GET /api/pos/purchase-orders/{id}/` — detail
- `GET /api/pos/purchase-orders/dashboard/` — summary stats

### WRITE
- `POST /api/pos/purchase-orders/` — create DRAFT
- `POST /api/pos/purchase-orders/{id}/submit/`
- `POST /api/pos/purchase-orders/{id}/approve/`
- `POST /api/pos/purchase-orders/{id}/reject/`
- `POST /api/pos/purchase-orders/{id}/send-to-supplier/`
- `POST /api/pos/purchase-orders/{id}/receive-line/`
- `POST /api/pos/purchase-orders/{id}/add-line/`
- `DELETE /api/pos/purchase-orders/{id}/remove-line/{line_id}/`
- `POST /api/pos/purchase-orders/{id}/mark-invoiced/`
- `POST /api/pos/purchase-orders/{id}/complete/`
- `POST /api/pos/purchase-orders/{id}/cancel/`

## Tables Affected
- `pos_purchaseorder` — main PO header
- `pos_purchaseorderline` — PO line items

## Relationships
- `supplier` → `crm.Contact`
- `warehouse` → `inventory.Warehouse`
- `invoice` → `finance.Invoice`
- `product` (on line) → `inventory.Product`
