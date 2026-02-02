# Finance Module Plan - Fix Import Error

## Goal
Fix the `Module not found` error in the "New Financial Account" page by correcting the import path for server actions.

## Context
The file `src/app/admin/finance/accounts/new/page.tsx` attempts to import `createFinancialAccount` from `./actions`.
However, `actions.ts` is located in the parent directory: `src/app/admin/finance/accounts/actions.ts`.

## Proposed Changes
### Finance Module
- **src/app/admin/finance/accounts/new/page.tsx**: Update line 9 to import from `../actions`.

## Verification Plan
1. Check if the file compiles (no build error).
2. Verify that the "New Financial Account" page loads correctly.
