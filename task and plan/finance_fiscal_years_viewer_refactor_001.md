# Fiscal Years `viewer.tsx` Refactor — 867 → ≤250 lines

## Goal

Bring `viewer.tsx` (867 lines) under the 300-line code-quality limit by extracting cohesive blocks into sibling `_components/`, `_hooks/`, and `_lib/` files. Zero functional changes — pure structural refactor.

## Current Structure (867 lines)

| Lines     | Block                                    | Target Extraction            |
|-----------|------------------------------------------|------------------------------|
| 1–25      | Imports + extracted modal imports         | stays                        |
| 26–33     | `STATUS_STYLE` + `getStatusStyle`        | `_lib/constants.ts`          |
| 34–55     | State declarations (22 state vars)       | `_hooks/useFiscalYears.ts`   |
| 56–406    | Business logic (refreshData, handlers, openWizard) | `_hooks/useFiscalYears.ts` |
| 408–428   | Header (icon + title + create button)    | stays (thin JSX)             |
| 430–458   | KPI strip                                | `_components/KpiStrip.tsx`   |
| 460–497   | Search bar + focus-mode toolbar          | `_components/Toolbar.tsx`    |
| 499–801   | Year list loop (expand → tabs → periods/summary/history) | `_components/YearPanel.tsx` + `_components/SummaryTab.tsx` + `_components/HistoryTab.tsx` + `_components/PeriodsGrid.tsx` |
| 804–810   | Stats footer                             | stays (5 lines)              |
| 812–863   | Modal/dialog wirings                     | stays (modal shell)          |

## Proposed Changes

### Logic Layer

#### [NEW] `_hooks/useFiscalYears.ts` (~200 lines)

Owns all 22 state variables + business logic:
- `refreshData`, `handleCreateYear`, `handlePeriodAction`, `handlePeriodStatus`, `applyPeriodStatus`, `confirmAction`, `openWizard`
- `stats`, `kpis`, `filteredYears` (memos)
- `closeYearEndModal` helper
- Exposes a flat return object consumed by `viewer.tsx`

#### [NEW] `_lib/constants.ts` (~10 lines)

- `STATUS_STYLE` map + `getStatusStyle` helper (shared by `KpiStrip`, `PeriodsGrid`, `YearPanel`)

### UI Layer

#### [NEW] `_components/KpiStrip.tsx` (~40 lines)

KPI filter buttons grid. Props: `kpis`, `statusFilter`, `setStatusFilter`.

#### [NEW] `_components/Toolbar.tsx` (~50 lines)

Search input + focus-mode chip + filter chip + New button (focus-mode variant) + focus toggle. Props: `focusMode`, `setFocusMode`, `searchQuery`, `setSearchQuery`, `statusFilter`, `setStatusFilter`, `stats`, `openWizard`.

#### [NEW] `_components/YearPanel.tsx` (~80 lines)

Single expanded year: header row (chevron, name, dates, status badge, period count) + tab bar (Periods/Summary/History) + year actions (Soft Close, Year-End Close, Delete, Immutable badge). Delegates to tab sub-components.

#### [NEW] `_components/PeriodsGrid.tsx` (~45 lines)

Grid of period cards with status buttons. Props: `periods`, `year`, `isPending`, `handlePeriodStatus`, `handlePeriodAction`.

#### [NEW] `_components/SummaryTab.tsx` (~90 lines)

P&L, Balance Sheet, JE Stats, Closing Entry, Opening Balances. Props: `summary | null`, `isLoading`.

#### [NEW] `_components/HistoryTab.tsx` (~55 lines)

Event log timeline + JE-by-month chips. Props: `history | null`, `isLoading`.

#### [MODIFY] `viewer.tsx` → ~200 lines

Thin orchestration:
1. Call `useFiscalYears(initialYears)` hook
2. Render: Header → KpiStrip → Toolbar → year-list (map → YearPanel) → footer → modals

## Risk

- **Low**: Pure structural refactor. No logic changes, no API changes, no routing changes.
- **State threading**: The hook returns all state + handlers; components receive them as props. No context provider needed — the component tree is shallow (viewer → year panel → tab).
- **Import order**: `getStatusStyle` moves to `_lib/constants.ts` — used by 3 new components + the hook. Single source of truth.

## Verification Plan

### Automated
- `npx tsc --noEmit` — must exit 0
- `wc -l viewer.tsx` — must be ≤ 300
- All new files ≤ 300 lines

### Manual (browser smoke-test)
- Navigate to `/finance/fiscal-years`
- Expand a year → verify Periods / Summary / History tabs render correctly
- Use KPI filters → verify year list filters
- Search → verify search works
- Focus mode on/off
- Create Year wizard → submit
- Period status buttons (Open/Close/Future/Lock/Reopen)
- Soft Close / Year-End Close flow
- Delete year confirmation
- Escape/backdrop dismiss on all modals
