# Finance SSR & Render Fixes

Goal: Resolve "Server Components render" errors occurring on finance-related pages during server-side rendering or data processing.

## Modified Components

### 1. Fiscal Year Management
- **File**: `src/app/(privileged)/finance/fiscal-years/year-card.tsx`
- **Fix**: Added optional chaining (`year.periods?.map`) to prevent crashes when the `periods` property is missing or null.
- **Backend Sync**: Updated `FiscalYearSerializer` in `erp_backend/apps/finance/serializers.py` to explicitly include nested `periods`.

### 2. COA Migration Tool
- **File**: `src/app/(privileged)/finance/chart-of-accounts/migrate/viewer.tsx`
- **Fix**: 
    - Added safety checks for `acc.balance` before calling `.toLocaleString()`.
    - Added safety checks for `t.name` before calling `.toLowerCase()` to handle potential null names in templates.

## Data Flow
- **Read**: Data is fetched via server actions (`getFiscalYears`, `getChartOfAccounts`, `getAllTemplates`).
- **Processing**: The data is serialized using a custom `serialize` utility which converts `NaN` to `null`.
- **Render**: Frontend components now gracefully handle `null` or `undefined` values for sensitive properties during SSR.

## Verification
- Verified that `FiscalYearSerializer` now includes `periods`.
- Verified component level safety checks.
