# COA Migration Workflow

## Goal
To allow an organization to move from one Chart of Accounts standard (e.g. IFRS) to another (e.g. Revised SYSCOHADA) while preserving historical balance integrity and reclassifying all current balances into the new structure.

## Actors
- **Finance Manager / Admin**: Initiates the migration and performs account mapping.
- **Ledger Service (Backend)**: Calculates differences and generates reclassification Journal Entries.

## Step-by-Step Workflow
1.  **Template Selection**: The user selects a target template from the Templates Library.
2.  **Layout Preparation**: The system loads the target standard into the organization's COA (inactive/new nodes).
3.  **Mapping**: The user maps each old account (with a balance > 0) to a new target account in the new standard.
4.  **Smart Match**: An automatic match attempts to link accounts by code or name to speed up the process.
5.  **Execution**: Upon "Finalize & Post", the system:
    - Calculates the current `Official` and `Total` (including Internal) balances for all mapped source accounts.
    - Creates a **Reclassification Journal Entry (MIG-OFF-XXXX)** for Official balances.
    - Creates an **Internal Adjustment Entry (MIG-INT-XXXX)** for the delta between Internal and Official balances.
    - Deactivates the source accounts (`is_active = False`).
    - Syncs the Posting Rules (`apply_smart_posting_rules`) to point the automated modules (Inventory, Sales, etc.) to the new target accounts.

## Data Movement
- **FROM**: Old `ChartOfAccount` balances.
- **TO**: New `ChartOfAccount` balances via `JournalEntryLine`.

## Tables Affected
- `ChartOfAccount`: Modified (deactivated/updated).
- `JournalEntry`: Created.
- `JournalEntryLine`: Created.
- `SystemSettings`: Updated (posting rules JSON).

## Validation Rules
- Migration cannot be performed if there are unposted drafts (recommended).
- All source accounts with balances MUST be mapped to a target.
- Target accounts must exist in the same organization.
