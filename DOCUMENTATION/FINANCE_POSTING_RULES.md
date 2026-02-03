# Transaction Auto-Mapping (Posting Rules)

## Goal
The Posting Rules system (Auto-Mapping) allows the TSF Financial Engine to automatically generate double-entry journal records for operational events (Sales, Purchases, Inventory adjustments, etc.) without requiring manual account selection for every transaction.

## Data Structure: `PostingRulesConfig`
The configuration is stored as a JSON blob in `SystemSettings` under the key `finance_posting_rules`.

### Schema
- `sales`:
  - `receivable`: Accounts Receivable (Asset)
  - `revenue`: Sales Revenue (Income)
  - `cogs`: Cost of Goods Sold (Expense)
  - `inventory`: Inventory Asset (Asset)
- `purchases`:
  - `payable`: Accounts Payable (Liability)
  - `inventory`: Inventory Purchase (typically mapped to Stock/Inventory Asset)
  - `tax`: Input VAT Recoverable (Asset/Liability)
- `inventory`:
  - `adjustment`: Inventory Gains/Losses (Expense/Income)
  - `transfer`: Inter-Warehouse Transfer (Suspense Asset)
- `automation` (NEW):
  - `customerRoot`: Parent account for auto-generated customer sub-accounts (e.g., 411000)
  - `supplierRoot`: Parent account for auto-generated supplier sub-accounts (e.g., 401000)
  - `payrollRoot`: Parent account for employee accrual accounts
- `fixedAssets`:
  - `depreciationExpense`: Depreciation Expense (Expense)
  - `accumulatedDepreciation`: Accumulated Depreciation (Contra-Asset)
- `suspense`:
  - `reception`: Accrued Reception / Goods Received Not Invoiced (Liability)
- `partners`:
  - `capital`: Capital/Owner's Equity
  - `loan`: Member Loans
  - `withdrawal`: Owner Withdrawals

## Workflows

### 1. Smart Apply (Auto-Detection)
- **Goal**: Automatically scan the tenant's Chart of Accounts and wire the rules to the correct accounts based on standard accounting codes (SYSCOHADA, IFRS).
- **Endpoint**: `POST /api/settings/smart_apply/`
- **Logic**: Backend matches common codes (e.g., '1110' for Receivable, '4100' for Revenue).

### 2. Manual Configuration
- **Goal**: Allow the Manager to manually override mappings.
- **Page**: `/admin/finance/settings/posting-rules`
- **Save Action**: `POST /api/settings/posting_rules/`

## Data Movement
- **READ**: 
  - `ConfigurationService.get_posting_rules`: Retrieves merged config (Stored Settings + System Defaults).
- **WRITE**:
  - `ConfigurationService.save_posting_rules`: Updates `SystemSettings` with the new JSON configuration.

## Affected Components
- **PurchaseService**: Uses `purchases` and `suspense` rules for PO and Invoice booking.
- **InventoryService**: Uses `sales.inventory` and `suspense.reception` for stock movements.
- **POSService**: Uses `sales.revenue`, `sales.receivable`, and `sales.cogs`.
- **LedgerService**: Consumes these rules to resolve `account_id` for automated entries.

## Security Compliance
- **Rule 2**: Schema validation is performed on both Frontend (TypeScript) and Backend (Python Dictionary Update) to prevent injection of unknown keys into the settings blob.
- **Rule 10**: Authorization is strictly organization-based.
