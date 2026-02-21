# Finance Account Per-Type RBAC Documentation

## Goal
Restrict financial account visibility based on user role permissions, using the existing RBAC kernel.

## Permission Codes

| Code | Description |
|---|---|
| `finance.account.cash` | View/manage Cash Drawers |
| `finance.account.bank` | View/manage Bank Accounts |
| `finance.account.mobile` | View/manage Mobile Wallets |
| `finance.account.petty_cash` | View/manage Petty Cash |
| `finance.account.savings` | View/manage Savings Accounts |
| `finance.account.foreign` | View/manage Foreign Currency |
| `finance.account.escrow` | View/manage Escrow Accounts |
| `finance.account.investment` | View/manage Investment Accounts |
| `finance.account.all` | Bypass type filter — see all accounts |
| `finance.account.manage` | Create and delete accounts |

## How It Works

### GET /api/accounts/ (List)
1. **Superusers** → see all accounts
2. **Users with `finance.account.all`** → see all accounts
3. **Users with no role** → see only their assigned cash register
4. **Users with a role** → see accounts matching their `finance.account.<type>` permissions
5. **Users with no matching permissions** → see only their assigned cash register

### POST /api/accounts/ (Create)
Requires `finance.account.manage` permission. Returns 403 otherwise.

### DELETE /api/accounts/{id}/ (Delete)
Requires `finance.account.manage` permission. Returns 403 otherwise.

## Data Flow
```
API Request → FinancialAccountViewSet.get_queryset()
  → Check user.is_superuser → bypass
  → Check finance.account.all → bypass
  → Check user.role → no role → cash register only
  → Get role permissions → filter by PERM_TYPE_MAP
  → Return filtered queryset
```

## Tables Affected
- `permission` — 10 new records seeded
- `role_permissions` (M2M) — admin assigns permissions to roles
- `financialaccount` — filtered by type at query time

## Where Data is READ
- `FinancialAccountViewSet.get_queryset()` reads `user.role.permissions`
- Frontend accounts page `/finance/accounts` renders filtered results

## Where Data is SAVED
- `seed.py` → creates permission records
- Role management UI → assigns permissions to roles
