# Chart of Accounts (COA) Documentation

**File Path:** `src/app/admin/finance/chart-of-accounts/page.tsx`, `erp/views.py`, `erp/services.py`

## Goal
The Chart of Accounts (COA) is the backbone of the accounting system. It lists all the accounts used to categorize financial transactions. This module allows viewing the hierarchy of accounts, their types (Asset, Liability, Equity, Revenue, Expense), and their current balances.

## Data Sources
- **READ:** 
    - `GET /api/coa/coa/?scope={scope}&include_inactive={bool}` - Fetches the full COA tree with realtime balances.
    - `GET /api/coa/{id}/statement/` - Fetches the general ledger statement (transactions) for a specific account.
- **WRITE:**
    - Standard CRUD operations for Accounts (Create, Update, Delete) are handled via `ChartOfAccountViewSet`.

## Data Storage
- **Tables:** `erp_chartofaccount`, `erp_journalentryline`
- **Relationships:**
    - Self-referencing `parent_id` for hierarchy.
    - Linked to `Organization`.
    - Referenced by `JournalEntryLine` for all financial movements.

## Key Logic
- **Realtime Balances:** The backend calculates `temp_balance` (direct balance) and `rollup_balance` (balance including children) dynamically on every request to ensure up-to-date figures without persistent denormalization risks.
- **Scope Isolation:** Supports `OFFICIAL` vs `INTERNAL` scopes to separate tax-reporting figures from management figures.
- **Tree Structure:** The frontend receives a flat list but relies on `parentId` and `syscohadaCode` to render the indented tree structure.

## User Interactions
1.  **View COA:** Users see a tree view of accounts.
2.  **Scopes:** Toggle between "Internal" and "Official" views (if Dual View is enabled).
3.  **Expand/Collapse:** Users can drill down into account groups.
4.  **Statement:** Clicking an account opens its ledger statement.

## Recent Fixes
- **[v0.1.2-b001]**: Fixed `AttributeError: temp_balance` by ensuring `LedgerService.get_chart_of_accounts` computes annotations locally instead of relying on missing DB fields.
