# Inventory Module & AMC Cost Engine

## Goal
To manage physical stock levels across multiple warehouses while maintaining a mathematically accurate **Average Moving Cost (AMC)** for financial valuation and profit analysis.

## From where data is READ
- **Product Metadata**: Current `cost_price` (the current AMC) and `tva_rate`.
- **Inventory Levels**: Current total quantity across all warehouses for the product.
- **Order Lines / Receptions**: Inbound quantity and supplier price (HT/TTC).
- **System Settings**: `pricingCostBasis` (defaulting to AMC) and `worksInTTC`.

## Where data is SAVED
- `Inventory`: Updated quantity record.
- `InventoryMovement`: Audit trail entry.
- `Product`: Updated `cost_price` (new AMC) and `cost_price_ht`.
- `JournalEntry`: Ledger impact of the inventory valuation change.

## Variables user interacts with
- `quantity`: Amount received or adjusted.
- `cost_price_ht`: The price per unit (excluding tax).
- `is_tax_recoverable`: A flag determining if the effective cost should be HT or TTC.

## Step-by-step workflow: AMC Calculation
1.  **Calculate Current Valuation**: `Current Total Qty * Current AMC`.
2.  **Calculate Inbound Valuation**: `Received Qty * Inbound Effective Cost`.
3.  **Calculate New Total Quantity**: `Current Total Qty + Received Qty`.
4.  **Derive New AMC**: `(Current Valuation + Inbound Valuation) / New Total Quantity`.
5.  **Update Product**: The new AMC becomes the base cost for future sales and valuation reports.

## How the page achieves its goal
By recalculating the AMC with every stock reception, the system ensures that the "Asset Value" of inventory on the Balance Sheet is always reflecting the weighted average of acquisition costs, providing a real-world perspective on business profitability.
