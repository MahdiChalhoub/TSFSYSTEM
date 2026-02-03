# Modular Architecture Documentation

## Goal
The modular architecture allows the TSF ERP system to expand its features (HRM, Inventory, Accounting, POS) as independent, pluggable components. This ensures a clean "Core" platform while allowing organizations to enable/disable features as needed.

## Database Tables

### Module (Global Catalog)
- **Purpose**: Tracks all modules available in the physical filesystem.
- **Columns**:
    - `code`: Unique identifier (slug).
    - `name`: Human-readable name.
    - `version`: Semantic versioning.
    - `dependencies`: JSON list of other module codes required.
    - `is_core`: Boolean. If true, cannot be disabled.

### OrganizationModule (Tenant Attachment)
- **Purpose**: Links a global module to a specific organization/tenant.
- **Columns**:
    - `organization_id`: Reference to Organization.
    - `module_id`: Reference to Module.
    - `status`: `INSTALLED`, `DISABLED`, or `UNINSTALLED`.

## Workflow: Module Management

### 1. Module Discovery
- **Action**: Running `python manage.py sync_modules`.
- **Logic**: Scans `erp/modules/*/manifest.json`.
- **Result**: Data is mirrored to the `Module` table in the database.

### 2. Module Activation (Per Org)
- **Action**: User clicks "Install" in Settings -> Module Manager.
- **Logic**:
    1. Check if dependencies are met (in `OrganizationModule`).
    2. Create/Update `OrganizationModule` entry with status `INSTALLED`.
    3. (Future) Trigger migrations if needed.

### 3. Module Deactivation (Soft Disable)
- **Action**: User clicks "Disable" in Settings -> Module Manager.
- **Logic**:
    1. Block if it's a `core` module.
    2. Check if other active modules depend on this one.
    3. Update status to `DISABLED`.
- **Safety**: Data is KEPT, but UI elements/APIs should check for active status.

## Data Movement
- **Read from**: `Module` table for list, `OrganizationModule` for per-org status.
- **Save to**: `OrganizationModule` for installs/deactivations.

## Step-by-Step for Developers
1. Create a folder in `erp/modules/{module_name}`.
2. Add a `manifest.json`.
3. Run `python manage.py sync_modules`.
4. Implement your models/views inside the erp app (for now) and check `ModuleManager.is_enabled(code, org_id)` in your logic.
