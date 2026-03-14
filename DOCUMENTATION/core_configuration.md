# Core Configuration & Company Types

## Goal
Allow administrators to select and compare company types, understand their implications, and configure dual-view scope access control.

## Data Read From
- `settings/global_financial/` API endpoint — current financial settings
- Settings lock status (fiscal year state)

## Data Saved To
- `settings/global_financial/` API endpoint — saves companyType, currency, tax rates, dualView, etc.

## Variables User Interacts With
- `companyType` — REGULAR, MICRO, REAL, MIXED, CUSTOM
- `currency` — default currency code
- `defaultTaxRate` — standard TVA rate
- `dualView` — auto-set by company type or manually toggled in CUSTOM
- `worksInTTC` — auto-set or manual in CUSTOM
- `declareTVA` — auto-set or manual in CUSTOM
- `salesTaxPercentage` / `purchaseTaxPercentage` — only for MICRO type

## Step-by-Step Workflow
1. User navigates to Finance → Financial Settings
2. Selects a Company Type from the dropdown
3. Full description, features, and recommendation appear below
4. Optionally clicks "Compare Types" to see side-by-side comparison
5. Settings auto-configure based on selected type (except CUSTOM)
6. If MIXED or CUSTOM+dualView: Dual View section appears with scope info
7. User saves configuration

## Company Types

| Type | Pricing | VAT | Dual View | Best For |
|------|---------|-----|-----------|----------|
| REGULAR | TTC | Auto | No | Retail, restaurants |
| MICRO | TTC | Flat % | No | Freelancers, sole proprietors |
| REAL | HT | Full tracking | No | Medium-large businesses |
| MIXED | TTC | Full tracking | Yes (auto) | Dual-scope reporting |
| CUSTOM | Manual | Manual | Optional | Advanced users |

## Dual View Scope Access
When Dual View is enabled, users access scopes via separate credentials:
- **Viewer Password** → Official scope (declared data only)
- **Full Access Password** → Internal scope (full picture)

Per-user scope passwords are managed in HR & Teams → Access Control.

## Sidebar Scope Toggle
When Dual View is active, sidebar shows "Official" / "Internal" scope switcher (visible to superusers only).
