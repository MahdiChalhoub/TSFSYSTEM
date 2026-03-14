# Global Registry & Module Management

## Goal of the Page
The **Global Registry** (located at `/modules`) is the administrative "Cockpit" for the SaaS platform. It allows staff/superusers to manage the distribution of code modules across the entire tenant ecosystem.

## From where data is READ
- **Backend API**: `GET /api/saas/modules/` (returns the list of modules detected in the filesystem).
- **Organization State**: `GET /api/saas/org-modules/` (tracks which modules are enabled for which tenant).

## Where data is SAVED
- **SystemModule Table**: Stores metadata about discovered modules.
- **OrganizationModule Table**: Links organizations to specific modules.
- **SystemModuleLog Table**: Records history of installs, upgrades, and uninstalls for auditing.

## Variables User Interacts With
- `Sync`: Triggers a filesystem scan to discover new module directories.
- `Upload`: Allows manual injection of zipped module packages.
- `Push`: Enables a module for ALL current and future organizations.
- `Revoke`: Disables a module system-wide (Safe mode).
- `Delete`: Removes a module from the registry permanently (Blocked if data usage detected).
- `Rollback`: Restores a module to a historical version from backup.

## Step-by-Step Workflow

### 1. Discovery & Sync
1. The user clicks **Sync**.
2. The backend (`ModuleRegistry` service) scans the `apps/` or `modules/` directory.
3. New `manifest.json` files are parsed.
4. Entries are created or updated in the `SystemModule` table.

### 2. Global Distribution (Push)
1. User clicks **Push** on a module.
2. The system checks for dependencies.
3. `OrganizationModule` records are created for all active `Organization`s.
4. Any required database migrations for that module are triggered globally.

### 3. Safety Auditing
Every action is recorded in `SystemModuleLog` with:
- Performed By (User ID)
- Version Change (From/To)
- Output/Error Logs (for debugging migration failures).

## How the page achieves its goal
By providing a clear visual representation of "Core" vs "Extension" modules and abstracting the complexity of multi-tenant migrations into a single-click "Push" action, the page ensures that system updates are synchronized across the entire SaaS infrastructure with zero-touch per tenant.
