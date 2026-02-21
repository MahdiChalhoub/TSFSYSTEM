# Finance Ledger Improvements Documentation

## Goal
Add filtering, search, and entry type distinction to the General Ledger page.

## Changes

### Backend — `JournalEntryViewSet.get_queryset` (views.py)
Added query parameter filtering:
- `fiscal_year` — Filter by FK to FiscalYear
- `date_from` / `date_to` — Date range filter on `transaction_date`
- `status` — Filter by entry status (DRAFT/POSTED/REVERSED)
- `scope` — Filter by OFFICIAL/INTERNAL
- `entry_type` — OPENING (reference starts with 'OPEN-') or MANUAL (excludes OPEN-)
- `search` — Case-insensitive search on description
- Results ordered by `-transaction_date, -id`

### Frontend — `getLedgerEntries` (ledger.ts)
Extended filter params: `fiscal_year`, `date_from`, `date_to`, `entry_type`

### Frontend — Ledger Page (page.tsx)
Rebuilt as client component with:
- Search input with magnifying glass icon
- Status dropdown (All/Draft/Posted/Reversed)
- Expandable filter panel:
  - Fiscal year dropdown (fetched from `getFiscalYears`)
  - Date range (from/to date inputs)
  - Entry type (All/Opening Balances/Manual Entries)
- Active filter count badge
- Clear All Filters button
- Loading spinner
- Auto/Manual Opening badge on entries (blue tag)
- Filter-aware empty state message

### Existing — Opening Pages (#25, #26)
Already implemented:
- `/finance/ledger/opening/list` — Lists all opening balance entries
- "Add Opening Balance" button on list page links to `/finance/ledger/opening`

## Data Flow
```
Frontend filters → URLSearchParams → GET /api/journal/?fiscal_year=X&status=Y&...
Backend get_queryset → Filters queryset → Serializes → Returns JSON
Frontend renders entries with status, type badges, fiscal year label
```

## Variables
- `fiscalYear` — Selected fiscal year ID for filtering
- `dateFrom` / `dateTo` — Date range boundaries
- `entryType` — 'OPENING' or 'MANUAL' filter
- `search` — Free-text search on description
- `activeFilterCount` — Number of active filters for badge display
