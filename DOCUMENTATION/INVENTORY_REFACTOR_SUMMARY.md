# Inventory Refactoring - Prisma Removal & Backend Integration

## Overview
This refactoring replaces direct Prisma ORM calls in the frontend with `erpFetch` calls to the Django backend. This ensures the backend is the single source of truth for all business logic, particularly for inventory management, stock movements, and financial postings.

## Key Changes
1.  **Frontend Actions Refactored**: All actions in `src/app/actions/inventory/`, `src/app/actions/categories.ts`, `src/app/actions/brands.ts`, and `src/app/actions/commercial/purchases.ts` now use `erpFetch`.
2.  **Backend Services Enhanced**:
    *   `InventoryService`: Handles stock reception, AMC calculation, and movements.
    *   `PurchaseService`: New `quick_purchase` method to handle real-time replenishment (Order -> Stock -> Ledger).
3.  **Backend API Endpoints**:
    *   `CountryViewSet.hierarchy`: Hierarchical view of brands and products for a country.
    *   `ProductViewSet.bulk_move`: Atomic reassignment of products between categories, brands, etc.
    *   `PurchaseViewSet.quick_purchase`: One-step purchase invoice processing.
4.  **Data Consistency**: All financial postings are now handled by `LedgerService` on the backend, removing the risk of inconsistent ledger entries from the frontend.

## Documented Pages
- [Inventory Maintenance](/DOCUMENTATION/pages/INVENTORY_MAINTENANCE.md)
- [Category Maintenance](/DOCUMENTATION/pages/CATEGORY_MAINTENANCE.md)
- [Country Details](/DOCUMENTATION/pages/COUNTRY_DETAILS.md)
- [Product Group Creation](/DOCUMENTATION/pages/PRODUCT_GROUP_CREATE.md)
- [Purchase Replenishment](/DOCUMENTATION/pages/PURCHASE_REPLENISHMENT.md)
