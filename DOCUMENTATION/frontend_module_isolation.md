# Frontend Module Isolation — Documentation

## Goal
Ensure the frontend only shows navigation, pages, and data for modules the tenant has enabled. Prevent users from accessing disabled module routes.

## Architecture

### Sidebar Filtering (Already Built)
**File:** `src/components/admin/Sidebar.tsx`

Each item in `MENU_ITEMS` is tagged with a `module` field:
```
{ title: 'Inventory', icon: Box, module: 'inventory', children: [...] }
```

On mount, the Sidebar:
1. Calls `getSaaSModules()` → returns array of installed module objects
2. Builds `installedModules: Set<string>` from the codes
3. Filters `allItems` — items with `module !== 'core'` are hidden if not in the set
4. `MenuItem` component also double-checks: returns `null` if module not installed

### Module Gate (Route Guard)
**File:** `src/components/admin/ModuleGate.tsx`

Client component that wraps module page content:
- Calls `getActiveModules()` on mount
- If module code is in the enabled list → renders children
- If not → shows "Module Not Available" page with shield icon
- Fails open on API error (for usability)

## Data Flow

### From (READ)
- `GET /api/saas/modules/` — list of installed modules with codes
- `GET /api/modules/` — module status (INSTALLED/UNINSTALLED)

### To (WRITE)
- No writes — read-only filtering

### Variables Users Interact With
- Sidebar navigation — only shows enabled modules
- Module gate — blocks direct URL access to disabled modules
- "Module Not Available" page — shown when navigating to disabled module

### Step-by-Step Workflow
1. User opens any privileged page → Sidebar loads
2. `getSaaSModules()` fetches installed modules from backend
3. Sidebar filters `MENU_ITEMS` → hides disabled modules
4. If user manually navigates to `/inventory` and module is disabled:
   - `ModuleGate` checks `getActiveModules()`
   - Shows "Module Not Available" page
   - "Back to Dashboard" link provided

### How This Achieves Its Goal
By filtering nav items AND guarding routes, disabled modules are invisible in the sidebar and inaccessible via direct URL. The system is data-driven — no hardcoded module lists need to be updated when modules are added or removed.

## Usage

### Wrapping a module page:
```tsx
import ModuleGate from '@/components/admin/ModuleGate';

export default function InventoryPage() {
    return (
        <ModuleGate module="inventory" moduleName="Inventory">
            {/* Page content */}
        </ModuleGate>
    );
}
```
