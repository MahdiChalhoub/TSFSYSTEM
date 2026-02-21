# Finance Accounts Fixes Documentation

## Goal
Fix three account management issues: auto-ledger link display (#18), currency from org defaults (#22), and card action buttons (#20).

## Root Cause Analysis

### #18 — Account-Ledger Auto-Link Display
**Problem**: `FinancialAccountSerializer` used `fields='__all__'`, returning `linked_coa` as a raw FK integer. Frontend `AccountCard` expected `account.ledgerAccount.code` (nested object).
**Fix**: Added `ledgerAccount` SerializerMethodField returning `{id, code, name, type}` from the linked CoA. Added `select_related('linked_coa')` to ViewSet queryset.

### #22 — Currency From System Defaults
**Problem**: New account form hardcoded `currency: 'USD'`.
**Fix**: Added `getOrgCurrency()` server action that fetches the org's `base_currency` from `auth/me/`. Form now auto-populates currency on mount.

### #20 — Card Action Buttons
**Problem**: AccountCard only had Delete and Assign User. No way to view the linked ledger or account statement.
**Fix**: Added Balance display, View Ledger button (links to `/finance/ledger?account=ID`), and Statement button (links to `/finance/bank-reconciliation?account_id=ID`).

## Files Modified

### Backend
| File | Change |
|------|--------|
| `apps/finance/serializers.py` | Added `ledgerAccount` + `assignedUsers` method fields to `FinancialAccountSerializer` |
| `apps/finance/views.py` | Added `select_related('linked_coa')` to `FinancialAccountViewSet.queryset` |

### Frontend
| File | Change |
|------|--------|
| `finance/accounts/actions.ts` | Added `getOrgCurrency()` and `getAccountBalance()` server actions |
| `finance/accounts/new/page.tsx` | Currency field auto-populated from org settings via `getOrgCurrency()` |
| `finance/accounts/page.tsx` | AccountCard enhanced with balance display, View Ledger + Statement buttons |

## Data Flow

```
GET /api/accounts/ → FinancialAccountSerializer
  └─ ledgerAccount: { id, code, name, type } (from linked_coa FK)
  └─ assignedUsers: [{ id, name }] (from User.cash_register reverse FK)

POST /api/accounts/ → FinancialAccountService.create_account()
  └─ Auto-creates ChartOfAccount entry under parent (CASH→5700, BANK→5120, MOBILE→5121)
  └─ Links via FinancialAccount.linked_coa FK
```

## Variables
- `ledgerAccount` — nested CoA data returned by serializer
- `assignedUsers` — list of users with `cash_register` pointing to this account
- `balance` — current account balance (from model field)
- `currency` — auto-populated from `Organization.base_currency` FK
