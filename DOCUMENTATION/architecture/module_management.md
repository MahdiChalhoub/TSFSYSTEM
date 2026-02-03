# Module Management System

The goal of the Module Management System is to provide a safe, versioned, and transactional way to extend the ERP system with new features (Modules). It ensures that all modifications adhere to the "System Philosophy" and that dependencies are strictly enforced.

## Architectural Design: "Flat Registry"
The system uses a **Flat Module Registry**.
- **No Sub-Modules**: You cannot install `inventory.warehouses` separately. You install the entire `inventory` module.
- **Monolithic Functionality**: Group related features into a single module (e.g., "Feature A", "Feature B" inside `apps/my_module/`).
- **Feature Flags**: If you need granular control, use `is_enabled` checks within the module itself, but deployment is always atomic.

## Data Models

### [SystemModule](file:///c:/tsfci/erp_backend/erp/models.py)
- **Purpose**: Internal registry of all installed modules on the system.
- **Columns**:
    - `name`: Unique name of the module (e.g. 'inventory').
    - `version`: Semantic version (e.g. '1.0.0').
    - `status`: Deployment state (INSTALLED, UPGRADING, FAILED, DISABLED).
    - `manifest`: JSON copy of the module's `manifest.json`.
    - `checksum`: Integrity hash (SHA-256).
- **Read from**: `ModuleManager.is_enabled`, `ModuleListView`, `SaaSModuleViewSet`.
- **Written to**: `ModuleManager.sync`, `ModuleManager.upgrade`.

### [SystemModuleLog](file:///c:/tsfci/erp_backend/erp/models.py)
- **Purpose**: Auditing for all module-level operations.
- **Columns**:
    - `module_name`: Target module.
    - `from_version`: Previous version.
    - `to_version`: New version.
    - `action`: INSTALL, UPGRADE, DISABLE.
    - `status`: SUCCESS, FAILURE.
    - `logs`: Detailed execution trace.
- **Read from**: Admin auditing views (tbd).
- **Written to**: `ModuleManager.upgrade`.

### [OrganizationModule](file:///c:/tsfci/erp_backend/erp/models.py)
- **Purpose**: Tracks which modules are enabled for a specific tenant (SaaS entitlement).
- **Columns**:
    - `organization`: Reference to tenant.
    - `module_name`: Reference to SystemModule name.
    - `is_enabled`: Boolean flag.
- **Read from**: `ModuleManager.is_enabled`.
- **Written to**: `ModuleManager.grant_access`.

## Workflows

### Module Upgrade/Install
- **Goal**: Safely deploy a new module package.
- **Actors**: SaaS Administrator.
- **Steps**:
    1. Upload `.modpkg.zip`.
    2. System acquires maintenance lock.
    3. Manifest validation and dependency check.
    4. Files extracted and copied to `apps/`.
    5. Django migrations executed.
    6. System registry updated and lock released.
- **Data Movement**: ZIP -> `tmp/` -> `apps/`.
- **Tables affected**: `SystemModule`, `SystemModuleLog`, `OrganizationModule` (if auto-grant).

### Module Export
- **Goal**: Package a module for distribution.
- **Actors**: Developer.
- **Steps**:
    1. Run `python manage.py export_module <name>`.
    2. System verifies `manifest.json`.
    3. ZIP created with all module files.
    4. SHA-256 checksum generated.
- **Data Movement**: `apps/<name>` -> `exports/<name>_<version>.modpkg.zip`.

### Module Lifecycle (SaaS Panel)
The SaaS Panel (`/admin/saas/modules`) provides full control over the module lifecycle. These actions are strictly audited.

#### 1. Module Upload (`.modpkg.zip`)
- **Action**: Administrator uploads a signed zip package via the SaaS Panel.
- **Process**:
  1. File is temporarily saved.
  2. `ModuleManager` extracts and validates the `manifest.json`.
  3. Checks for version compatibility (Upgrade vs Downgrade).
  4. Installs the module to `apps/` and updates the `SystemModule` registry.
- **Outcome**: Module appears in the registry with status `INSTALLED`.

#### 2. Global Push (Install for All)
- **Action**: Administrator clicks "Push to All Tenants".
- **Process**:
  1. Iterates through **all** `Organization` records.
  2. Creates or updates `OrganizationModule` with `is_enabled=True`.
- **Use Case**: Mandatory security updates or core feature rollouts.

#### 3. Global Revoke (Uninstall)
- **Action**: Administrator clicks "Revoke".
- **Process**:
  1. Sets `is_enabled=False` for all `OrganizationModule` records linked to this module.
  2. **Does not delete data**, but feature entitlement is removed immediately.
- **Restriction**: Cannot revoke `core` module.

#### 4. Delete from System
- **Action**: Administrator clicks "Delete from System".
- **Process**:
  1. **Dependency Check**: Verifies no other installed modules depend on this one.
  2. **Registry Wipe**: Removes `SystemModule` and all `OrganizationModule` entries.
  3. **Filesystem Wipe**: Deletes the module directory from `apps/`.
- **Outcome**: Module is completely removed. Re-installation requires a new upload.
