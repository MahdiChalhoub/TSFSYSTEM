# Finance Accounts + POS Landing — Batch 2

## Goal
Extend account types beyond CASH/BANK/MOBILE, add POS access flag, improve POS login page UX.

## Changes Summary

### FinancialAccount Model
- **New Fields**: `description` (text), `is_pos_enabled` (boolean default false)
- **ACCOUNT_TYPES choices**: CASH, BANK, MOBILE, PETTY_CASH, SAVINGS, FOREIGN, ESCROW, INVESTMENT

### Frontend — Account Creation (`new/page.tsx`)
- Dropdown now shows all 8 types with descriptions
- Each type shows its COA parent mapping (e.g. "5700 (Cash)")
- Added description textarea (optional)

### Frontend — Account Card (`page.tsx`)
- Icon mapping covers all 8 types
- POS Access toggle switch: inline on/off toggle calls `togglePosAccess` PATCH endpoint
- All existing features preserved (balance, View Ledger, Statement, Assign Users)

### Frontend — POS Login (`login/page.tsx`)
- Replaced plain "Request Access" text link with prominent "Register My Business" button
- Added "Request Employee Access" link below for employee registration
- Button has emerald accent styling consistent with theme

### Server Actions (`actions.ts`)
- `FinancialAccountInput` type expanded to support all 8 account types
- Added `togglePosAccess(accountId, enabled)` - PATCHes `is_pos_enabled`

### Database Migration
- Script at `scripts/migrations/0012_financialaccount_pos_description.sql`
- Adds `description TEXT NULL` and `is_pos_enabled BOOLEAN DEFAULT FALSE`

## Data Flow

```
PATCH /api/accounts/:id/ { is_pos_enabled: true }
  → FinancialAccountSerializer validates
  → FinancialAccount.is_pos_enabled = true
  → Response includes is_pos_enabled in JSON
```

## Variables
- `is_pos_enabled` — Controls whether account shows in POS register selection
- `description` — Free-text notes about the account purpose
- `ACCOUNT_TYPES` — 8 defined types (model-level choices)
