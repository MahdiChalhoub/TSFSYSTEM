# Extract DajingoPageShell — Reusable List Page Template

## Goal

Extract the **page shell** pattern (header with icon-box + subtitle + action buttons + KPI strip + focus mode + filter panel slot) from the Products/Ledger/PO pages into a single reusable `<DajingoPageShell>` component. Combined with the existing `<DajingoListView>`, this gives any new list page a fully-featured template with ~30 lines of wiring.

## Problem

Every DajingoListView consumer (Products, Ledger, POs, Receipts, Invoices, Price Rules, Price Groups) duplicates **~80 lines** of identical page shell JSX:

1. **Title row** — `page-header-icon` + `<h1>` + subtitle stats
2. **Action buttons** — Primary CTA + Refresh + Focus Mode toggle
3. **Focus mode** — Compact mini-header with search + filter toggle
4. **KPI Strip** — `<KPIStrip stats={[...]} />`
5. **Filter panel slot** — Rendered both in normal and focus mode
6. **Keyboard shortcuts** — `Ctrl+K` (search), `Ctrl+Q` (focus)

All 6 blocks are structurally identical with only data-level differences.

## Proposed Changes

### Component: `src/components/common/DajingoPageShell.tsx`

#### [NEW] DajingoPageShell.tsx

A wrapper component that renders:
- **Normal mode**: Title row → KPI Strip → filter slot → children (DajingoListView)
- **Focus mode**: Compact header → filter slot → children

**Props interface:**
```typescript
interface DajingoPageShellProps {
  // ── Identity ──
  title: string                       // "Product Master"
  icon: React.ReactNode               // <Package size={20} />
  subtitle?: string                   // "145 Products · 3 Combos · 2 Out of Stock"
  entityLabel?: string                // "Product" (for focus mode count label)

  // ── KPI ──
  kpiStats?: KPIStat[]                // Array of KPI cards

  // ── Actions ──
  primaryAction?: { label: string; icon?: React.ReactNode; onClick: () => void }
  secondaryActions?: React.ReactNode  // Refresh, links, dropdowns

  // ── Search & Filters ──
  search: string
  onSearchChange: (v: string) => void
  searchRef?: React.RefObject<HTMLInputElement>
  filteredCount: number               // For focus mode "X/Y" display
  totalCount: number

  // ── Filter Panel ──
  showFilters: boolean
  onToggleFilters: () => void
  activeFilterCount: number
  renderFilters?: () => React.ReactNode  // Module-specific filter panel

  // ── Focus Mode ──
  focusMode?: boolean
  onFocusModeChange?: (v: boolean) => void

  // ── Refresh ──
  onRefresh?: () => void

  // ── Children = DajingoListView ──
  children: React.ReactNode
}
```

**Renders the exact same design** currently in Products/Ledger/POs — icon-box header, uppercase tracking subtitle, rounded-xl action buttons, color-mix shadows — no deviation.

The shell owns:
- Focus mode state (or accepts it from parent)
- Keyboard shortcuts (Ctrl+K → focus search, Ctrl+Q → toggle focus)
- The outer `flex flex-col h-[calc(100vh-8rem)]` wrapper

## Open Questions

> [!IMPORTANT]
> **Q1: Focus mode state ownership** — Should the shell own focus mode internally, or should the parent pass it in? Internal is simpler (new pages get it free), but some pages might want to control it externally. **Recommendation**: Internal by default, with optional `focusMode` + `onFocusModeChange` override props.

> [!IMPORTANT]
> **Q2: Migrate existing pages or just create the template?** — We can:
> - **Option A**: Create the template only. New pages use it, existing pages stay as-is (zero risk).
> - **Option B**: Create the template + migrate Products as proof-of-concept (low risk, validates the template).
> - **Option C**: Create the template + migrate all 6+ consumers (higher risk but full deduplication).
> **Recommendation**: Option B — create + migrate Products to prove it works.

> [!IMPORTANT]
> **Q3: Height calculation** — Products uses `h-[calc(100vh-8rem)]`, Ledger uses `h-full`. Should the shell default to `h-[calc(100vh-8rem)]` or accept a prop? **Recommendation**: Default `h-[calc(100vh-8rem)]` with an optional `className` prop for override.

## Verification Plan

### Automated Tests
- `npx tsc --noEmit` — type check passes
- Visual comparison: Products page before vs. after migration should be pixel-identical

### Manual Verification
- Browse `/inventory/products` — verify normal mode renders correctly
- Toggle focus mode (Ctrl+Q) — verify compact header
- Toggle filters — verify panel appears in both modes
- Test keyboard shortcuts (Ctrl+K, Ctrl+Q)
- Verify KPI strip renders
- Verify primary action button works
