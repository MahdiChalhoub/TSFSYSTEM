# UI Consistency Standardization

## Goal
Unify padding, margins, spacing, and animation classes across all 42+ privileged pages to create a consistent, polished look.

## What Changed

### Layout-Level Padding
- **File**: `src/app/(privileged)/layout.tsx`
- `<main>` element now includes `p-6 md:p-8` padding
- This provides consistent outer spacing for ALL pages — no page needs to self-manage outer padding

### Standard Page Wrapper
Every page root `<div>` now uses:
```tsx
<div className="space-y-6 animate-in fade-in duration-500">
```
- `space-y-6`: consistent vertical spacing between sections
- `animate-in fade-in duration-500`: smooth entrance animation

### Removed Patterns
The following inconsistent patterns were removed from ALL pages:
- `p-8 max-w-7xl mx-auto` (duplicate padding + unnecessary max-width)
- `container mx-auto px-4 py-8` (duplicate padding)
- `min-h-screen bg-[#F8FAFC] p-8 lg:p-12` (duplicate background + padding)
- `space-y-8` → normalized to `space-y-6`
- Various `max-w-5xl/6xl mx-auto py-8` constraints
- Per-page `slide-in-from-bottom-4` or `duration-700` animation variants

## Data Flow
- **No data changes** — this is purely a CSS class standardization
- No backend changes
- No API changes

## Pages Modified (42 total)

### Layout (1)
- `layout.tsx` — added `p-6 md:p-8` to `<main>`

### Inventory Module (12)
- categories, brands, brands/[id], attributes, warehouses, units
- countries, countries/[id], barcode, adjustments, global
- (maintenance kept as-is — uses full-bleed layout with -m-6)

### SaaS Module (14)
- dashboard, health, sites, switcher, organizations, modules
- updates, connector, connector/logs, connector/buffer
- subscription, subscription-plans, [code], [...slug]

### Finance Module (11)
- dashboard, posting-rules, trial-balance, statement, P&L
- balance-sheet, ledger/[id], ledger/[id]/edit
- ledger/opening, ledger/opening/list, chart-migrate

### Other Modules (4)
- HR employees, CRM contacts, Purchases, Purchases/new

### Special Case: users/approvals (1)
- Normalized from `p-6 space-y-8 max-w-7xl mx-auto`

## Version
`v1.3.2-b021`
