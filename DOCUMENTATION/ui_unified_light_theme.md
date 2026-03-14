# Global Unified Light Theme

## Goal of the UI
The Dajingo Platform has been unified under a "Clean Light" theme (v1.1.2) to provide a professional, consistent, and high-fidelity experience across both general administration and the privileged SaaS panel. This replaces the experiment with dark themes in the SaaS area, prioritizing brand coherence and visual ergonomics.

## From where data is READ
- **Tenant Context**: Organization and site data from `getTenantContext`.
- **System Stats**: SaaS metrics from direct kernel API endpoints.
- **Module Registry**: Filesystem-based module metadata.

## Where data is SAVED
- **Theme Settings**: No persistent DB save; purely CSS/Tailwind-driven at the layout level.
- **UI State**: Sidebar toggles and tab navigation states are managed via local storage/browser state.

## Variables user interacts with
- **Search Bar**: Filtering tenants and menu items.
- **Site/Tenant Switcher**: Rapid context swapping.
- **Provision Buttons**: Creating new instances.
- **Push/Sync Buttons**: Global module registry control.

## Step-by-step workflow
1. **Layout Initialization**: `AdminLayout` sets the `bg-gray-50` base.
2. **Nesting logic**: Child components (`AdminDashboard`, `SaasLayout`) inherit text defaults (`text-gray-900`).
3. **Card Rendering**: All content is encapsulated in `bg-white` cards with `shadow-xl` and `border-gray-100` for a "lifted" feel.
4. **Accent Application**: `emerald-600` is the primary action color; `indigo-600` is the system-level (SaaS) action color.

## How the UI achieves its goal
By delegating background styling to the base layout and using a strict palette of `white`, `gray-50`, and `gray-900`, the platform ensures that even the most complex SaaS management tools feel like a natural extension of the standard business modules.
