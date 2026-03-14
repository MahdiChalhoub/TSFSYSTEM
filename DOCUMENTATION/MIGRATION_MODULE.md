# Migration Module Documentation

## Goal
Allow importing data from third-party systems (UltimatePOS, Odoo, etc.) into TSF.

## Where Data is READ
- **Backend API:** `migration/migration-jobs/` (list, create, preview, start, rollback)
- **SQL dump file:** Uploaded by user, parsed server-side

## Where Data is SAVED
- **Backend:** `apps.migration` Django app → `MigrationJob` model
- **Target tables:** inventory (products, units, brands, categories), CRM (contacts), POS (transactions), finance (accounts)

## Variables User Interacts With
| Variable | Description |
|----------|-------------|
| Source Type | Third-party system (UltimatePOS, Odoo, etc.) |
| SQL Dump File | The uploaded database export file |
| Business | Which business within the dump to import |
| Migration Mode | How to handle conflicts (e.g., skip, overwrite) |

## Step-by-Step Workflow
1. User selects import source (UltimatePOS, Odoo, etc.)
2. User uploads SQL dump file
3. Backend parses the file and shows available businesses
4. User selects which business to import
5. Backend previews the data to be imported (counts per entity)
6. User starts migration → backend processes data step by step
7. Results page shows imported counts and any errors
8. User can rollback if needed

## How the Page Achieves Its Goal
- **Frontend:** `src/modules/migration/page.tsx` — wizard-style UI with steps (LIST → SOURCE → UPLOAD → BUSINESSES → PREVIEW → RUNNING → RESULTS)
- **Route:** `src/app/(privileged)/migration/page.tsx` — re-exports the module page
- **Server Actions:** `src/modules/migration/actions.ts` — API calls to the migration backend
- **Backend:** `erp_backend/apps/migration/` — Django app with models, views, and services for parsing and importing data
- **Manifest:** `src/modules/migration/manifest.json` — module code `migration`, icon `Globe`
