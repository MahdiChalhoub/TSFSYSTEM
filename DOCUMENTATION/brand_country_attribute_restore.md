# Brand / Country / Attribute Relationship Restoration

**Version:** v1.3.2-b016  
**Date:** 2026-02-13

## Goal

Restore missing model relationships from the original Prisma schema that were lost during the Prisma→Django migration.

## Changes Made

### Models (`apps/inventory/models.py`)

| Field Added | Type | Purpose |
|-------------|------|---------|
| `Brand.countries` | M2M → Country | Direct assignment of countries a brand operates in |
| `Brand.logo` | CharField(255) | Brand logo URL |
| `Product.size` | Decimal(10,2) | Emballage size (e.g. 300ml, 500g) |
| `Product.size_unit` | FK → Unit | Unit for the size (ml, g, L) |

### Serializers (`apps/inventory/serializers.py`)

Enriched all serializers with nested data:

- **BrandSerializer**: `product_count`, `country_names`, `category_names`
- **BrandDetailSerializer**: Full nested `countries` objects, `product_count`
- **ParfumSerializer**: `product_count`, `category_names`
- **ProductSerializer**: Nested `brand_name`, `country_name`, `country_code`, `category_name`, `unit_name`, `parfum_name`, `size_unit_name`
- **ProductGroupSerializer**: `brand_name`, `parfum_name`, `category_name`, `product_count`
- **WarehouseSerializer**: `site_name`, `inventory_count`

### Views (`apps/inventory/views.py`)

- **BrandViewSet.hierarchy**: Now returns countries, product groups, and standalone products
- **ProductViewSet.create_complex**: Now handles `size` and `sizeUnitId` parameters

## Data Flow

### Brand Detail Page
- **READ**: `GET /api/brands/{id}/` → returns countries, categories, product_count
- **READ**: `GET /api/brands/{id}/hierarchy/` → returns countries, parfums, productGroups, standalone products
- **WRITE**: `PUT /api/brands/{id}/` → update brand fields including countries M2M

### Product Creation
- **WRITE**: `POST /api/products/create_complex/` → now accepts `size` and `sizeUnitId`

## Variables User Interacts With

| Variable | Type | Where |
|----------|------|-------|
| `brand.countries` | M2M select | Brand edit form |
| `brand.logo` | Text/URL | Brand edit form |
| `product.size` | Number | Product creation form |
| `product.size_unit` | Dropdown | Product creation form |

## Workflow

1. User navigates to Brand detail page
2. Page calls `brands/{id}/` for brand info + `brands/{id}/hierarchy/` for tree view
3. Brand detail now shows which countries the brand operates in
4. When creating products, user can set size (emballage) with the appropriate unit
5. Products are grouped by brand + parfum + size to form product groups
