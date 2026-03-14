# Inventory Module — Pass 4: Shared Components Audit

## Goal
Audit all shared UI components and server actions used by the inventory module for field name mismatches, broken links, and incorrect property references.

## Version
`v1.3.2-b025`

## Files Changed

### `MaintenanceSidebar.tsx`
- **C4**: Fixed broken link paths: `/admin/inventory/maintenance` → `/inventory/maintenance` (2 instances)

### `BrandManager.tsx`
- **C5**: `brand._count?.products` → `brand.product_count` (Django annotated field)
- **C6**: `brand.shortName` → `brand.short_name` (snake_case from serializer)
- **C7**: Link paths from `/admin/inventory/...` → `/inventory/...` (2 link targets)

### `BrandFormModal.tsx`
- **C8**: `buildCategoryTree` used `cat.parentId` → `cat.parent` (Django returns `parent` PK)
- **C6b**: Form default value `brand?.shortName` → `brand?.short_name`

### `AttributeManager.tsx`
- **C10**: `attribute._count?.products` → `attribute.product_count` (2 instances)
- **C6c**: `attribute.shortName` → `attribute.short_name` (2 instances)

### `ProductReassignmentTable.tsx`
- **C9**: `buildCategoryTree` used `cat.parentId` → `cat.parent` (Django returns `parent` PK)

## Clean Files (No Issues Found)
- `UnifiedReassignmentTable.tsx` — well-structured, correct field access
- `warehouses.ts` server action — correctly sends snake_case to backend
- `MaintenanceSidebar.tsx` — field access clean (only link paths fixed)

## Data Flow
- **Django serializers** return snake_case fields (`short_name`, `product_count`, `parent`)
- **Frontend components** were using Prisma-style access patterns (`shortName`, `_count?.products`, `parentId`)
- All components now correctly reference Django serializer output
