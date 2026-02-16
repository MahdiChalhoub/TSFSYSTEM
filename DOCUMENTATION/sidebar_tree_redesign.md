# Sidebar Tree Redesign

## Goal
Restructure the sidebar navigation from flat page lists to a tree hierarchy: **Module → Feature Group → Page**.

## Data Read From
- `getSaaSModules()` — determines which modules are installed (used for filtering)
- `getDynamicSidebar()` — fetches dynamic sidebar items from backend
- `useAdmin()` context — provides `activeTab`, `openTab`, `viewScope`, `sidebarOpen`

## Data Saved To
- No data is saved. Sidebar is read-only navigation.

## Variables User Interacts With
- **Module accordion** — click to expand/collapse a module (e.g., Finance)
- **Feature group accordion** — click to expand/collapse a feature group (e.g., Accounts & Ledger)
- **Page link** — click to navigate to a specific page
- **View scope toggle** — OFFICIAL vs INTERNAL (existing)

## Tree Structure

### Finance (7 groups)
- Performance Dashboard
- Accounts & Ledger (6 pages)
- Reports (4 pages)
- Fiscal & Periods (1 page)
- Loans & Pricing (2 pages)
- Events & Automation (2 pages)
- Financial Settings

### Inventory (4 groups)
- Products (3 pages)
- Warehousing (4 pages)
- Catalog Setup (6 pages)
- System Maintenance

### Commercial (2 groups)
- Point of Sale (1 page)
- Purchasing (2 pages)

### SaaS Control (3 groups)
- Platform (3 pages)
- Organizations (3 pages)
- Infrastructure (3 pages)

## Files Modified
- `src/components/admin/Sidebar.tsx` — Restructured `MENU_ITEMS` array

## How It Works
1. `MENU_ITEMS` defines the tree structure as nested objects with `children` arrays
2. The recursive `MenuItem` component renders each level with proper indentation
3. Active state detection propagates up via recursive `checkActive()` function
4. Each level gets progressively smaller padding and text via `level` prop
