# Business Services (Restored)

## Goal of the Component
The `erp/services.py` module acts as the central business logic layer for the TSF Platform. It handles complex operations that span multiple models, ensuring that financial integrity, inventory valuation, and SaaS orchestration remain consistent.

## Data Movement
- **READ**: 
    - `erp/models.py`: All core models (Organization, Product, Inventory, ChartOfAccount, etc.)
    - `SystemSettings`: Configuration for posting rules and global finance settings.
- **SAVE**:
    - `erp/models.py`: Updates inventory levels, records financial events, generates journal entries, and provisions new organizations.

## Core Services & Workflows

### 1. ProvisioningService
- **Goal**: Automates the creation of a new organization and its active skeleton.
- **Steps**:
    1. Creates the `Organization` and default `Site`/`Warehouse`.
    2. Sets up a `FiscalYear` and monthly `FiscalPeriod`s.
    3. Injects a standardized Chart of Accounts (COA) template.
    4. Initializes default `FinancialAccount`s (Cash Drawer).
    5. Applies smart posting rules and global settings.

### 2. Finance & Ledger (LedgerService, FinancialAccountService)
- **Goal**: Manage financial accounts and double-entry bookkeeping.
- **Workflow**:
    - `create_account`: Generates a linked `ChartOfAccount` and `FinancialAccount` for a specific site.
    - `create_journal_entry`: Records Balanced transactions using standard Debit/Credit logic.
    - `get_trial_balance`: Aggregates account balances with recursive rollup for the global COA view.

### 3. InventoryService
- **Goal**: Track stock levels and maintain inventory valuation (AMC - Average Moving Cost).
- **Workflow**:
    - `receive_stock`: Increases stock, calculates new AMC, and posts a balanced journal entry (Debit Inventory, Credit Suspense).
    - `reduce_stock`: Decreases stock and captures the current AMC for COGS (Cost of Goods Sold) booking at time of sale.

### 4. POS & Purchase Services
- **Goal**: Orchestrate transaction-heavy operations.
- **POS Workflow**:
    1. Reduces stock via `InventoryService`.
    2. Calculates taxes.
    3. Creates a `Sale` Order.
    4. Records a multi-line Journal Entry (Dr Cash, Cr Revenue, Cr Tax, Dr COGS, Cr Inventory).

## Interaction Variables
- `organization`: Core context for all operations.
- `items`: Transaction lines for POS and Purchases.
- `posting_rules`: JSON configuration mapping business events to COA accounts.

## Tables Affected
- `Organization`, `Site`, `Warehouse`
- `ChartOfAccount`, `FinancialAccount`
- `JournalEntry`, `JournalEntryLine`
- `Product`, `Inventory`, `InventoryMovement`
- `FiscalYear`, `FiscalPeriod`
- `SystemSettings`
