# SaaS Route Refactoring Documentation

## Goal
To promote SaaS management routes from a nested `/admin/saas` structure to a top-level `/saas` namespace for better architectural separation and professional URLs.

## Data Movement
- **Data READ From**: 
  - Django Backend API (`/api/saas/...`)
  - AdminContext (Sidebar state, Active tabs)
- **Data SAVED To**:
  - Django Backend (Tenant provisioning, Module registry, Kernel updates)
  - Browser LocalStorage (Tab persistence)

## User Interaction Variables
- `openTabs`: List of active workspaces.
- `activeTab`: Currently focused path.
- `isSaas`: Boolean context inherited from hostname/subdomain.

## Step-by-Step Workflow
1. **Request Interception**: `middleware.ts` detects `saas.localhost` or `/saas` path.
2. **Context Resolution**: `layout.tsx` validates superuser session and sets `isSaas: true`.
3. **Sidebar Filtering**: `Sidebar.tsx` displays "SaaS Control" root items based on `visibility: 'saas'`.
4. **Navigation**: User clicks a SaaS route (e.g., Dashboard).
5. **Tab Management**: `AdminContext` adds the route to `openTabs` and redirects to the top-level path.

## How it Achieves the Goal
By decoupling SaaS routes from the standard `/admin` prefix while sharing the same infrastructure (Sidebars, Headers) via Next.js Route Groups `(privileged)`, we achieve clean URLs without code duplication.

## Conditional Visibility (Navigation)

The "SaaS Control" section and administrative view switches follow specific visibility rules:

| Element | Condition | Source |
| :--- | :--- | :--- |
| **SaaS Control Menu** | `isSaas` Context | Dynamic Manifest |
| **Declared/Both Switcher** | `isSuperuser` AND `dualViewEnabled` | `global_financial_settings` |

- **Dual View Control**: The visibility of "Declared" vs "Both" options in the sidebar is now strictly controlled by the `dualView` flag in the organization's global financial settings.
- **Superuser Gate**: Even if `dualView` is enabled, the switcher is only presented to users with `is_superuser: true` to prevent confusing standard staff with complex accounting views.
