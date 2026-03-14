# Ecommerce Module

## Overview
Online store and ecommerce platform:
- Product catalog for web storefront
- Shopping cart and checkout
- Order management
- Shipping and fulfillment
- Payment gateway integration
- Promotions and coupons
- Customer reviews and ratings
- Email marketing integration

**Location**: `erp_backend/apps/ecommerce/` + `src/app/(privileged)/ecommerce/`

## Features
- **Online Storefront**: Public-facing product catalog
- **Shopping Cart**: Add to cart, wishlist, save for later
- **Checkout**: Multi-step checkout with guest or account
- **Payment Processing**: Credit card, PayPal, Stripe integration
- **Order Tracking**: Real-time order status updates
- **Shipping Calculator**: Real-time shipping rates
- **Promotions**: Discount codes, buy X get Y, flash sales
- **Reviews**: Customer product reviews and ratings
- **Inventory Sync**: Real-time stock availability

## Models

### OnlineOrder
Ecommerce order (distinct from POS).

**Key Fields**:
- `order_number` - Unique order ID
- `customer` - Customer reference
- `status` - CART, PENDING, PROCESSING, SHIPPED, DELIVERED
- `subtotal`, `shipping`, `tax`, `total` - Amounts
- `shipping_address` - Delivery address
- `tracking_number` - Shipment tracking

### Coupon
Discount codes.

**Key Fields**:
- `code` - Coupon code (e.g., "SAVE20")
- `discount_type` - PERCENTAGE, FIXED
- `discount_value` - Discount amount
- `minimum_order` - Minimum order value
- `valid_from`, `valid_to` - Active period
- `usage_limit` - Max uses

## API Endpoints

### POST /api/ecommerce/cart/add/
Add item to shopping cart.

### POST /api/ecommerce/checkout/
Complete checkout process.

## Events Published

### `ecommerce.order_placed`
**Trigger**: Customer completes checkout
**Subscribers**: Inventory (reserve stock), Email (send confirmation)

---

**Last Updated**: 2026-03-14
**Status**: Active Development
