# COA Template Switching

## Goal
Allow organizations to switch between Chart of Accounts standards (IFRS, SYSCOHADA, Lebanese PCN, French PCG, US GAAP) cleanly without mixing accounts from different standards.

## Data Read From
- `erp/coa_templates.py` — TEMPLATES dictionary (5 templates)
- `chartofaccount` table — existing accounts for the organization

## Data Saved To
- `chartofaccount` table — new accounts created/updated, old ones deactivated

## Variables User Interacts With
- `template_key` — which template to apply (IFRS_COA, LEBANESE_PCN, FRENCH_PCG, USA_GAAP, SYSCOHADA_REVISED)
- `reset` — whether to clear old accounts before applying (required for switching standards)

## Step-by-Step Workflow
1. User selects a template from the COA page
2. Frontend calls `POST /api/coa/apply_template/` with `{template_key, reset}`
3. Backend checks if journal entries exist
4. If reset=true and no journal entries: deletes all old accounts, creates new ones
5. If reset=true and journal entries exist: deactivates old accounts, creates new ones, deactivates any remaining old ones
6. If reset=false: creates/updates accounts matching by code (additive)
7. Parent-child relationships are set using `parent_code` field in the template
8. Smart posting rules are applied if available

## How It Achieves Its Goal
- **Two-pass approach**: First creates all accounts without parents, then sets parent relationships using `parent_code` lookup
- **Clean switching**: When reset=true, accounts from the old standard are deactivated/deleted so they don't appear in the COA view
- **Safe with transactions**: If journal entries reference old accounts, accounts are deactivated (not deleted) to preserve referential integrity
- **Dual key support**: Handles both camelCase (frontend format) and snake_case (backend format) field names

## Available Templates
| Key | Name | Origin |
|-----|------|--------|
| IFRS_COA | IFRS COA | International (75 accounts) |
| LEBANESE_PCN | Lebanese PCN | Lebanon (34 accounts) |
| FRENCH_PCG | French PCG | France (41 accounts) |
| USA_GAAP | US GAAP | United States (20 accounts) |
| SYSCOHADA_REVISED | SYSCOHADA Revised | West/Central Africa (37 accounts) |
