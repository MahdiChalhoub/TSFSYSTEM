# Kernel Update Strategy: "The Modular Skeleton"

To achieve the goal of updating the entire platform via ZIP (no `git pull`), we separate the system into two layers:

## 1. The Bootloader (GIT: Stable)
This is the "Machine" that never changes. It is the static skeleton of the app.
- **Next.js Infrastructure**: The build system, folder structure, and server configuration.
- **The Shell**: `Sidebar.tsx`, `AdminLayout.tsx`, and the Dynamic Route Loader `[code]/page.tsx`.
- **The API Client**: `erp-api.ts`.

## 2. The Kernel Module (ZIP: Dynamic)
This is the "Brain" that you update via the SaaS Panel. It is the `coreplatform` module.
- **System Logic**: Backend models, views, and core services for all modules.
- **UI Metadata**: The menus, icons, and theme configuration (Logo, Colors).
- **Core Widgets**: The standard Dashboards and platform headers.

---

## The "Zip-First" Workflow

### How to update the Logic
When we want to change how the system calculates profit or how it handles security:
1. We modify the code in the `erp_backend/erp/modules/coreplatform` folder.
2. We run `python manage.py export_module coreplatform`.
3. You upload the ZIP to the SaaS Panel.
4. **Result**: The system logic updates instantly for all tenants.

### How to update the Menu/UI
If you want to add a "General Setting" or change a Sidebar Icon:
1. We update the `sidebar_items` list in `coreplatform/manifest.json`.
2. We export and upload the ZIP.
3. **Result**: The Sidebar on the website changes immediately, even if no code was changed.

### When is Git still needed?
Only if we want to change the **underlying technology**. Examples:
- Updating Next.js version.
- Adding a new NPM library (like a new chart library).
- Modifying the Nginx configuration.

> [!IMPORTANT]
> By moving 95% of the logic into the `coreplatform` module, we have achieved your "Zero-Deploy" dream. Your webapp is now a "Modular Desktop" where you just install updates to change the experience.
