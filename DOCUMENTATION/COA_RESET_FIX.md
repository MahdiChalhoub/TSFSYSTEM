# COA Reset & Template System Fix

## Goal
Fix the dual Chart of Accounts standard pollution that occurred when both the provisioning event handler's hardcoded mini-COA and a separate `apply_coa_template()` call created accounts in the same organization.

## Root Cause
Two separate code paths were creating COA accounts:

1. **`apps/finance/events.py → _on_org_provisioned()`** — Seeds a hardcoded 17-account mini-COA (codes: 1000-5200) via inline tuples
2. **`apps/finance/services.py → LedgerService.apply_coa_template()`** — Applies a full template from `coa_templates.py` (e.g., IFRS_COA with 76 accounts)

When both ran for the same organization — either because the user applied a different template after provisioning, or the same IFRS template was re-applied — `update_or_create` added new accounts (those in the template but not in the mini-COA) while leaving the original provisioning accounts intact. This resulted in two different COA structures coexisting.

## Fix Applied

### 1. Finance Event Handler (apps/finance/events.py)
- **REMOVED**: Hardcoded 17-account mini-COA template (inline tuples + loop)
- **ADDED**: `LedgerService.apply_coa_template(org, 'IFRS_COA')` — delegates to the centralized template system
- **UPDATED**: Cash Drawer creation to use `FinancialAccountService` instead of manual `account_map` reference
- **UPDATED**: Log message and return value to use DB count instead of deleted `account_map`
- **Result**: New organizations always get a clean, full 76-account IFRS_COA standard via the same code path used for template switching

### 2. Management Command: `reset_coa`
- **File**: `erp/management/commands/reset_coa.py`
- **Purpose**: Wipes ALL financial data (JournalEntryLines → JournalEntries → FinancialAccounts → ChartOfAccounts) and re-applies a clean template
- **Usage**: `python manage.py reset_coa <org_slug> [--template IFRS_COA] [--confirm]`
- **Safety**: Requires typing 'DELETE' to confirm (unless `--confirm` flag is used)
- **Architecture**: Uses modular imports (`apps.finance.models`, `apps.finance.services`)

## Data Flow

### READ
- `Organization` table (by slug) to identify the target org
- `ChartOfAccount` table to count existing accounts
- `coa_templates.py` → `TEMPLATES` dict for the template data

### SAVE (during reset)
- `JournalEntryLine` — DELETE all for org
- `JournalEntry` — DELETE all for org
- `FinancialAccount` — DELETE all for org
- `ChartOfAccount` — DELETE all for org, then CREATE from template
- `Organization.settings` — UPDATE posting rules via `apply_smart_posting_rules()`

## Available Templates
| Key | Standard | Language | Account Count |
|-----|----------|----------|---------------|
| `IFRS_COA` | International Financial Reporting Standards | English | 76 |
| `LEBANESE_PCN` | Lebanese/Algerian PCN (SCF) | French | 34 |
| `FRENCH_PCG` | French Plan Comptable Général | French | 44 |
| `USA_GAAP` | US Generally Accepted Accounting Principles | English | 20 |
| `SYSCOHADA_REVISED` | West/Central African SYSCOHADA | French | 38 |

## Step-by-Step: Resetting an Organization's COA

1. SSH into the server
2. Navigate to `erp_backend/`
3. Run: `python manage.py reset_coa <slug> --template IFRS_COA`
4. Type `DELETE` when prompted
5. Verify on the frontend: `/finance/chart-of-accounts`

## Variables User Interacts With
- `org_slug` — The organization's URL slug (e.g., "saas")
- `--template` — The COA template key (default: IFRS_COA)
- `--confirm` — Skip confirmation for automated scripts

## Architecture Notes
- The kernel `ProvisioningService` (in `erp/services.py`) creates ONLY kernel objects (Org, Site, Warehouse)
- It dispatches `org:provisioned` via ConnectorEngine
- The finance module's event handler (`apps/finance/events.py`) reacts to this event
- All COA creation now goes through `LedgerService.apply_coa_template()` — the Single Source of Truth
