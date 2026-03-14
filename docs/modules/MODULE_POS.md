# Point of Sale (POS) Module

## Overview
The POS module provides a complete point-of-sale system for retail operations:
- Fullscreen POS terminal interface
- Product catalog with barcode scanning
- Shopping cart with real-time tax calculation
- Split payments (cash, card, multiple methods)
- Receipt printing and email
- Cash register management
- Shift/session management
- Offline mode support
- Loyalty points integration
- Discounts and promotions

**Location**: `erp_backend/apps/pos/` + `src/app/(privileged)/sales/pos/`

## Features

### Core Capabilities
- **Fast Checkout**: Optimized for speed (barcode scan, click, pay)
- **Multiple Payment Methods**: Cash, credit card, debit, mobile wallet, split payments
- **Tax Engine Integration**: Real-time tax calculation with jurisdiction support
- **Receipt Management**: Print, email, or SMS receipts
- **Register Sessions**: Track cash float, sales, and closing balance
- **Offline Mode**: Continue selling during network outages
- **Barcode Scanning**: USB/Bluetooth scanner support
- **Touch Optimized**: Works on tablets and touchscreen terminals
- **Keyboard Shortcuts**: Fast operation for power users
- **Product Search**: Fuzzy search, category navigation, recent items

### Advanced Features
- **Split Payments**: Pay with multiple methods (e.g., $50 cash + $50 card)
- **Partial Payments**: Accept deposits, pay remainder later
- **Refunds**: Full or partial refunds with reason codes
- **Exchanges**: Return item, exchange for different product
- **Hold/Retrieve Orders**: Put orders on hold, retrieve later
- **Customer Accounts**: Link sales to customer for loyalty tracking
- **Discounts**: Line-level, order-level, percentage, fixed amount
- **Promotions**: Buy X get Y, bundle pricing, time-based discounts
- **Custom Products**: Add ad-hoc products during checkout
- **Notes**: Add notes to orders or line items

## Models

### POSRegister
Physical cash register/terminal.

**Key Fields**:
- `register_number` - Register identifier
- `name` - Register name (e.g., "Register 1")
- `warehouse` - Associated warehouse
- `current_session` - Active session
- `is_active` - Active status

### RegisterSession
Opening/closing shift for cash register.

**Key Fields**:
- `session_number` - Auto-generated
- `register` - Associated register
- `opened_by` - User who opened session
- `opened_at` - Session start time
- `opening_float` - Starting cash amount
- `closed_by` - User who closed session
- `closed_at` - Session end time
- `expected_cash` - Calculated cash total
- `actual_cash` - Counted cash total
- `variance` - Difference (over/short)
- `status` - OPEN, CLOSED, BALANCED

**Key Methods**:
- `open_session(float_amount)` - Start new session
- `close_session(cash_count)` - End session, calculate variance
- `get_sales_summary()` - Sales totals for session

### POSOrder
Individual sale transaction.

**Key Fields**:
- `order_number` - Auto-generated (e.g., "POS-2026-001")
- `register` - Register used
- `session` - Session when sold
- `customer` - Optional customer link
- `order_date` - Sale timestamp
- `subtotal` - Before tax
- `tax` - Tax amount
- `discount` - Discount amount
- `total` - Final amount
- `status` - DRAFT, COMPLETED, VOIDED, REFUNDED
- `receipt_printed` - Boolean
- `receipt_emailed` - Boolean

**Key Methods**:
- `calculate_totals()` - Recalculate all amounts
- `apply_discount(amount)` - Apply discount
- `complete()` - Finalize sale
- `void()` - Cancel sale
- `refund()` - Process refund

### POSOrderLine
Individual items in cart.

**Key Fields**:
- `order` - Parent order
- `product` - Product sold
- `quantity` - Quantity
- `unit_price` - Price per unit
- `discount_percent` - Line discount
- `tax_rule` - Applicable tax
- `line_total` - Quantity × price × (1 - discount)
- `tax_amount` - Calculated tax
- `total` - Final line total

### POSPayment
Payment transactions.

**Key Fields**:
- `order` - Associated order
- `payment_method` - CASH, CARD, MOBILE, etc.
- `amount` - Payment amount
- `reference` - Transaction reference
- `payment_date` - Payment timestamp

## API Endpoints

### POST /api/pos/orders/
Create new POS order.

**Body**:
```json
{
  "register_id": 1,
  "customer_id": 123,
  "lines": [
    {
      "product_id": 456,
      "quantity": 2,
      "unit_price": 25.00
    }
  ]
}
```

### POST /api/pos/orders/{id}/complete/
Complete and finalize order.

**Body**:
```json
{
  "payments": [
    {"method": "CASH", "amount": 50.00},
    {"method": "CARD", "amount": 50.00, "reference": "TXN123"}
  ]
}
```

### POST /api/pos/sessions/open/
Open new register session.

**Body**:
```json
{
  "register_id": 1,
  "opening_float": 200.00
}
```

### POST /api/pos/sessions/{id}/close/
Close register session.

**Body**:
```json
{
  "cash_counted": 1250.00,
  "notes": "All reconciled"
}
```

## Business Logic

### Tax Calculation
Uses Finance module tax engine:
```typescript
const calculateTax = (subtotal: number, taxRate: number, isInclusive: boolean) => {
  if (isInclusive) {
    // EU-style inclusive tax
    const taxAmount = subtotal - (subtotal / (1 + taxRate));
    return { taxAmount, net: subtotal - taxAmount, total: subtotal };
  } else {
    // US-style exclusive tax
    const taxAmount = subtotal * taxRate;
    return { taxAmount, net: subtotal, total: subtotal + taxAmount };
  }
};
```

### Change Calculation
```typescript
const calculateChange = (total: number, payments: Payment[]) => {
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, paid - total);
};
```

## Events Published

### `pos.sale_completed`
Fired when sale is finalized.

**Payload**:
```json
{
  "order_id": 789,
  "order_number": "POS-2026-001",
  "total": 100.00,
  "customer_id": 123,
  "products": [{"product_id": 456, "quantity": 2}]
}
```

**Subscribers**:
- Inventory (reduce stock)
- Finance (create sales journal entry)
- CRM (update customer purchase history)
- Loyalty (award points)

## Configuration

**`POS_AUTO_PRINT_RECEIPT`**: Auto-print after sale (default: True)
**`POS_REQUIRE_CUSTOMER`**: Require customer for all sales (default: False)
**`POS_ALLOW_NEGATIVE_INVENTORY`**: Allow selling out-of-stock items (default: False)
**`POS_TAX_INCLUSIVE`**: Tax calculation method (default: False)

## Common Workflows

### Complete Sale Flow

1. **Add Products to Cart**: Scan barcodes or search products
2. **Apply Discounts**: Optional line or order discounts
3. **Calculate Tax**: Real-time tax calculation
4. **Accept Payment**: Single or split payments
5. **Print Receipt**: Automatic or manual
6. **Update Inventory**: Reduce stock quantities
7. **Record in Accounting**: Create journal entry

### End-of-Day Closing

1. **Close Register Session**: Count cash drawer
2. **Calculate Variance**: Compare expected vs actual
3. **Generate Z-Report**: Sales summary for day
4. **Bank Deposit**: Record cash deposit
5. **Reconcile**: Match payments to bank deposits

---

**Last Updated**: 2026-03-14
**Status**: Production Ready
