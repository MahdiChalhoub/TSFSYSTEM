# Page Documentation: Module Manager

## Goal of the page
Allow organization admins to browse available system features and install, enable, or disable them.

## From where data is READ
- **API**: `/api/modules/`
- **Backend Service**: `ModuleManager.discover()` and `OrganizationModule` trial balance.

## Where data is SAVED
- **API**: `/api/modules/{code}/enable/` and `/api/modules/{code}/disable/`
- **Table**: `OrganizationModule`

## Variables user interacts with
- **Module Toggle**: Install/Disable button for each feature card.

## Step-by-Step workflow
1. User navigates to Settings -> Module Manager.
2. Page fetches all registered modules from the backend.
3. User identifies a module (e.g., Inventory) and clicks "Install".
4. Frontend calls server action `enableModule`.
5. Backend verifies dependencies.
6. Status updates to `INSTALLED` in `OrganizationModule`.
7. UI reflects the new status instantly.

## How the page achieves its goal
By providing a clear visual representation of system capabilities and abstracting the complexity of dependency management into a simple toggle interface.
