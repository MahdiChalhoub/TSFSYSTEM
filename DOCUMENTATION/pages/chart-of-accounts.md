# Chart of Accounts Page Documentation

## Goal of the page
Manage and view the hierarchical structure of accounting accounts.

## From where data is READ
- Data is read from the Django `ChartOfAccountViewSet.coa` endpoint via the `getChartOfAccounts` server action.

## Where data is SAVED
- Data is saved to the `ChartOfAccount` model in Django via `createAccount` and `updateAccount` actions.

## Variables user interacts with
- `scope`: Toggle between 'INTERNAL' and 'OFFICIAL' accounting views.
- `includeInactive`: Toggle visibility of disabled accounts.
- Account details (Code, Name, Type, Parent).

## Step-by-step workflow
1. User navigates to Chart of Accounts.
2. Server action `getChartOfAccounts` fetches the flat list from Django.
3. Django performs hierarchical rollups and returns calculated balances.
4. The UI renders the accounts tree.

## How the page achieves its goal
Provides a structured view of financial accounts with real-time balance calculations, allowing accounting staff to organize the ledger correctly.
