# Restored Module Frontend Pages

## Goal
Recover all deleted module frontend pages (CRM, Finance, Inventory, HR, POS, Products, Purchases) from git history into a `restored/` staging folder for future integration.

## Where Data is READ
- Git history (deleted files from various commits)
- Primary deletion commits: `5b21322`, `22c9cca`, `003024d`

## Where Data is SAVED
- `restored/` folder at project root (staging only, NOT in live `src/`)

## Contents (278 files)

| Module | Location in `restored/` | Files | Type |
|--------|------------------------|-------|------|
| CRM | `src/app/admin/crm/` | 3 | Pages (contacts) |
| Finance | `src/app/(privileged)/saas/finance/` | 48 | Pages, forms, viewers |
| HR | `src/app/admin/hr/` | 3 | Pages (employees) |
| Inventory | `src/app/(privileged)/admin/inventory/` | 17 | Pages |
| Products | `src/app/(privileged)/admin/products/` | 6 | Pages |
| Purchases | `src/app/admin/purchases/` | 3 | Pages |
| Actions | `src/app/actions/` | 23 | Server actions |
| Components | `src/components/` | 9 | Shared components |
| Lib | `src/lib/` | 3 | Utility functions |

## Important Notes

1. **Do NOT copy directly to `src/`** — the restored pages have OLD import paths that must be updated:
   - `@/app/(privileged)/saas/` → `@/app/(privileged)/(saas)/`
   - `@/app/admin/` → `@/app/(privileged)/(saas)/`
   - Some import missing UI components (`progress`, `tabs`)
   - Some import old `@/lib/api` (now uses `@/lib/erp-api`)

2. **Each page must be migrated individually**:
   - Update import paths
   - Replace Prisma calls with `erpFetch()` API calls
   - Verify against current backend API endpoints
   - Test in isolation before adding to live app

3. **The catch-all route** (`src/app/(privileged)/(saas)/[...slug]/page.tsx`) shows "Under Construction" for any unmigrated module pages.

## Step-by-step Workflow for Migrating a Page

1. Pick a page from `restored/`
2. Copy it to the correct `src/app/(privileged)/(saas)/` path
3. Update all import paths
4. Replace any Prisma/direct DB calls with `erpFetch()` calls
5. Create any missing dependencies (UI components, server actions)
6. Test the page in dev mode
7. Commit and push

## Tables Affected
None — this is a frontend-only reference folder.
