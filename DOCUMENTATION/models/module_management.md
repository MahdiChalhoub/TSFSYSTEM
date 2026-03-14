# Model Documentation: Module Registry

## Table: Module
- **Table Purpose**: Global catalog of all features/modules available in the system code.
- **Columns**:
    - `id`: Internal ID.
    - `code`: Unique string identifier (e.g., 'inventory').
    - `name`: Display name.
    - `version`: Module version.
    - `description`: Feature summary.
    - `dependencies`: JSON list of required module codes.
    - `is_core`: Boolean flag for non-optional features.
- **Relationships**: Parent to `OrganizationModule`.
- **Which pages read from it**:
    - `admin/settings/modules/page.tsx`
    - `admin/saas/modules/page.tsx`
- **Which pages write to it**:
    - `SaaSModuleViewSet.sync_global` (Fast scan).
    - `sync_modules` management command (CLI background).

---

## Table: OrganizationModule
- **Table Purpose**: Tracks module activation and status per tenant.
- **Columns**:
    - `organization_id`: Links to a specific tenant.
    - `module_id`: Links to the global module registry.
    - `status`: `INSTALLED`, `DISABLED`, or `UNINSTALLED`.
- **Relationships**:
    - ForeignKey to `Organization`.
    - ForeignKey to `Module`.
- **Which pages read from it**:
    - `admin/settings/modules/page.tsx`
    - `admin/saas/modules/page.tsx`
    - `admin/saas/organizations/page.tsx`
- **Which pages write to it**:
    - `admin/settings/modules/page.tsx` (Tenant self-service).
    - `OrgModuleViewSet.toggle_module` (SaaS Admin override).
    - `SaaSModuleViewSet.install_global` (Master push).
