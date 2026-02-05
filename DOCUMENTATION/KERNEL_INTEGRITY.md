# Kernel Integrity & Blanc Engine Standards

## The "Blanc Engine" Philosophy
The Kernel (Core Engine) must be kept strictly minimal. It contains only the essential plumbing for a multi-tenant SaaS. Business modules (Finance, Inventory, etc.) must NEVER pollute the core routing space.

## 1. Directory Isolation
*   **Kernel Space**: `src/app/(privileged)/saas/`. Only "Control Tower" pages (Organizations, Connector, Health) are allowed here.
*   **Module Space**: `src/modules/`. All business logic, module-specific components, and sub-pages live here.

## 2. Dynamic Mounting
To prevent the build process from reading massive module route trees, all modules are mounted via:
`src/app/(privileged)/saas/apps/[code]/page.tsx`

This dynamic catcher handles the permission checks and lazy-loads the module entry point.

## 3. Mandatory Build Checks
The script `scripts/check-kernel-integrity.js` runs before every build. It will **fail the build** if it detects unapproved directories in the Kernel Space.

### Approved Kernel Directories:
- `organizations`
- `connector`
- `subscription`
- `health`
- `updates`
- `switcher`
- `apps` (The mounter)
- `dashboard`

## 4. How to Create a New Module
1. Create a folder in `src/modules/{code}`.
2. Export a `default` component as the entry point.
3. Register the module in the Django backend.
4. Access it via `/saas/apps/{code}`.
