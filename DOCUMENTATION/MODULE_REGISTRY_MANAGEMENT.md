# Module Registry Repair and Management

## Goal
Restore the full visibility of business modules (CRM, Finance, etc.) in the SaaS admin panel by standardizing the module registry and ensuring filesystem synchronization.

## Context
Modules in this architecture are decoupled into separate folders in `erp_backend/apps/`. A module is only recognized if it contains a valid `manifest.json` file. 

## Repair Workflow
1. **Manifest Restoration**: Re-created missing `manifest.json` files for:
    - `crm`
    - `finance`
    - `hr`
    - `inventory`
    - `pos`
2. **Registry Sync**: Executed `python manage.py sync_modules` on the production server to populate the `SystemModule` table.
3. **Admin Provisioning**: Granted access to these modules for the `saas` organization using `ModuleManager.grant_access`.

## Module Structure
Each module MUST followed this layout:
- `apps/[module_name]/`
    - `manifest.json` (Required for registry)
    - `models.py` (Tenant-aware models)
    - `views.py`
    - `urls.py`

## Maintenance
To register a new module:
1. Place code in `apps/`.
2. Ensure `manifest.json` exists.
3. Run `python manage.py sync_modules`.
4. Grant access to desired organizations via the SaaS Modules page.

## Relevant Tables
- `systemmodule`: Global registry of all installed modules.
- `organizationmodule`: Map of which organization has access to which module.
- `systemmodulelog`: Tracking table for installs, upgrades, and deletes.
