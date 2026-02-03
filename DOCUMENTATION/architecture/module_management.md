# Module Management System

## Goal
The goal of the Module Management System is to provide a safe, versioned, and transactional way to extend the ERP system with new features (Modules). It ensures that all modifications adhere to the "System Philosophy" and that dependencies are strictly enforced.

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
