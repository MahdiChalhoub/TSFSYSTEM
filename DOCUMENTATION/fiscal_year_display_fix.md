# Fiscal Year Display Fix

## Goal
Fix period display in the Fiscal Year card showing "Pundefined" and corrupted em dash character.

## Root Cause
- `year-card.tsx` referenced `p.number`, `p.status`, `p.type` — fields that don't exist on `FiscalPeriod` model
- `FiscalPeriod` model only has: `name`, `start_date`, `end_date`, `is_closed` (boolean)
- Em dash character `—` was saved with wrong encoding as `ΓÇö`

## Data Flow
- **Read from**: Django API `/api/fiscal-years/` → includes nested periods via `FiscalPeriodSerializer`
- **Saved to**: N/A (display fix only)

## Variables
- `p.name` — period name (e.g., "P01-2026")
- `p.is_closed` — boolean (replaces non-existent `p.status`)
- `p.start_date` — string date, used to derive month name

## Fix Applied
### `src/app/(privileged)/finance/fiscal-years/year-card.tsx`
- Period label: uses `p.name` instead of `P${p.number}`
- Period status: uses `p.is_closed` boolean instead of `p.status`
- Month display: derives from `p.start_date` via `toLocaleDateString('en', { month: 'short' })`
- Em dash: fixed encoding
- Removed unused imports (`Clock`, `Unlock`)

### `src/app/actions/finance/fiscal-year.ts`
- `updatePeriodStatus`: sends `{ is_closed: true/false }` instead of `{ status: 'OPEN'/'CLOSED' }`
