# Management Layout & Responsiveness System

## Goal of the Component
The Management Layout provides a unified, responsive container for all administrative and SaaS operations. It ensures consistent navigation, branding, and spacing while supporting diverse page designs (from simple lists to complex dashboards).

## Global Layout ([AdminLayout](file:///c:/tsfci/src/app/admin/layout.tsx))
- **Role**: Empty shell for viewport management.
- **Data READ**: Authenticated User, Subdomain (Tenant Context), Sites, Organizations.
- **Responsiveness**: 
  - Desktop: Sidebar is persistent or toggleable (`lg:relative`).
  - Mobile: Sidebar is a hidden drawer with a backdrop overlay (`fixed z-50`).

## SaaS Context ([SaasLayout](file:///c:/tsfci/src/app/admin/saas/layout.tsx))
- **Role**: Specialized enclosure for system-level management.
- **Responsiveness**:
  - Background: Full-width `bg-[#020617]` (Deep Dark).
  - Padding: `p-4 md:p-8` (Adaptive).
  - Max-Width: `max-w-[1800px]` (Ultra-wide optimization).

## Sidebar Navigation ([Sidebar.tsx](file:///c:/tsfci/src/components/admin/Sidebar.tsx))
- **Variables**: `sidebarOpen`, `installedModules`, `viewScope`.
- **Workflow**:
  1. Initialize with core menu items.
  2. Fetch dynamic modules from `/api/saas/modules`.
  3. Filter items based on SaaS visibility and module presence.
  4. Render hierarchical links with active state tracking.

## Pages Updated
- **SaaS Dashboard**: Infrastructure pulse and stats.
- **Organizations Manager**: Tenant provisioning and status control.
- **Module Registry**: Global feature activation and package management.
- **System Updates**: Kernel-level staging and application.

## Responsive Workflow
1. Detect viewport width (Tailwind breakpoints: `sm`, `md`, `lg`, `xl`).
2. Adjust grid columns (`grid-cols-1` to `md:grid-cols-2` or `lg:grid-cols-3`).
3. Re-orient flexbox containers (`flex-col` on mobile, `flex-row` on desktop).
4. Scale font sizes and container padding for optimal readability.
