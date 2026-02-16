# Fiscal Years Page — Server Components Render Fix

## Goal
Fix the Server Components render error on `/finance/fiscal-years`.

## Root Cause
1. **Missing `status` field**: `FiscalYear` model only has `is_closed`/`is_hard_locked` booleans. The frontend expected a `status` string.
2. **Non-array crash**: `getFiscalYears()` called `.map()` directly on the API response without checking if it was an array.

## Changes

### Backend: `erp_backend/apps/finance/serializers.py`
- Added `status = serializers.SerializerMethodField()` to `FiscalYearSerializer`
- Computes: `is_hard_locked` → `'FINALIZED'`, `is_closed` → `'CLOSED'`, else → `'OPEN'`

### Frontend: `src/app/actions/finance/fiscal-year.ts`
- `getFiscalYears()`: added `Array.isArray()` guard before `.map()`, maps `status` field
- `getLatestFiscalYear()`: added same array guard

## Data Flow
- **READ**: `page.tsx` → `getFiscalYears()` → `erpFetch('fiscal-years/')` → Django `FiscalYearViewSet`
- **SAVE**: `wizard.tsx` → `createFiscalYear()` → `erpFetch('fiscal-years/', POST)` → Django

## Variables
- `year.status`: computed from `is_closed`/`is_hard_locked` (OPEN | CLOSED | FINALIZED)
- `year.startDate`, `year.endDate`: mapped from `start_date`, `end_date`
- `year.isHardLocked`: mapped from `is_hard_locked`
- `year.periods`: nested array from `FiscalPeriodSerializer`
