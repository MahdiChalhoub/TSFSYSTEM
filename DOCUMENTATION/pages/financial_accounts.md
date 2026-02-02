# Financial Accounts Page Documentation

**File Path:** `src/app/admin/finance/accounts/page.tsx`

## Goal of the Page
To provide a central interface for managing the organization's financial accounts (Cash Drawers, Bank Accounts, Mobile Wallets). It serves as the entry point for configuring how money flows through the system, bridging the physical handling of funds (by users) with the accounting ledger.

## Data Sources
- **READ:** Fetches list of all financial accounts from the Django backend endpoint `GET /api/accounts/` via `getFinancialAccounts` action.
- **READ:** Fetches available users for assignment (via `UserPicker` component).

## Data Storage
- **CREATE:** New accounts are created via a separate page linked from here (`/admin/finance/accounts/new`).
- **UPDATE:** User assignments are saved to `POST /api/accounts/{id}/assign_user/` and `POST /api/accounts/{id}/remove_user/`.
- **DELETE:** Accounts are deleted via `DELETE /api/accounts/{id}/`.

## User Variables & Interactions
1.  **Account List:** Users view cards representing each financial account.
2.  **Delete Action:** Users can delete an account (Delete button on card) if it has no associated transactions.
3.  **User Assignment:**
    - `Assign User`: Opens a dialog to select a user to "bind" to this account (e.g., a cashier to a specific cash drawer).
    - `Unassign User`: Removes a user's access/responsibility for the account.
4.  **Navigation:** "New Account" button redirects to the creation form.

## Workflow
1.  **Initialization:** On page load, `useEffect` calls `getFinancialAccounts` to retrieve the current list.
2.  **Display:**
    - Accounts are rendered as cards (`AccountCard`).
    - Each card displays the account name, type icon (Cash/Bank/Mobile), currency, and ledger link status.
    - **Health Check:** If `ledgerAccount` is missing, a warning "Missing Ledger Link!" is displayed.
3.  **Management:**
    - **Assignment:** Admin clicks "+ Assign", selects a user from `UserPicker`, and confirms. The list updates to show the assigned user on the card.
    - **Deletion:** Admin clicks trash icon. System asks for confirmation. If confirmed, calls `deleteFinancialAccount`.
4.  **Error Handling:** Displays toasts for success/failure of operations.

## Technical Implementation
- Uses `useClient` for interaction.
- `erpFetch` utility handles authenticated requests to the backend.
- `revalidatePath` in server actions ensures the list is fresh after mutations.
