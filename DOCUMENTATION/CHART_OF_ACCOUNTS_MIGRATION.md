# Chart of Accounts (COA) Migration Guide

## Overview
The Migration Tool allows you to switch from one Chart of Accounts standard (e.g., SYSCOHADA) to another, or to upgrade your current structure, without losing historical balances.

## Workflow

### 1. Select Destination Standard
- Navigate to **Admin > Finance > Chart of Accounts > Migrate**.
- Choose a target template from the library (e.g., `SYSCOHADA_REVISED`, `MINIMAL_SME`).
- The system will create the new account structure alongside your existing active accounts.

### 2. Map Balances
- The system identifies all existing accounts with non-zero balances.
- You must map each "Source" account to a "Destination" account in the new structure.
- **Auto-Map**: The system attempts to match accounts by Code or Name.

### 3. Execution (The "Reclassification")
When you click **Finalize & Post Migration**:
1. A **Reclassification Journal Entry** is created.
   - It **CREDITS** the old Source accounts (bringing them to zero).
   - It **DEBITS** the new Target accounts (transferring the balance).
2. The old Source accounts are marked `is_active=False`.
3. The new Target accounts become the active ledger accounts.
4. Smart Posting Rules are updated to point to the new accounts.

## Technical Details

### Journal Entry Structure
- **Reference**: `MIGRATE-{TIMESTAMP}`
- **Description**: "COA Migration Reclassification"
- **Scope**: Matches the scope of the original balance.

### Restrictions
- Migration cannot be undone automatically (requires manual reversal of the Journal Entry).
- You cannot migrate if you have unposted Draft transactions (they must be Posted or Voided first).

## Verification
After migration:
1. Check **Trial Balance**. It should match the total sums from before.
2. Verify **Account History** of the new accounts. They should show the "Migration Transfer" as the opening transaction.
3. Verify old accounts have a balance of 0.00.
