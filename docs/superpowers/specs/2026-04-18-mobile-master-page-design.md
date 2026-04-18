# Mobile Master Page + Mobile Categories — Design

**Date:** 2026-04-18
**Scope:** New mobile-native shell (`MobileMasterPage`) + mobile implementation of `/inventory/categories` as the first consumer. Desktop code is untouched.

## Goals

1. **Full feature parity on mobile** — browse, inspect, create, edit, delete, reparent. No trimmed functionality.
2. **Maximum information density** — surface counts, codes, hierarchy without feeling cramped.
3. **Reusable shell** — same pattern fits any tree or flat-list page in the app (Phase 2 targets: Chart of Accounts, Brands, Products, Ledger list).
4. **Bundle win** — mobile users don't download desktop-only code (split panel, pinned sidebar, guided tour, focus mode, desktop detail panel). Target ≥30% JS reduction on the route.

## Non-goals

- Forms / wizards (separate shell, future spec).
- Offline mode or PWA install.
- Refactoring the existing desktop `TreeMasterPage` or `CategoryDetailPanel`.
- Internationalization of mobile-only copy (matches existing app convention).

## Architecture — Dual Bundle

Branch at render time via a client-side `Gateway` component that dynamically imports the appropriate client:

```tsx
// src/app/(privileged)/inventory/categories/page.tsx  (server, unchanged logic)
export default async function CategoriesPage() {
    const data = await getCategoriesData()
    return <CategoriesGateway initialCategories={data} />
}
```

```tsx
// src/app/(privileged)/inventory/categories/CategoriesGateway.tsx
'use client'
import dynamic from 'next/dynamic'
import { useIsMobile } from '@/hooks/use-mobile'

const MobileClient = dynamic(
    () => import('./mobile/MobileCategoriesClient').then(m => m.MobileCategoriesClient),
    { ssr: false, loading: () => <GatewaySkeleton /> }
)
const DesktopClient = dynamic(
    () => import('./CategoriesClient').then(m => m.CategoriesClient),
    { ssr: false, loading: () => <GatewaySkeleton /> }
)

export function CategoriesGateway(props: { initialCategories: any[] }) {
    const isMobile = useIsMobile()
    if (isMobile === undefined) return <GatewaySkeleton />
    return isMobile
        ? <MobileClient {...props} />
        : <DesktopClient {...props} />
}
```

**Why `ssr:false`:** mobile detection depends on `window.matchMedia`; we accept a brief skeleton instead of SSR'ing the wrong client and rehydrating.

**Skeleton** mirrors the header + KPI strip + 4 row placeholders so no layout shift.

**Bundle measurement:** record baseline from `next build` before implementation; verify ≥30% JS reduction on `/inventory/categories` mobile bundle after.

## `MobileMasterPage` — Reusable Shell

Location: [src/components/templates/mobile/MobileMasterPage.tsx](src/components/templates/mobile/MobileMasterPage.tsx)

### Config API

Reuses `TreeMasterConfig` from the desktop shell (same fields: `title`, `subtitle`, `icon`, `kpis`, `primaryAction`, `secondaryActions`, `footerLeft`). Ignores desktop-only fields (`columnHeaders`, `treeTourId`, `tourId`) gracefully.

Additional mobile-specific optional field:
```ts
interface MobileMasterConfig extends TreeMasterConfig {
    mobileSecondaryActionsLocation?: 'overflow' | 'fab-cluster'  // default: 'overflow'
}
```

### Layout

Top to bottom:

1. **Sticky top bar** — two states:
   - Full: app icon + title (lg) + subtitle (xs uppercase) + primary action pill
   - Collapsed (after ≥40px scroll): title (sm) + search icon + `+` + `⋯` overflow
   - Smooth cross-fade via `framer-motion` when crossing threshold
2. **KPI rail** — horizontal scroll, snap-to-item, shows all KPIs. Each card 110×56px, tappable (for pages that wire filter behavior; Categories ignores taps in Phase 1).
3. **Sticky search bar** — full-width input + `Expand/Collapse all` chip + clear chip. Pins when KPI rail scrolls out.
4. **Scroll content** — render prop, page provides the row list.
5. **Minimal footer** — one-line status (e.g., `142 total · 1,204 products`). No "System Status: Operational".
6. **FAB** — bottom-right, 56px, primary action. Hides on scroll-down ≥8px, reappears on scroll-up ≥8px. `framer-motion` translate animation.
7. **Bottom sheet** — detail panel (see section below); renders above FAB.

### Dropped on mobile (vs desktop shell)

- Split Panel toggle and split view (`splitPanel` render-prop returns `false` always)
- Pinned Sidebar toggle and pinned drawer
- Focus Mode toggle
- `Ctrl+K` / `Ctrl+Q` hints and keybindings
- Tour button

### Sticky behavior

Top bar + search bar are a single sticky stack via `position: sticky` + `top: 0`. KPI rail scrolls away with content. No JS scroll listeners for the sticky behavior itself — only for the top-bar collapse threshold and FAB hide/show (throttled via `requestAnimationFrame`).

## Mobile Category Row

Location: [src/app/(privileged)/inventory/categories/mobile/MobileCategoryRow.tsx](src/app/(privileged)/inventory/categories/mobile/MobileCategoryRow.tsx)

### Visual structure

```
┌──────────────────────────────────────────┐
│ ▸ 📚 Electronics                 [ROOT]  │   line 1 (primary)
│    ELEC · ELC                            │   line 2 (secondary, muted)
│    📦 142  🎨 12  🏷 8  ↳ 4      +      │   line 3 (chips + add-sub)
└──────────────────────────────────────────┘
```

- Row min-height: **64px** (leaf) / **76px** (root, with accent bar on left)
- Line 1: chevron (tappable for expand/collapse) + icon + name (14px, weight 700 for root, 600 for others) + optional `ROOT` badge
- Line 2: code (mono 11px) + short_name (11px uppercase muted) — omitted if neither present
- Line 3: four tappable count chips + trailing `+` (36×36 tap area) to add sub-category. Chips render as disabled (0.4 opacity, non-interactive) when count is 0.
- Visual accent for root: 3px gradient bar on the left edge (matches existing desktop design language).
- Selection state: `ring-2 ring-app-primary/40` when sheet is showing this node.

### Indent handling

- Visible indent levels: 0, 1, 2 (12px, 26px, 40px left padding)
- Level 3+: row shows with level-2 indent but prefixed with `└─` continuation glyph AND the parent's last segment is shown in muted small text above line 1 (e.g., `…in Laptops`).
- Level 4+: rows are still rendered but indent caps at level-2 padding; a single "drill in to keep navigating" row appears at the end of a level-3 parent's children, which opens a **scoped tree** (see below).

### Scoped tree drill-in

Tapping the drill-in row (or a "view as root" option in the sheet) pushes a new in-app stack view where the selected node is treated as the temporary root. A breadcrumb at the top shows the path; tapping any crumb pops back. Implemented via the gateway router state (no Next.js navigation — keeps it in-client and instant).

### Interactions

| Gesture | Result |
|---|---|
| Tap row body (any empty area) | Opens bottom sheet, Overview tab |
| Tap chevron / icon | Toggle expand/collapse (parents only) |
| Tap any count chip | Opens bottom sheet on that tab (Products / Brands / Attributes / Children) |
| Tap `+` | Opens `CategoryFormModal` with `parentId = node.id` |
| Swipe left (commit ≥60px) | Reveals inline action drawer: [Edit] [Delete]. Tap to invoke. Swipe right or tap elsewhere to dismiss. |
| Long-press (≥400ms) | Enters reorder/reparent mode; row lifts, other rows dim and become drop targets. Drop on another row to reparent. Drop in empty area to promote to root. |

### Disabled states

- Delete on a parent: swipe reveals a disabled Delete with tooltip-equivalent toast "Delete sub-categories first" on tap (matches existing desktop behavior).
- `+` on a leaf: always enabled (adds first child).

## Bottom Sheet (Detail Panel)

Location: [src/components/templates/mobile/MobileBottomSheet.tsx](src/components/templates/mobile/MobileBottomSheet.tsx)

### Framework

`framer-motion` for drag + spring physics. Radix Dialog for a11y primitives (focus trap, `aria-modal`, escape key).

### Snap points

- **Closed** (`y = 100vh`)
- **Peek** (`y = 60vh` → sheet covers bottom 40% of viewport)
- **Expanded** (`y = 10vh` → sheet covers 90%, leaving a tap-out strip at top)

Default open state: **Peek**. Programmatic snap to Expanded when a tab body needs the full height (e.g., Products tab with many items).

### Gestures

| Gesture | Result |
|---|---|
| Drag up past midpoint between peek and expanded | Snap to Expanded |
| Drag down past midpoint | Snap to Peek |
| Drag down past 30% of current snap height | Snap to Closed (with spring) |
| Tap backdrop (above sheet top) | Close |
| Velocity > 500px/s | Use velocity direction to determine target snap |

### Content

Sticky header inside the sheet:
- Drag handle (36×4px pill, centered, 8px from top)
- Node name + code
- Close button (right)
- Tab bar: Overview / Brands / Attributes / Products (sticky, scrolls horizontally if labels don't fit — they won't in English)

Scrollable body renders the active tab.

Sticky footer:
- [Add sub] [Edit] [Delete] — 44px tall, full-width, destructive Delete in `--app-error`.

### Tab bodies

Mobile-native rewrites in `src/app/(privileged)/inventory/categories/mobile/tabs/`:
- `OverviewTab.tsx` — key/value rows (name, code, parent, created_at, counts, notes). Vertical stack, no desktop grid.
- `BrandsTab.tsx` — list of brands as tappable rows (name + logo + product count). Search chip at top.
- `AttributesTab.tsx` — list of attributes with inline chips for enum values; tap to edit (opens existing attribute modal).
- `ProductsTab.tsx` — virtualized list (if >50 items). Each product: thumbnail + name + SKU + stock badge.

Each tab component takes `node` + data-fetching helpers as props. Data-fetching logic is shared with desktop via existing `@/app/actions/inventory/categories` and related module.

## Gesture Layer

Location: [src/hooks/use-row-gestures.tsx](src/hooks/use-row-gestures.tsx)

```ts
export function useRowGestures<T extends HTMLElement>(
    ref: RefObject<T>,
    handlers: {
        onTap?: (e: PointerEvent) => void
        onSwipeLeft?: (commit: boolean) => void
        onLongPress?: (e: PointerEvent) => void
    },
    options?: {
        swipeCommitPx?: number      // default 60
        swipeActivatePx?: number    // default 20
        longPressMs?: number        // default 400
    }
): {
    swipeOffsetPx: number  // current swipe displacement, for rendering the action drawer
    isLongPressing: boolean
}
```

- Uses pointer events (unified mouse/touch).
- Cancels long-press if vertical scroll is detected (>10px Δy).
- Cancels swipe if vertical intent dominates (guards against accidental activation during page scroll).
- Touch-action CSS: rows use `touch-action: pan-y` so the browser handles vertical scroll; horizontal swipe is JS.

Other mobile pages reusing `MobileMasterPage` will get the same hook.

## File Layout

```
src/
├── hooks/
│   ├── use-mobile.tsx                            (exists)
│   └── use-row-gestures.tsx                      (new)
├── components/
│   └── templates/
│       └── mobile/                               (new)
│           ├── MobileMasterPage.tsx
│           ├── MobileTopBar.tsx
│           ├── MobileKPIRail.tsx
│           ├── MobileSearchBar.tsx
│           ├── MobileFab.tsx
│           ├── MobileBottomSheet.tsx
│           └── MobileTreeRow.tsx                 (generic, pages pass renderItem)
└── app/(privileged)/inventory/categories/
    ├── page.tsx                                  (modified: renders Gateway)
    ├── CategoriesGateway.tsx                     (new)
    ├── CategoriesClient.tsx                      (existing desktop, untouched)
    └── mobile/                                   (new)
        ├── MobileCategoriesClient.tsx
        ├── MobileCategoryRow.tsx
        ├── MobileCategoryDetailSheet.tsx
        └── tabs/
            ├── OverviewTab.tsx
            ├── BrandsTab.tsx
            ├── AttributesTab.tsx
            └── ProductsTab.tsx
```

## Styling

- Reuse existing `--app-*` CSS variables for colors — no new palette.
- Tailwind utilities + inline styles (matches existing codebase convention).
- Add `@media (hover: none)` guards where desktop hover-reveal patterns still leak in.
- New mobile-specific Tailwind classes kept to a minimum; prefer composition of existing utilities.

## Data flow

Unchanged. The mobile client receives the same `initialCategories` prop the desktop client receives. All mutations go through the existing server actions (`deleteCategory`, `createCategory`, `updateCategory`, `reparentCategory`).

**New server action required:** `reparentCategory(nodeId, newParentId)` in [src/app/actions/inventory/categories.ts](src/app/actions/inventory/categories.ts). Confirmed not present today — existing actions are `createCategory`, `updateCategory`, `deleteCategory`, `getCategoryWithCounts`, `moveProducts`, `getCategoryProducts`. The new action wraps a PATCH to the ERP `categories/{id}/` endpoint with `{ parent: newParentId }`, then revalidates the route.

## Error handling

- Failed mutations: toast via `sonner` (matches desktop).
- Offline (no navigator.onLine): disable FAB + mutation buttons, show banner at top of sheet. Read-only mode works with stale data.
- Gesture misfires: visual feedback (row snaps back) but no toast.

## Testing

- Manual verification at `saas.developos.shop/inventory/categories` on at least one iOS Safari device and one Android Chrome device.
- Verification checklist captured in the implementation plan (see writing-plans handoff).
- No new unit tests introduced (matches project convention — codebase has no test suite).

## Rollout

**Phase 1 (this spec):** Categories only, full feature set. Ship behind existing route — no feature flag, since the desktop path is untouched and the mobile path only activates below 768px.

**Phase 2 (future, separate spec):** Migrate another tree/list page (Chart of Accounts likely first) onto `MobileMasterPage`. This validates the shell's reusability and captures any refactor needs before broader rollout.

## Open questions (decided, recorded for the record)

- **Dual bundle vs responsive CSS** → dual bundle, for the ≥30% JS win and cleaner code isolation.
- **Bottom sheet vs stack navigation** → bottom sheet, for faster sibling comparison in manage-heavy workflow.
- **Indent cap level** → level 3 with drill-in (empirically matches typical category depth in the app).
- **Tour button on mobile** → dropped; tour UX needs desktop-scale affordances.
- **Separate mobile tab bodies vs shared** → separate, because desktop panel renders multi-column layouts that don't translate to 375px.

## Success criteria

1. User on a phone at `saas.developos.shop/inventory/categories` can complete all of: browse tree, search, expand/collapse, view counts, open detail for any category, view each tab, add sub-category, edit, delete (non-parent), reparent via drag.
2. All tap targets ≥44px.
3. All text ≥12px.
4. No horizontal overflow at 360px viewport width.
5. Route's mobile JS bundle ≥30% smaller than current single-bundle baseline.
6. Desktop experience is byte-for-byte unchanged on all viewports ≥768px.
