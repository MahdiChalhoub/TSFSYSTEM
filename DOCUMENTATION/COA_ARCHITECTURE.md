# Chart of Accounts (COA) Design

## Goal
To provide a standardized, hierarchical structure for all financial transactions, supporting multi-tenant isolation and automated posting rules.

## From where data is READ
- **Tenant Input**: `sub_type` and `name` during account creation.
- **System Defaults**: Root accounts (1xxx, 2xxx, etc.) and standardized sub-types (CASH, BANK, INVENTORY).

## Where data is SAVED
- `ChartOfAccount` table in PostgreSQL.

## Variables user interacts with
- `code`: The account code (hierarchical e.g. 1000.001).
- `name`: Display name.
- `type`: ASSET, LIABILITY, EQUITY, INCOME, EXPENSE.
- `sub_type`: Functional tag (RECEIVABLE, PAYABLE, etc.) used for auto-mapping.
- `parent`: Linked parent account.
- `is_active`: Toggle for account usage.

## Step-by-step workflow
1.  **Skeleton Generation**: During provisioning, the `ProvisioningService` creates a standard tree of accounts.
2.  **Manual Creation**: Users can create specific accounts (e.g. "Main Bank") using `FinancialAccountService`.
3.  **Auto-Coding**: The system automatically generates the next sequential code under the specified parent.
4.  **Posting**: Transactions generate `JournalEntryLine` records linked to these accounts.
5.  **Rollup**: The `LedgerService` calculates aggregate balances by traversing the account hierarchy.
6.  **Revision**: Users can edit existing accounts (Revision Modal) to change their parent, name, or regulatory mappings (SYSCOHADA).
7.  **Migration**: Users can switch entire trees using the Migration Tool, which reclassifies balances and deactivates old nodes.

## How the page achieves its goal
By enforcing a strict coding structure and functional sub-types, the COA allows the system to automate complex accounting tasks (like Cost of Goods Sold and Tax calculations) while keeping the ledger organized and scalable.
