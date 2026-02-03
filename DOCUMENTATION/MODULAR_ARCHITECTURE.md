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

## SaaS Master Panel Integration

The SaaS panel provides centralized authority over the entire module ecosystem. This allows platform administrators to maintain consistency and enforce subscription boundaries across all tenants.

### Global Module Registry (/admin/saas/modules)
- **Global Sync**: Scans the physical code directory and updates the global `Module` table.
- **Push to All**: A high-privilege action that installs/enables a specific module for EVERY organization in the system simultaneously.

### Granular Tenant Control (/admin/saas/organizations)
- SaaS admins can manage specific features for individual companies via the Organization Management modal. 
- This bypasses tenant-level restrictions and allows for manual entitlement adjustments.

## Workflow: Global Module Deployment
1. **Develop**: Create module folder and manifest in `erp/modules`.
2. **Sync**: Run "Sync Registry" in the SaaS Panel.
3. **Deploy**: Click "Push to All" for mandatory features, or let tenants discover the new feature in their own Module Manager.

---

## Workflow: Module Management (Tenant Level)
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
