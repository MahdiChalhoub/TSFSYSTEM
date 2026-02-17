# Inventory POST Fix Documentation

## Goal
Fix the inability to save (POST) data in the Inventory module.

## Root Cause
The `Warehouse` model requires a `site` FK (`ForeignKey(Site, on_delete=CASCADE)`), but:
1. The frontend `createWarehouse` action never sends a `site` field
2. The database had 0 `Site` records, making warehouse creation impossible
3. Without warehouses, all downstream inventory operations fail (stock reception, adjustments, transfers, counting)

## What Was Fixed

### 1. `WarehouseViewSet.perform_create()` — Auto-resolve site
- **File**: `erp_backend/apps/inventory/views.py`
- **Change**: Added `perform_create()` override that:
  - Resolves `site` from request data if provided
  - Falls back to the organization's first existing site
  - Auto-creates a default "Main Site" if no site exists
- **Data READ**: `Site`, `Organization` tables
- **Data SAVED**: `Site` (if auto-created), `Warehouse`

### 2. `WarehouseSerializer.site` — Made optional
- **File**: `erp_backend/apps/inventory/serializers.py`
- **Change**: Declared `site` as `PrimaryKeyRelatedField(required=False, allow_null=True)`
- **Reason**: DRF validation was rejecting POSTs before `perform_create` could auto-assign the site

### 3. Added `Site` import to serializers
- **File**: `erp_backend/apps/inventory/serializers.py`
- **Change**: Added `Site` to the `from erp.models import` line

### 4. Added missing `logger` to services
- **File**: `erp_backend/apps/inventory/services.py`
- **Change**: Added `import logging` and `logger = logging.getLogger(__name__)`
- **Reason**: Line 80 referenced `logger` which was never imported — would crash during stock reception if finance module was unavailable

## Variables User Interacts With
- Warehouse form: `name`, `code`, `type`, `can_sell`, `is_active`
- `site` is now auto-resolved (transparent to user)

## Step-by-Step Workflow
1. User opens Warehouse page → fetches `GET warehouses/`
2. User clicks "Add New Site" → opens form modal
3. User fills in name, code, type → submits `POST warehouses/`
4. `WarehouseSerializer` validates (site is optional)
5. `WarehouseViewSet.perform_create()`:
   - Resolves organization from user/header
   - Checks if `site` provided in request data
   - If not: finds first site for org, or auto-creates one
   - Saves warehouse with resolved `site_id` and `organization_id`

## Tables Affected
| Table | Read | Write | Pages |
|-------|------|-------|-------|
| `site` | ✅ | ✅ (auto-create) | Warehouse creation |
| `warehouse` | ✅ | ✅ | Warehouses page |
| `organization` | ✅ | — | All tenant-scoped pages |
