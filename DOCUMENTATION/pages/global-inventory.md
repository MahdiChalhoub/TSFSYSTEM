# Global Inventory Ledger Page Documentation

## Goal of the page
Provide a real-time, consolidated view of all stock units across every branch and warehouse in the TSF Enterprise network.

## From where data is READ
- Data is read from the Django `InventoryViewSet.viewer` endpoint via the `getGlobalInventory` server action.

## Where data is SAVED
- This page is primary for READ-ONLY visibility, but triggers for Stock Reconciliation or movements would save to the `InventoryMovement` and `Inventory` models in Django.

## Variables user interacts with
- `search`: To find specific products by name, SKU, or barcode.
- `categoryId`: Filter results by product category.
- `brandId`: Filter results by brand.

## Step-by-step workflow
1. User opens the Global Inventory page.
2. The page component calls `getGlobalInventory` with initial options.
3. `getGlobalInventory` performs an `erpFetch` to Django.
4. Django returns products mapped to their respective site stock levels.
5. `GlobalInventoryManager` displays the data in a master sheet format.

## How the page achieves its goal
By aggregating inventory data from all sites into a single interface with filtering capabilities, providing corporate-level visibility into stock levels and valuation.
