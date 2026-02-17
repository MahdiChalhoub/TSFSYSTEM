# COA API Path Fix Documentation

## Goal
Fix a critical API path mismatch where 6 frontend pages and 2 backend files were referencing `chart-of-accounts/` instead of the actual DRF route `coa/`, causing 404 errors on data fetch.

## Problem
The backend registers the Chart of Accounts ViewSet at route prefix `coa/`:
```python
# apps/finance/urls.py line 20
router.register(r'coa', ChartOfAccountViewSet)
```

But several frontend pages were calling `finance/chart-of-accounts/` — a path that doesn't exist.

## Data Flow

### Where Data is READ
- **Backend**: `ChartOfAccountViewSet` serves data at `/api/coa/` (flat) and `/api/finance/coa/` (namespaced)
- **Frontend Server Actions** (`src/app/actions/finance/accounts.ts`): Already correctly use `coa/`
- **Frontend Pages** (affected): Were incorrectly using `finance/chart-of-accounts/`

### Where Data is SAVED
- No writes affected — this fix only corrects read paths

## Files Changed

### Frontend (6 pages)
| File | Old Path | New Path |
|------|----------|----------|
| `finance/budget/page.tsx` | `finance/chart-of-accounts/` | `coa/` |
| `finance/revenue/page.tsx` | `finance/chart-of-accounts/` | `coa/` |
| `finance/profit-centers/page.tsx` | `finance/chart-of-accounts/` | `coa/` |
| `finance/expenses/page.tsx` | `finance/chart-of-accounts/` | `coa/` |
| `sales/import/page.tsx` | `finance/chart-of-accounts/?is_active=true` | `coa/?is_active=true` |
| `dashboard/page.tsx` | `finance/chart-of-accounts/` | `coa/` |

### Backend (2 files)
| File | Section | Old Value | New Value |
|------|---------|-----------|-----------|
| `register_contracts.py` | `finance.provides.read_endpoints` | `chart-of-accounts/` | `coa/` |
| `register_contracts.py` | `hr.needs.data_from` | `chart-of-accounts/` | `coa/` |
| `services.py` | `ConfigurationService.route_read` | `chart-of-accounts` | `coa` |

## Variables User Interacts With
- None — this is a backend infrastructure fix with no user-facing variables

## Step-by-Step Workflow
1. User navigates to any affected page (Budget, Revenue, etc.)
2. Page calls `erpFetch('coa/')` to fetch Chart of Accounts data
3. `erpFetch` constructs URL: `{DJANGO_URL}/api/coa/`
4. Django resolves via flat mount to `ChartOfAccountViewSet.list()`
5. Data returns successfully (was 404 before this fix)

## How the Fix Achieves Its Goal
By aligning all frontend `erpFetch` paths and backend ConnectorEngine contract endpoints with the actual DRF router registration (`coa/`), all API calls now resolve correctly to the `ChartOfAccountViewSet`.
