# Redesign `/finance/accounts/new` — Dajingo Pro V2

## Goal

Redesign the "New Financial Account" page to match the TSFSYSTEM V2 Design Language (Dajingo Pro). The current page uses legacy shadcn `Card`/`Input`/`Select` components with generic styling (`bg-emerald-50`, `text-emerald-600`, `text-muted-foreground`) — none of which use the `--app-*` theme tokens. The result is a page that looks out of place next to the V2-redesigned COA, Categories, and other modules.

## Current Problems

| # | Issue | Violation |
|---|-------|-----------|
| 1 | No Icon-Box Header — plain `ArrowLeft` + `text-2xl font-bold` | Design Language §2 |
| 2 | Hardcoded `bg-emerald-50`, `border-emerald-100`, `text-emerald-*` | Design Language §14, §17 |
| 3 | No contextual info strip | Design Language §4 |
| 4 | Single-column layout, no Adaptive Grid | Design Language §3 (MANDATORY) |
| 5 | shadcn Card/Select/Input instead of inline Dajingo form styling | Design Language §12 |
| 6 | No page entrance animation | Design Language §16 |
| 7 | `text-2xl` title size | Design Language §17 (NEVER) |

## Proposed Changes

### [MODIFY] [page.tsx](file:///root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)/finance/accounts/new/page.tsx)

Full rewrite from 159 lines → ~200 lines (under 300-line limit). Replace all shadcn components and legacy styling with Dajingo Pro V2 patterns:

---

#### 1. Page Wrapper
```tsx
<div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all">
```

#### 2. Icon-Box Header
- **Icon**: `Landmark` from lucide in `page-header-icon bg-app-primary` with glow shadow
- **Title**: `text-lg md:text-xl font-black text-app-foreground tracking-tight` → "New Financial Account"
- **Subtitle**: `text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest` → "FINANCE · ACCOUNTS"
- **Back button**: ghost border style per design language action button pattern

#### 3. Context Info Strip (replaces KPI strip for form pages)
3 contextual tiles using the KPI strip pattern — **update reactively** as the user fills the form:

| Tile | Color | Icon | Value |
|------|-------|------|-------|
| Account Type | `var(--app-primary)` | `Wallet` | Selected type label |
| Currency | `var(--app-info)` | `DollarSign` | Org base currency |
| COA Mapping | `#8b5cf6` | `Link` | Auto-resolved COA code |

#### 4. Account Type Selector (visual tile grid)
Replace shadcn `Select` with a visual tile grid matching KPI card interaction pattern:
```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
```
Each tile: icon + label + short desc. Active tile gets `ring-2` + `scale-[1.02]` + primary border tint. Much more discoverable than a dropdown.

#### 5. Adaptive Grid Form Fields
```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
```
Fields use Dajingo Pro form styling:
- **Label**: `text-[9px] font-black text-app-muted-foreground uppercase tracking-widest`
- **Input**: `text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground`
- **Name** — text input
- **Currency** — read-only with loading state
- **Description** — textarea, full width via `gridColumn: '1 / -1'`

#### 6. Automated Ledger Link Info Box
Replace hardcoded emerald with theme tokens:
```tsx
style={{
    background: 'color-mix(in srgb, var(--app-info) 8%, var(--app-surface))',
    border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)',
    borderLeft: '3px solid var(--app-info)',
}}
```

#### 7. Submit CTA Button
Dajingo Pro primary CTA with glow:
```tsx
<button className="flex items-center justify-center gap-2 w-full text-[12px] font-black 
    bg-app-primary hover:brightness-110 text-white px-4 py-3 rounded-xl transition-all"
    style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
```

## What Will NOT Change

- **Business logic** — `createFinancialAccount()`, `getOrgCurrency()` server actions untouched
- **Account types list** — same 8 types, same `COA_MAPPINGS`
- **Form validation** — same required fields, same `react-hook-form` usage
- **Navigation** — still redirects to `/finance/accounts` on success

## Verification Plan

### Automated Tests
```bash
npx tsc --noEmit  # typecheck passes
grep -n 'emerald\|bg-white\|text-gray\|bg-gray\|border-gray' src/app/(privileged)/finance/accounts/new/page.tsx
# Expected: 0 matches (no hardcoded colors)
```

### Manual Verification
- Visual inspection at `/finance/accounts/new` in both light and dark themes
- Test form submission → creates account → redirects
- Responsive: mobile (1 col) → tablet (2 col) → laptop (auto-fit)
- Account type tile selection → context strip updates
