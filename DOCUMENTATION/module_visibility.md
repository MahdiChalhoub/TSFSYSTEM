# Module Visibility & Features

## Goal
Control per-module visibility on the platform: which modules appear on the landing page, which are org-specific, and which are internal-only. Also defines per-module features for granular plan control.

## From Where Data is READ
- `GET /api/saas/modules/` — All modules with visibility, description, icon, features
- `GET /api/saas/plans/module-features/` — Feature definitions per module (from manifests)
- `GET /api/saas/pricing/` — Public pricing (only shows modules with visibility='public')

## Where Data is SAVED
- `PATCH /api/saas/modules/{code}/update/` — Update module visibility, description, icon

## Database: SystemModule Table

| Column | Type | Purpose |
|--------|------|---------|
| name | CharField | Module name (unique) |
| version | CharField | Current version |
| status | CharField | INSTALLED/UPGRADING/FAILED/DISABLED |
| visibility | CharField | `public` / `organization` / `private` |
| description | TextField | Short description for display |
| icon | CharField | Lucide icon name (e.g. 'shopping-cart') |
| manifest | JSONField | Full manifest including features list |

### Visibility Levels
- **public** (🌐) — Module and its features appear on the landing page pricing cards
- **organization** (🏢) — Module only visible to orgs that have it enabled; not shown on landing page
- **private** (🔒) — Internal/hidden; never shown publicly (core, coreplatform, demo)

## Module Features (stored in manifest)
Each module's manifest contains a `features` list:
```json
{
  "features": [
    {"code": "basic_sales", "name": "Basic Sales", "default": true},
    {"code": "offline_mode", "name": "Offline POS Mode", "default": false}
  ]
}
```

Plan's `features` field stores which features are enabled per module:
```json
{
  "pos": ["basic_sales", "receipts", "discounts"],
  "finance": ["basic_accounting", "journal_entries"]
}
```

## Current Module Assignments

| Module | Visibility | Features |
|--------|-----------|----------|
| POS | 🌐 Public | 6 features (sales, receipts, discounts, multi-payment, offline, barcode) |
| Finance | 🌐 Public | 7 features (accounting, COA, journals, reports, multi-currency, fiscal, loans) |
| Inventory | 🌐 Public | 6 features (stock, warehouses, movements, batch, analytics, multi-warehouse) |
| CRM | 🌐 Public | 5 features (contacts, groups, loyalty, campaigns, portal) |
| HR | 🌐 Public | 5 features (employees, attendance, payroll, leave, reviews) |
| MCP | 🏢 Org Only | 4 features (AI connector, tool exec, prompts, analysis) |
| Core | 🔒 Private | Always included |
| CorePlatform | 🔒 Private | Always included |
| Demo | 🔒 Private | Testing only |

## Workflow
1. Modules are registered in `SystemModule` table
2. Admin sets visibility per module (public/organization/private)
3. Plans reference modules by code and can enable/disable features per module
4. Landing page pricing only shows public-visibility modules
5. Org-specific modules (like MCP) are assignable to individual orgs but not advertised
