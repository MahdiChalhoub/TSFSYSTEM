# inventory/brands -> Brands Module

## Goal
Manage product brands, their hierarchical grouping (via Parfums/Families), and view assigned products with stock levels.

## Data Read
- **Brand**: Detail info.
- **ProductGroup**: Grouping of products under the brand.
- **Product**: Products linked to the brand (groupped or standalone).
- **Inventory**: Stock levels for each product.
- **Country**: Operating countries.
- **Unit**: Product units.

## Data Saved
- None (This is a Read-Only Detail View).
- *Editing happens via `groups/[id]/edit` links.*

## Variables
- `brandId` (URL Parameter): The ID of the brand to view.

## Workflow
1. User navigates to Brand Detail `/admin/inventory/brands/[id]`.
2. System fetches brand details via `erpFetch('brands/[id]')`.
3. System displays operating countries.
4. System displays "Parfums / Families" (Product Groups) with their variant products and aggregated stock.
5. System displays "Individual Items" (Standalone products) if any.

## Technical Implementation
- **Frontend**: `src/app/admin/inventory/brands/[id]/page.tsx` using `erpFetch`.
- **Backend**: `BrandViewSet.retrieve` using `BrandDetailSerializer`.
