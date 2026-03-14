# Inventory Module — Pass 6: Cross-Module & Cleanup Audit

## Goal
Audit remaining components, all server actions, and cross-module integrations for naming convention mismatches and dead code introduced by the Passes 4/5 fixes.

## Version
`v1.3.2-b027`

## Issues Found & Fixed

### Components (3 files)

| File | Fix | Severity |
|---|---|---|
| `ProductReassignmentTable.tsx` | `product.brand.name` → `product.brand_name`, `product.unit.name` → `product.unit_name` (ProductSerializer returns flat fields), removed `productGroup?.image` (PK not object), cleaned verbose dev comments | 🔴 Critical |
| `CategoryTreeSelector.tsx` | Type `parentId` → `parent` | 🟡 Medium |
| `AttributeManager.tsx` | Hierarchy display `p.unit.name` → `p.unit_name`, `p.country.name` → `p.country_name` | 🔴 Critical |

### Server Actions (1 file)

| File | Fix | Severity |
|---|---|---|
| `attributes.ts` | Removed dead `_count` wrapper in `getAttributes()` — components now read `product_count` directly (Pass 4/5). Removed `shortName` remapping in `getAttributesByCategory()`. Removed fragile nested object bridge in `getAttributeHierarchy()` | 🟠 High |

### Verified Clean (No Issues)

| File | Status |
|---|---|
| `movements.ts` | Clean — all snake_case payloads |
| `viewer.ts` | Clean — backend accepts camelCase query params |
| `brands.ts` | Clean — sends `short_name`, `categories`, `countries` |
| `categories.ts` | Clean — sends `parent`, `short_name` |
| `countries.ts` | Clean |
| `inventory.ts` | Clean — sends `base_unit`, `conversion_factor`, etc. |
| `purchases.ts` | Clean — backend reads camelCase (`supplierId`, `warehouseId`) |
| `finance/inventory-integration.ts` | Clean — proper mapping from snake_case response |
| `maintenance.ts` | Clean — correctly maps fields |

## Root Cause
The `attributes.ts` action file had middleware wrappers that reconstructed Prisma-style objects (`_count`, nested `unit`/`country`) from flat Django fields. After Pass 4/5 fixed components to read flat fields, these wrappers became dead code and the`getAttributeHierarchy` bridge was actively reconstructing objects that components no longer expected.
