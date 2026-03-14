# Sales Module

## Overview
The Sales module manages the complete sales order lifecycle, from quotations and orders to delivery and invoicing. It integrates with Inventory, Finance, and CRM modules to provide end-to-end order management capabilities.

## Key Features
- Sales quotations and order management
- Multi-channel sales (online, POS, manual)
- Delivery note generation
- Integration with invoicing
- Sales analytics and reporting
- Customer pricing rules
- Order tracking and status management
- Sales team performance tracking

## Core Models

### SalesOrder
**Purpose**: Represents a customer order
**Key Fields**: order_number, customer, order_date, delivery_date, status, total_amount, organization
**Relationships**:
- Belongs to Customer (CRM)
- Has many SalesOrderLine
- Links to Invoice (Finance)
- Links to Delivery (Inventory)
**Key Methods**:
- `confirm_order()` - Confirms and processes order
- `create_invoice()` - Generates invoice from order
- `check_stock_availability()` - Validates inventory
- `calculate_totals()` - Computes order totals

### SalesOrderLine
**Purpose**: Individual line items in sales order
**Key Fields**: product, quantity, unit_price, discount, tax_rate, subtotal
**Relationships**: Belongs to SalesOrder, references Product
**Key Methods**: `calculate_line_total()`, `apply_discount()`

### SalesQuotation
**Purpose**: Pre-sale quotation management
**Key Fields**: quote_number, customer, valid_until, status, terms
**Relationships**: Can be converted to SalesOrder
**Key Methods**: `convert_to_order()`, `send_to_customer()`, `expire()`

### DeliveryNote
**Purpose**: Shipping/delivery documentation
**Key Fields**: delivery_number, order, delivery_date, carrier, tracking_number
**Relationships**: Belongs to SalesOrder, links to StockMovement
**Key Methods**: `mark_delivered()`, `generate_pdf()`

## API Endpoints

### GET /api/sales/orders/
**Description**: List all sales orders for current organization
**Authentication**: Required
**Permissions**: `sales.view_salesorder`
**Query Parameters**:
- `status`: Filter by order status (draft, confirmed, delivered, cancelled)
- `customer`: Filter by customer ID
- `date_from`, `date_to`: Date range filter
- `search`: Search in order number or customer name
**Response**:
```json
{
  "count": 150,
  "results": [
    {
      "id": 1,
      "order_number": "SO-2026-001",
      "customer": {"id": 5, "name": "Acme Corp"},
      "order_date": "2026-03-14",
      "status": "confirmed",
      "total_amount": "15250.00",
      "currency": "USD"
    }
  ]
}
```

### POST /api/sales/orders/
**Description**: Create new sales order
**Authentication**: Required
**Permissions**: `sales.add_salesorder`
**Request Body**:
```json
{
  "customer_id": 5,
  "order_date": "2026-03-14",
  "delivery_date": "2026-03-20",
  "lines": [
    {
      "product_id": 10,
      "quantity": 5,
      "unit_price": "100.00"
    }
  ]
}
```

### POST /api/sales/orders/{id}/confirm/
**Description**: Confirm order and reserve stock
**Permissions**: `sales.change_salesorder`
**Response**: Confirmed order with reserved stock

### POST /api/sales/orders/{id}/create-invoice/
**Description**: Generate invoice from order
**Permissions**: `sales.change_salesorder`, `finance.add_invoice`
**Response**: Created invoice details

### GET /api/sales/quotations/
**Description**: List quotations
**Query Parameters**: `status`, `customer`, `valid_from`, `valid_to`

### POST /api/sales/quotations/{id}/convert/
**Description**: Convert quotation to sales order
**Response**: New sales order created from quotation

## Business Logic

### Order Confirmation Workflow
1. Validate customer creditworthiness
2. Check product stock availability
3. Reserve stock for order
4. Update order status to "confirmed"
5. Emit `order.confirmed` event
6. Trigger fulfillment workflow

### Pricing Rules
- Customer-specific pricing overrides default
- Volume discounts apply automatically
- Promotion codes validated
- Tax calculated based on customer location
- Currency conversion if needed

### Stock Reservation
- Stock reserved but not yet moved
- Reservation released if order cancelled
- Auto-release after configurable timeout
- Integration with warehouse picking

## Events

**Published**:
- `sales.order.created`: When new order placed
  ```python
  {"order_id": 123, "customer_id": 45, "total": 1500.00}
  ```
- `sales.order.confirmed`: When order confirmed
- `sales.order.delivered`: When delivery completed
- `sales.order.cancelled`: When order cancelled
- `sales.quotation.sent`: When quotation sent to customer

**Consumed**:
- `inventory.stock.low`: Trigger stock alerts for sales team
- `finance.payment.received`: Update order payment status
- `crm.customer.blocked`: Prevent new orders

## Configuration

**Settings** (via `kernel.config`):
- `SALES_ORDER_PREFIX`: Order number prefix (default: "SO")
- `SALES_AUTO_CONFIRM`: Auto-confirm orders (default: False)
- `SALES_STOCK_RESERVATION_TIMEOUT`: Hours to hold reservation (default: 24)
- `SALES_QUOTATION_VALIDITY_DAYS`: Default quote validity (default: 30)
- `SALES_ALLOW_BACKORDERS`: Allow orders without stock (default: False)

**Feature Flags**:
- `sales_multi_currency`: Enable multi-currency sales
- `sales_customer_portal`: Customer self-service portal
- `sales_commission_tracking`: Sales team commissions

## Common Workflows

### Workflow 1: Create Order from Quotation
1. Customer requests quotation
2. Sales creates quotation with line items
3. Send quotation to customer
4. Customer approves
5. Convert quotation to order
6. Order enters fulfillment

**Code Example**:
```python
from apps.sales.models import SalesQuotation, SalesOrder

# Create quotation
quote = SalesQuotation.objects.create(
    organization=org,
    customer=customer,
    valid_until=date.today() + timedelta(days=30)
)
quote.add_line(product=product, quantity=10, unit_price=100)

# Send to customer
quote.send_to_customer()

# Convert to order
order = quote.convert_to_order()
order.confirm_order()
```

### Workflow 2: Order Fulfillment
1. Order confirmed
2. Stock reserved
3. Warehouse picks items
4. Delivery note created
5. Shipment dispatched
6. Customer receives
7. Invoice generated
8. Payment collected

## Testing

**Unit Tests**:
```python
# apps/sales/tests/test_order_creation.py
def test_order_calculates_totals(self):
    order = SalesOrder.objects.create(organization=self.org, customer=self.customer)
    order.add_line(product=self.product, quantity=5, unit_price=100)
    self.assertEqual(order.total_amount, 500.00)

def test_stock_reserved_on_confirm(self):
    order.confirm_order()
    self.assertTrue(StockReservation.objects.filter(order=order).exists())
```

**E2E Tests**:
- Create order → Confirm → Create invoice → Complete payment
- Create quotation → Send → Convert to order → Deliver

## Dependencies

**Depends on**:
- `core`: Tenant isolation, authentication
- `crm`: Customer data
- `inventory`: Product and stock management
- `finance`: Invoicing and payments

**Depended on by**:
- `ecommerce`: Online orders feed into sales
- `pos`: POS transactions create sales orders
- `client_portal`: Customers view their orders

## Integration Points

### CRM Integration
- Customer credit limits enforced
- Sales history tracked in CRM
- Lead conversion to customer on first order

### Inventory Integration
- Real-time stock checks
- Stock reservations
- Delivery note creation triggers stock movement

### Finance Integration
- Automatic invoice creation
- Revenue recognition
- Accounts receivable tracking

## Performance Considerations

- Index on `order_number`, `customer`, `status`
- Use `select_related('customer', 'organization')` for list views
- Cache customer pricing rules
- Batch process for bulk order imports

## Security Notes

- All orders filtered by `organization`
- RBAC for order approval workflow
- Audit log for price changes
- Customer data access controlled

---

**Last Updated**: 2026-03-14
**Module Status**: Production
**Test Coverage**: 85%
