# Inventory Module — Pass 5: Remaining Components Audit

## Goal
Audit all remaining shared UI components and server actions for the same systemic Prisma→Django naming convention mismatches found in Pass 4.

## Version
`v1.3.2-b026`

## Systemic Pattern Found
All components were written with Prisma/JavaScript conventions:
- `_count?.products` → Django returns `product_count` (annotated field)
- `shortName` → Django returns `short_name`
- `parentId` → Django returns `parent` (FK PK)
- `baseUnitId` → Django returns `base_unit`
- `conversionFactor` → Django returns `conversion_factor`
- `needsBalance` → Django returns `needs_balance`
- `/admin/inventory/` → Correct route is `/inventory/`

## Files Changed

### Components (8 files)

| File | Fixes |
|---|---|
| `CountryManager.tsx` | `_count?.products` → `product_count` ×2, `p.categoryId` → `p.category` |
| `UnitTree.tsx` | Full type rewrite: `conversionFactor`, `baseUnitId`, `_count`, `needsBalance` → snake_case |
| `UnitFormModal.tsx` | 9 field fixes: `baseUnitId`, `shortName`, `needsBalance`, `allowFraction`, `conversionFactor`, `balanceCodeStructure` |
| `CategoryTree.tsx` | Type rewrite: `parentId`, `_count`, `shortName` → snake_case |
| `CategoryFormModal.tsx` | `parentId` → `parent` ×3, `shortName` → `short_name` |
| `CategoryCascader.tsx` | Type + usage: `parentId` → `parent` ×3 |
| `AttributeFormModal.tsx` | Tree builder `parentId` → `parent`, `shortName` → `short_name` |
| `GroupedProductForm.tsx` | Init fields `brandId`→`brand`, `shortName`→`short_name`, broken `/admin/` link |

### Server Actions (1 file — CRITICAL)

| File | Fix |
|---|---|
| `product-groups.ts` | Payload was sent as raw camelCase; backend expects `brand_id`, `category_id`, `unit_id`. Added explicit snake_case transform. |

### Clean Files (No Issues)
- `categories.ts` — already sends `parent`, `short_name`
- `countries.ts` — clean
- `maintenance.ts` — correctly maps fields
- `warehouses.ts` — correctly maps fields (verified in Pass 4)

## Root Cause
Components were originally built assuming a Prisma/Next.js-native data layer (where field names come back in camelCase and counts use `_count`). After migration to Django REST Framework backend, the serializer output follows Python snake_case conventions, but the frontend was never fully updated.
