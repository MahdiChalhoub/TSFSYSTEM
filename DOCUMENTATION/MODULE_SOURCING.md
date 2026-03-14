# Sourcing & Vendor Pricing Documentation

## Overview
The Sourcing module tracks multi-vendor relationships, historical cost price fluctuations, and procurement lead times. It enables "Sourcing Intelligence" by benchmarking suppliers against each other.

---

## Database Tables

### [pos_product_supplier]
- **Purpose**: Links a product to a qualified supplier with specific terms.
- **Columns**:
  - `product_id`: FK to Inventory.Product
  - `supplier_id`: FK to CRM.Contact
  - `supplier_sku`: String (Vendor part number)
  - `lead_time_days`: Integer (Days to receive)
  - `min_order_qty`: Decimal
  - `last_purchased_price`: Decimal (Most recent cost)
  - `last_purchased_date`: DateTime
- **Relationships**: Many-to-One with Product and Supplier.
- **Written by**: `PurchaseService.receive_po`, `PurchaseService.quick_purchase`.
- **Read by**: `Sourcing comparison dashboard`, `RFQ Form (Price Hints)`.

### [pos_supplier_price_history]
- **Purpose**: Immutable log of price changes per vendor.
- **Columns**:
  - `product_id`: FK to Product
  - `supplier_id`: FK to Contact
  - `price`: Decimal
  - `reference_order_id`: FK to Order
  - `effective_date`: DateTime (Auto-now-add)
- **Written by**: `PurchaseService.receive_po`, `PurchaseService.quick_purchase`.
- **Read by**: `Sourcing Trends view (TBD/API)`.

---

## Page Documentation: Sourcing Dashboard
- **Path**: `/purchases/sourcing`
- **Goal**: Provide a high-level comparison of all vendors per product to identify efficiency gaps.
- **Data READ from**: `api/sourcing/comparison/` (Aggregated from `ProductSupplier`).
- **Data SAVED to**: N/A (Read-only dashboard).
- **Variables**: `stats` (summary counts), `data` (product-supplier mapping list).
- **Workflow**:
  1. Fetches aggregated metrics per product (min/max/avg price).
  2. Calculates "Savings Potential" per item.
  3. Displays lead-time efficiency per vendor.
- **Outcome**: Procurement managers can see which products have high cost volatility and which vendors are most reliable.

---

## Workflow: Price Intelligence Logging
- **Goal**: Automatically build the sourcing database without manual entry.
- **Actors**: Purchasing Manager, Warehouse Staff.
- **Steps**:
  1. User confirms a Quick Purchase OR confirms a PO Reception.
  2. `PurchaseService` iterates through items.
  3. For each item, it checks if a `ProductSupplier` link exists; it creates or updates it.
  4. It logs a new `SupplierPriceHistory` record.
- **Data Movement**: From `OrderLine` prices to `Sourcing` tracking tables.
- **Tables affected**: `pos_product_supplier`, `pos_supplier_price_history`.
