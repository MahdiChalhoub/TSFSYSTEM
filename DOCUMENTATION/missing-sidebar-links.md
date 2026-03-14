# Missing Sidebar Links Documentation

## Goal
Add sidebar navigation entries for pages that exist in the codebase but were not accessible via the sidebar.

## Data Read
- `MENU_ITEMS` array in `Sidebar.tsx`
- File system scan of `src/app/(privileged)/` for `page.tsx` files

## Data Saved
- Updated `MENU_ITEMS` array in `Sidebar.tsx` with 8 new entries.

## Variables User Interacts With
- Sidebar navigation items in the admin UI.

## Step-by-Step Workflow
1. Scanned all `page.tsx` files under `sales/`, `purchases/`, `inventory/`, and `settings/`.
2. Compared against existing `MENU_ITEMS` entries in `Sidebar.tsx`.
3. Identified 8 pages with no sidebar entry.
4. Added entries to the appropriate menu groups.

## How This Achieves Its Goal
Users can now navigate to all implemented pages from the sidebar without needing to know the URL.

## New Sidebar Entries Added

| Module | Title | Path |
|--------|-------|------|
| Commercial → Point of Sale | Sales Returns | `/sales/returns` |
| Commercial → Point of Sale | Import Sales | `/sales/import` |
| Commercial → Purchasing | Purchase Returns | `/purchases/returns` |
| Commercial → Purchasing | Supplier Sourcing | `/purchases/sourcing` |
| Inventory → Warehousing | Serial Numbers | `/inventory/serials` |
| Inventory → Warehousing | Stock Count | `/inventory/stock-count` |
| System Settings | Roles & Permissions | `/settings/roles` |
| System Settings | Security Settings | `/settings/security` |

## File Modified
- `src/components/admin/Sidebar.tsx`
