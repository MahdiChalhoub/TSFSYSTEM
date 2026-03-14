# Database Documentation: Modular Registry

## Table: erp_systemmodule (SystemModule)
- **Goal**: Registered "Apps" installed on the physical server.
- **Columns**:
    - `name`: Module Identifier (e.g., 'finance').
    - `version`: Semantic version (from manifest).
    - `status`: INSTALLED, UPGRADING, FAILED.
    - `manifest`: JSON field with capabilities and requirements.
    - `checksum`: Integrity hash for the ZIP package.
- **Relationships**: Parent to `OrganizationModule`.
- **Read by**: `ModuleManager`, `SaaSModuleViewSet`, `Sidebar.tsx`.
- **Written by**: `ModuleManager.sync`, `ModuleManager.upgrade`.

## Table: erp_organizationmodule (OrganizationModule)
- **Goal**: Tenant-specific entitlements.
- **Columns**:
    - `organization_id`: Owner of the entitlement.
    - `module_name`: Link to SystemModule.
    - `is_enabled`: Boolean flag.
    - `active_features`: JSON array of enabled feature codes.
- **Relationships**: Linked to `Organization` and `SystemModule`.
- **Read by**: `ConnectorEngine`, `Sidebar.tsx`, `PermissionService`.
- **Written by**: `ModuleManager.grant_access`, `OrgModuleViewSet`.

## Table: erp_systemupdate (SystemUpdate)
- **Goal**: Track Kernel/Engine versioning.
- **Columns**:
    - `version`: Kernel version.
    - `is_applied`: Boolean status.
    - `package_hash`: For integrity verification.
    - `applied_at`: Timestamp.
- **Read by**: `KernelManager`.
- **Written by**: `KernelManager.apply_update`.
