---
description: TSFSYSTEM V2 Design Language Reference — use this document when redesigning or creating any page to ensure pixel-perfect consistency with the established COA/Categories design system.
---

# TSFSYSTEM V2 Design Language — "Dajingo Pro"

> **When to use:** Every time you create or redesign a frontend page.
> This is the single source of truth for visual patterns.

---

## 1. Page Wrapper

```tsx
<div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
```

- `p-4 md:p-6` — standard page padding
- `flex flex-col h-full` — fills sidebar layout
- `animate-in fade-in duration-300` — smooth page entrance

---

## 2. Page Header

### Icon Box
```tsx
<div className="page-header-icon bg-app-primary"
     style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
    <IconName size={20} className="text-white" />
</div>
```
- Uses the global `.page-header-icon` class
- Always `bg-app-primary` with `color-mix` glow shadow
- Icon: size 20, `text-white`

### Title
```tsx
<h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
    Page Title
</h1>
```
- `font-black` (900 weight), `tracking-tight`
- `text-lg md:text-xl` — responsive size

### Subtitle
```tsx
<p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
    {count} Items · Additional Context
</p>
```
- `uppercase tracking-widest` — spaced caps
- `text-[10px]` on mobile, `text-[11px]` on desktop
- Content format: `{count} Entity · Description`

### Action Buttons (top-right)
```tsx
{/* Ghost/border button */}
<button className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
    <IconName size={13} />
    <span className="hidden md:inline">Label</span>
</button>

{/* Primary CTA */}
<button className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
    <Plus size={14} />
    <span className="hidden sm:inline">New Entity</span>
</button>

{/* Focus Mode toggle */}
<button className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
    <Maximize2 size={13} />
</button>
```

---

## 3. Adaptive Grid System (MANDATORY)

> **Core Principle:** Every grid of cards, filters, or form fields MUST use `auto-fit` with `minmax()` — **NEVER** hardcoded `grid-cols-N` breakpoints.

### The Universal Grid Rule
```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
    {items.map(item => <Card key={item.id} />)}
</div>
```

### Why `auto-fit` and NOT `auto-fill`
| | `auto-fill` ❌ | `auto-fit` ✅ |
|---|---|---|
| 4 cards, space for 6 | 4 cards at min-width, **2 empty columns** wasting space | 4 cards **stretch to fill 100%** of the row |
| Blank space | YES — ugly gap on the right | **ZERO** — cards expand to fill every pixel |
| Uniform sizing | Cards may vary | **All cards always same width** |

### Minimum Widths by Content Type
| Content | `minmax()` min | Rationale |
|---------|----------------|----------|
| KPI cards | `140px` | Icon + label + value needs ~140px |
| Filter dropdowns | `140px` | Select + label comfortably fits |
| Form fields | `180px` | Input + label needs slightly more |
| Dashboard tiles | `200px` | Charts/summaries need more space |
| Compact badges | `100px` | Status chips, small info cards |

### Rules
1. **NEVER** use `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` — this is hardcoded and fragile
2. **ALWAYS** use `repeat(auto-fit, minmax(Xpx, 1fr))` — this adapts to ANY screen
3. **All items in a grid row MUST be the same width** — `1fr` guarantees this
4. **No blank space** — if 4 items fit on a row that could hold 6, the 4 items stretch to fill 100%
5. Gap: use `8px` for dense grids, `12px` for spacious grids

---

## 4. KPI Strip

```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
    {kpis.map(s => (
        <div key={s.label}
            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
            }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                {s.icon}
            </div>
            <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
            </div>
        </div>
    ))}
</div>
```

**Rules:**
- Uses the **Adaptive Grid System** (`auto-fit`) — NOT hardcoded columns
- Icon container: `w-7 h-7 rounded-lg`, 10% color tint background
- Label: `text-[10px] font-bold uppercase tracking-wider`
- Value: `text-sm font-black tabular-nums`
- Standard colors: `var(--app-primary)`, `var(--app-info)`, `var(--app-success)`, `#8b5cf6`, `var(--app-warning)`

---

## 5. Search Bar

```tsx
<div className="flex-1 relative">
    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
    <input
        ref={searchRef}
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search by name, code... (Ctrl+K)"
        className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
    />
</div>
```

**Keyboard shortcuts** (always add both):
```tsx
useEffect(() => {
    const handler = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
        if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
}, [])
```

---

## 6. Tree Table Container

```tsx
<div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
    {/* Column Headers */}
    <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
        <div className="w-5 flex-shrink-0" />  {/* Toggle spacer */}
        <div className="w-7 flex-shrink-0" />  {/* Icon spacer */}
        <div className="flex-1 min-w-0">Name</div>
        <div className="hidden sm:block w-20 flex-shrink-0">Count</div>
        <div className="w-28 text-right flex-shrink-0">Value</div>
        <div className="w-16 flex-shrink-0" />  {/* Actions spacer */}
    </div>

    {/* Scrollable Body */}
    <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
        {/* Tree rows go here */}
    </div>
</div>
```

---

## 7. Tree Row Patterns

### Root Row (Level 0)
```tsx
<div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface py-2.5 md:py-3"
    style={{
        paddingLeft: '12px',
        paddingRight: '12px',
        background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))',
        borderLeft: '3px solid var(--app-primary)',
    }}>
```

### Child Row (Level > 0)
```tsx
<div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-1.5 md:py-2"
    style={{
        paddingLeft: `${12 + level * 20}px`,
        paddingRight: '12px',
        borderLeft: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
        marginLeft: `${12 + (level - 1) * 20 + 10}px`,
    }}>
```

### Toggle Button
```tsx
<button className={`w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0 ${hasChildren ? 'hover:bg-app-border/50 text-app-muted-foreground' : 'text-app-border'}`}>
    {hasChildren ? (
        isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />
    ) : (
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: someColor }} />
    )}
</button>
```

### Icon Box (in row)
```tsx
<div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
    style={{
        background: isRoot
            ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
            : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
        color: isRoot ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
    }}>
    <IconName size={isRoot ? 14 : 13} />
</div>
```

### Name Text
```tsx
{/* Root */}
<span className="truncate text-[13px] font-bold text-app-foreground">{name}</span>

{/* Child */}
<span className="truncate text-[13px] font-medium text-app-foreground">{name}</span>
```

### Inline Badge
```tsx
<span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
    style={{
        background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
        color: 'var(--app-primary)',
        border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
    }}>
    BADGE
</span>
```

### Count Badge
```tsx
<span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
    style={{
        color: 'var(--app-success, #22c55e)',
        background: 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)',
    }}>
    <Box size={10} />
    {count}
</span>
```

### Mono Value (right column)
```tsx
<div className="w-28 text-right font-mono text-[12px] font-bold flex-shrink-0 tabular-nums"
    style={{ color: value > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
    {value.toLocaleString()}
</div>
```

### Hover Actions
```tsx
<div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
    <button className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
        <Pencil size={12} />
    </button>
</div>
```

---

## 8. Children Animation

```tsx
{hasChildren && isOpen && (
    <div className="animate-in fade-in slide-in-from-top-1 duration-150">
        {children.map(child => <ChildRow key={child.id} ... />)}
    </div>
)}
```

---

## 9. Empty State

```tsx
<div className="flex flex-col items-center justify-center py-20 px-4 text-center">
    <IconName size={36} className="text-app-muted-foreground mb-3 opacity-40" />
    <p className="text-sm font-bold text-app-muted-foreground">No items found</p>
    <p className="text-[11px] text-app-muted-foreground mt-1">
        Helpful message about what to do next.
    </p>
</div>
```

---

## 10. Loading State

```tsx
<div className="flex items-center justify-center py-20">
    <Loader2 size={24} className="animate-spin text-app-primary" />
</div>
```

---

## 11. Modal / Popup

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
    onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[70vh] flex flex-col"
        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* Modal Header */}
        <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                    <IconName size={15} className="text-white" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-app-foreground">Modal Title</h3>
                    <p className="text-[10px] font-bold text-app-muted-foreground">Subtitle</p>
                </div>
            </div>
            <button className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                <X size={16} />
            </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* content */}
        </div>
    </div>
</div>
```

---

## 12. Inline Form (COA-style)

```tsx
<div className="flex-shrink-0 mb-3 p-4 border rounded-2xl animate-in slide-in-from-top-2 duration-200"
    style={{
        background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))',
        borderColor: 'var(--app-border)',
        borderLeft: '3px solid var(--app-primary)',
    }}>
    <div className="flex items-center justify-between mb-3">
        <h3 className="text-[12px] font-black text-app-foreground uppercase tracking-wider">Form Title</h3>
        <button className="p-1 hover:bg-app-border/50 rounded-lg transition-colors">
            <X size={14} className="text-app-muted-foreground" />
        </button>
    </div>
    <form style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', alignItems: 'end' }}>
        <div>
            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Field</label>
            <input className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none" />
        </div>
    </form>
</div>
```

---

## 13. Focus Mode (compact header)

```tsx
<div className="flex items-center gap-2">
    <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
            <IconName size={14} className="text-white" />
        </div>
        <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Title</span>
        <span className="text-[10px] font-bold text-app-muted-foreground">{filtered}/{total}</span>
    </div>
    {/* Compact search + actions */}
    <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
        <Minimize2 size={13} />
    </button>
</div>
```

---

## 14. Color Palette

| Token | Usage |
|-------|-------|
| `var(--app-primary)` | Primary accent, root borders, CTA buttons |
| `var(--app-info, #3b82f6)` | Secondary grouping, info badges |
| `var(--app-success, #22c55e)` | Positive values, available stock, sale defaults |
| `var(--app-warning, #f59e0b)` | Caution, stock alerts |
| `var(--app-error, #ef4444)` | Negative values, errors, clear buttons |
| `#8b5cf6` | Tertiary accent (purple) — parfums, brands, special badges |
| `var(--app-foreground)` | Primary text |
| `var(--app-muted-foreground)` | Secondary/muted text |
| `var(--app-surface)` | Card/row backgrounds |
| `var(--app-border)` | Borders, dividers |
| `var(--app-background)` | Page background |

### Color-Mix Pattern
```css
/* 10% tint background */
background: color-mix(in srgb, var(--app-primary) 10%, transparent);

/* Glow shadow */
box-shadow: 0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent);

/* Subtle surface */
background: color-mix(in srgb, var(--app-surface) 50%, transparent);
border: 1px solid color-mix(in srgb, var(--app-border) 50%, transparent);
```

---

## 15. Typography Scale & Readability Rules

| Element | Class |
|---------|-------|
| Page title | `text-lg md:text-xl font-black tracking-tight` |
| Page subtitle | `text-[10px] md:text-[11px] font-bold uppercase tracking-widest` |
| KPI label | `text-[10px] font-bold uppercase tracking-wider` |
| KPI value | `text-sm font-black tabular-nums` |
| Row name (root) | `text-[13px] font-bold` |
| Row name (child) | `text-[13px] font-medium` |
| Mono code | `font-mono text-[11px] font-bold` |
| Badge | `text-[8px] font-black uppercase tracking-wider` |
| Count badge | `text-[10px] font-bold` |
| Button label | `text-[11px] font-bold` |
| Form label | `text-[9px] font-black uppercase tracking-widest` |
| Form input | `text-[12px] font-bold` |

### ⚠️ Font Readability Rules (MANDATORY)

> **Every text element on every page MUST be readable at its target screen size.** Tiny, cramped, or low-contrast text is unacceptable.

#### Absolute Minimum Font Sizes
| Element Type | Minimum Size | Rationale |
|-------------|-------------|-----------|
| **Body text / row data** | `11px` | Must be scannable in dense tables |
| **Labels / captions** | `9px` | Only acceptable with `font-black uppercase tracking-widest` (letter-spacing makes small caps readable) |
| **Badges / tags** | `8px` | Only acceptable with `font-black uppercase tracking-wider` and high-contrast background |
| **Form inputs** | `12px` | Users type here — must be clearly readable |
| **Button labels** | `11px` | Must pass click-readability test |
| **Numeric/mono values** | `11px` | Financial data must be clear — always use `tabular-nums` |
| **Page titles** | `16px` (`text-lg`) minimum | Headlines must be immediately visible |

#### 🚫 Never Go Below
- **`text-[7px]` or smaller** — NEVER. No element should use this.
- **`text-[8px]`** — ONLY for badges with `font-black uppercase` + colored background
- **`text-[9px]`** — ONLY for labels with `font-black uppercase tracking-widest`

#### Responsive Font Scaling
| Element | Mobile (≤639px) | Tablet+ (≥640px) |
|---------|----------------|-----------------|
| Page title | `text-lg` (18px) | `text-xl` (20px) |
| Subtitle | `text-[10px]` | `text-[11px]` |
| Search input | `text-[12px]` | `text-[13px]` |
| Row data | `text-[12px]` | `text-[13px]` |
| Mono values | `text-[11px]` | `text-[12px]` |

#### Contrast & Weight Rules
1. **Primary text** (`text-app-foreground`): minimum `font-medium` (500) for body, `font-bold` (700) for emphasis
2. **Muted text** (`text-app-muted-foreground`): minimum `font-bold` (700) — lighter weight on muted color = unreadable
3. **On colored backgrounds**: always use `font-black` (900) — ensures readability on tinted surfaces
4. **Numeric data**: always use `font-bold` + `tabular-nums` for alignment
5. **DO NOT** use `font-normal` (400) or `font-light` (300) anywhere — too thin for dark/light themes

---

## 16. Mandatory Features

Every page MUST include:
1. **`page-header-icon`** with glow shadow
2. **KPI strip** (minimum 2 cards, ideally 4-5)
3. **Search bar** with `Ctrl+K` shortcut
4. **Expand/Collapse All** button (for tree views)
5. **Focus Mode** toggle with `Ctrl+Q` shortcut (Maximize2 / Minimize2)
6. **`animate-in fade-in`** on page load
7. **`custom-scrollbar`** on scroll containers
8. **Empty state** with icon + helpful text
9. **Loading state** with `Loader2 animate-spin`

---

## 17. ❌ NEVER Use

- `theme-text`, `theme-text-muted`, `theme-bg` (legacy classes)
- `layout-container-padding` (legacy class)
- `min-h-screen` on page wrapper (breaks flex layout)
- `linear-gradient` on header icons (use flat `bg-app-primary`)
- `text-2xl` or `text-3xl` for titles (too large)
- Raw hex colors (always use `var(--app-*)` tokens)
- Custom CSS `<style>` blocks (use Tailwind only)
- `rounded-2xl` on header icons (use `page-header-icon` class)
- **`grid-cols-2 sm:grid-cols-3 md:grid-cols-5`** — hardcoded column counts (use `auto-fit` instead)
- **`auto-fill`** in grid templates (use `auto-fit` to eliminate blank space)

---

## 18. 📱 Multi-Screen Responsive Strategy (MANDATORY)

> **Every page MUST be designed for all 5 screen tiers.** This is NOT a website — this is a **Vantage OS**.
> Every tier has a GOAL, LAYOUT RULES, UI BEHAVIOR, and DATA STRATEGY.

---

### 📏 Global Breakpoint System
```
mobile:      0 – 640px
tablet:      641 – 1024px
laptop:      1025 – 1440px      ← DEFAULT DESIGN BASE
wide:        1441 – 1920px
ultraWide:   1921px+
```

---

### 📱 1. MOBILE (≤ 640px)
**🎯 Goal:** Speed + Focus + Thumb usability

#### ✅ Layout Rules
- **1 column ONLY**
- **No horizontal scroll (EVER)**
- Max 1 primary action visible
- Page padding: `p-3`

#### ✅ UI Behavior
- Navigation = Bottom bar OR drawer
- **Tables → ❌ NOT allowed** → use instead:
  - Cards
  - Collapsible rows
- Forms: full-width inputs, step-based if long
- Action buttons: icon-only (hide labels with `hidden sm:inline`)
- Search: full-width, no keyboard hint text

#### ✅ Data Strategy
- Show ONLY critical data (primary fields)
- Hide secondary info behind:
  - Accordion / collapsible
  - "View more" button
  - Drawer / modal

#### ❌ Avoid on Mobile
- Dense tables
- Multi-column grids
- Small buttons (touch targets must be ≥ 44px)

---

### 📲 2. TABLET (641px – 1024px)
**🎯 Goal:** Balanced density + touch friendly

#### ✅ Layout Rules
- **2 columns possible**
- Split view (optional)
- Page padding: `p-4`

#### ✅ UI Behavior
- Sidebar = collapsible (toggle)
- Tables = simplified (fewer columns, hide with `hidden md:block`)
- Cards + table hybrid acceptable
- Modals: centered with `max-w-lg`
- Filters: 3-4 per row (auto-fit handles this)

#### ✅ Data Strategy
- Medium density
- Important + secondary data visible
- KPI cards: 3-4 per row

#### 💡 Example
```
POS Layout:
┌──────────────┬──────────────┐
│  Product List │    Cart      │
│  (scrollable) │  (fixed)     │
└──────────────┴──────────────┘
```

---

### 💻 3. LAPTOP (1025px – 1440px)
**🎯 Goal:** Productivity (main working layout)

> **👉 THIS IS THE DEFAULT DESIGN BASE.** Design for laptop first, then adapt up/down.

#### ✅ Layout Rules
- **3–4 columns possible**
- Sidebar always visible
- Page padding: `p-4 md:p-6`

#### ✅ UI Behavior
- Tables = full usage (all standard columns)
- Filters + actions visible
- Forms = multi-column (2-3 cols, auto-fit with `minmax(180px, 1fr)`)
- Full header with all buttons + labels
- Modals: centered with proper width

#### ✅ Data Strategy
- Full dataset
- Inline editing allowed
- KPI cards: 4-5 per row
- Table columns: show 6-7, hide overflow with `hidden lg:block`

---

### 🖥️ 4. WIDE SCREEN (1441px – 1920px)
**🎯 Goal:** Efficiency without empty space

#### ⚠️ CRITICAL RULE
> **👉 DO NOT STRETCH CONTENT.** Use extra space for context, panels, insights — NOT for stretching tables to absurd widths.

#### ✅ Layout Rules
- Max content width: `max-w-[1400px] mx-auto` OR structured grid with panels
- Use extra space for:
  - Side panels (details / analytics)
  - Context information
  - Secondary tables

#### ✅ UI Behavior
- Add right panel for details / analytics
- Add secondary tables alongside main
- Keep main table readable (not too wide)
- KPI cards: 5-6 per row
- Filters: all visible at once
- Detail panels: can show side-by-side (list + detail)

#### ❌ Avoid
- Long stretched tables (bad UX — eye tracking fails)
- Unnecessarily wide inputs
- Content wider than 1400px without structure

---

### 🧠 5. ULTRA-WIDE (1921px+)
**🎯 Goal:** Multi-workspace / power-user mode

#### ✅ Layout Rules
- **Multi-panel layout (CRITICAL)**
```
┌──────────┬─────────────────────────┬─────────────┐
│   NAV    │      MAIN CONTENT       │  INSPECTOR  │
│  (fixed) │    (scrollable)         │  / AI / Logs│
│          │                         │             │
└──────────┴─────────────────────────┴─────────────┘
```

#### ✅ UI Behavior
- Parallel workflows:
  - Edit + Preview
  - Data + Document
  - POS + Analytics
- KPI cards: 6-8 per row
- Table: can show additional analytical columns
- Filters: all 10+ in a single row

#### ✅ Key Use Cases
- **Invoice Verification:**
  - Left: scanned invoice image
  - Right: user input form
  - Bottom/right: validation logs
- **POS:**
  - Left: product catalogue
  - Center: cart / order
  - Right: customer info + analytics

#### Multi-Panel Engine Pattern
```tsx
<WorkspaceLayout>
  <LeftPanel />   {/* navigation / modules */}
  <MainPanel />   {/* main work area */}
  <RightPanel />  {/* inspector / AI / logs */}
</WorkspaceLayout>
```

---

### 🧩 Layout Behavior Matrix

| Feature | Mobile | Tablet | Laptop | Wide | Ultra-Wide |
|---------|--------|--------|--------|------|------------|
| **Columns** | 1 | 2 | 3–4 | 4+ | Multi-panel |
| **Sidebar** | Hidden | Toggle | Fixed | Fixed | Multi |
| **Tables** | ❌ Cards | Lite | Full | +Panels | Split |
| **Forms** | 1 col | 2 col | 2–3 col | 3 col | Split |
| **Actions** | Minimal | Medium | Full | Full | Advanced |
| **Extra Space** | ❌ | Limited | Moderate | Panels | Workspaces |
| **KPI Cards** | 2/row | 3-4/row | 4-5/row | 5-6/row | 6-8/row |
| **Filters** | 2/row | 3-4/row | 5/row | All | All single row |

---

### ⚙️ System-Level Design Rules

#### 1. Max Content Width Rule
```css
max-width: 1400px;
margin: auto;
```
> Prevents ugly stretching on wide screens. Use panels for the remaining space.

#### 2. Density Modes
| Mode | Usage |
|------|-------|
| **Compact** | Dense data views (tables, POS, ledgers) |
| **Comfortable** | Standard pages (default) |
| **Spacious** | Dashboard, landing, onboarding |

#### 3. Priority-Based Rendering
Every data field should be classified:
- **Primary** — always visible on ALL screens
- **Secondary** — hidden on mobile, visible on tablet+
- **Tertiary** — hidden until laptop+
- **Hidden** — behind expand/detail panel

```tsx
// Column visibility by priority:
className=""                   // Primary — always visible
className="hidden sm:block"    // Secondary — hidden on Mobile
className="hidden md:block"    // Tertiary — hidden on Mobile + Tablet
className="hidden lg:block"    // Detail — only Laptop+
className="hidden xl:block"    // Analytics — only Wide + Ultra-Wide
```

#### 4. Adaptive Components
Each component should define behavior per tier:
```tsx
// Table adapts by screen:
// Mobile:    renders as Cards
// Tablet:    compact table (3 cols)
// Laptop:    full table (6-7 cols)
// Wide:      full table + side panel
// Ultra:     split view (table + detail)
```

---

### ⚠️ Responsive Anti-Patterns (FORBIDDEN)
1. **DO NOT** stretch content for the sake of filling space — use **meaningful** space allocation
2. **DO NOT** show conflicting/overlapping data at any breakpoint
3. **DO NOT** use fixed pixel widths for containers (use `1fr`, `%`, or `minmax()`)
4. **DO NOT** hide critical functionality on mobile — move to drawers/modals instead
5. **DO NOT** add `overflow-x-auto` as a bandaid for broken layouts
6. **DO NOT** use horizontal scroll as a design solution
7. **ALWAYS** test touch targets are ≥ 44px on mobile
8. **ALWAYS** use `flex-wrap` on action button groups to prevent overflow
9. **ALWAYS** use `auto-fit` grids — never hardcoded column counts

---

## 19. 🪟 Workspace Architecture — Multi-Panel System (Vantage OS)

> **Key Concept:** Ultra-wide ≠ bigger screen. Ultra-wide = **parallel workflows.**
> Instead of ❌ stretching one page, you do ✅ multiple windows working together.

---

### 🖥️ Three Panel Types

#### 1. 🧩 Split Panels (RECOMMENDED BASE — Phase 1)
> Safest + easiest + best UX

```
┌──────────┬─────────────────────────┬─────────────┐
│   NAV    │      MAIN WORK          │  INSPECTOR  │
│  (fixed) │    (scrollable)         │  / AI / Logs│
└──────────┴─────────────────────────┴─────────────┘
```

✅ **Pros:** Fast, controlled, no chaos
❌ **Cons:** Not "free movement"

#### 2. 🗂️ Dockable Panels (ADVANCED — Phase 2)
> Like VS Code / Figma — drag, resize, dock left/right/bottom

```
┌──────────┬──────────────────┬─────────────┐
│   NAV    │     MAIN         │  DOCKABLE   │
│          │                  │  (draggable)│
│          ├──────────────────┤             │
│          │     BOTTOM DOCK  │             │
└──────────┴──────────────────┴─────────────┘
```

✅ **Pros:** Extremely powerful, perfect for ERP
❌ **Cons:** Needs strong architecture

#### 3. 🪟 Floating Windows (TOOLS ONLY — Phase 3)
> Mini popups inside app — calculator, quick product view, AI assistant

```
┌─────────────────────────────────────┐
│         MAIN CONTENT                │
│                    ┌──────────┐     │
│                    │ FLOATING │     │
│                    │  TOOL    │     │
│                    └──────────┘     │
└─────────────────────────────────────┘
```

✅ **Use for:** Calculator, quick lookup, AI chat
❌ **NEVER use for:** Main workflows (becomes chaos)

---

### 🔥 Ultra-Wide Layout Modes

#### Mode 1: Focus Mode (single task)
```
┌──────────┬────────────────────────────────────┐
│   NAV    │           MAIN CONTENT             │
│          │        (max-w-[1400px])             │
└──────────┴────────────────────────────────────┘
```

#### Mode 2: Dual Work Mode (two parallel tasks)
```
┌──────────┬─────────────────┬─────────────────┐
│   NAV    │    WORK A       │    WORK B        │
│          │  (e.g. Invoice) │  (e.g. Entry)    │
└──────────┴─────────────────┴─────────────────┘
```

#### Mode 3: Full Workspace Mode (DEFAULT for ultra-wide)
```
┌──────────┬─────────────────────────┬──────────┐
│   NAV    │       MAIN WORK         │ INSPECTOR│
│          │   (POS / form / table)  │ AI / logs│
└──────────┴─────────────────────────┴──────────┘
```

#### Mode 4: Power Mode (advanced users)
```
┌──────┬──────────┬──────────┬──────────┐
│ NAV  │ WORK A   │  WORK B  │ INSPECTOR│
│      │          │          │          │
└──────┴──────────┴──────────┴──────────┘
```

---

### ⚙️ Workspace Rules (ENFORCE STRICTLY)

#### 1. No Chaos
> Max **3–4 panels** visible at any time

#### 2. Clear Hierarchy
| Panel | Size | Role |
|-------|------|------|
| **Main** | Largest (50-60%) | Primary workspace |
| **Secondary** | Medium (25-35%) | Supporting content |
| **Tools** | Smallest (15-20%) | Inspector, logs, AI |

#### 3. Snap System
Panels MUST snap to:
- `left` — navigation, document viewer
- `right` — inspector, AI, logs
- `bottom` — terminal, validation output

#### 4. Saved Layouts (Future)
Users can save workspace configurations:
- `"POS Mode"` — Products + Cart + Customer
- `"Finance Mode"` — Ledger + COA + Audit trail
- `"Inventory Audit Mode"` — Stock list + Count + Adjustments

#### 5. Context Linking (🔥 CRITICAL for TSFSYSTEM)
Panels MUST talk to each other:
- Click product → opens detail in right panel
- Select invoice → auto-loads validation panel
- Select customer → shows balance + history in inspector

---

### 🧱 Real TSFSYSTEM Use Cases

#### 🧾 Invoice Verification
```
┌──────┬─────────────────┬──────────┬──────────┐
│ NAV  │ Scanned Invoice │   Data   │ Validation│
│      │   (PDF viewer)  │  Entry   │  Errors   │
│      │                 │  (form)  │  AI / logs│
└──────┴─────────────────┴──────────┴──────────┘
```
> 👉 THIS is where TSF wins vs competitors.

#### 🛒 POS Terminal
```
┌──────┬──────────────┬──────────┬───────────┐
│ NAV  │  Product     │   Cart   │ Customer  │
│      │  Catalogue   │  (order) │  Info +   │
│      │              │          │  Analytics│
└──────┴──────────────┴──────────┴───────────┘
```

#### 📦 Inventory Audit
```
┌──────┬──────────────┬──────────┬───────────┐
│ NAV  │ Stock List   │  Count   │ Adjustment│
│      │ (products)   │  Session │  History  │
└──────┴──────────────┴──────────┴───────────┘
```

#### 💰 Finance Review
```
┌──────┬──────────────┬──────────┬───────────┐
│ NAV  │ Journal      │  Ledger  │  Balance  │
│      │ Entries      │  Detail  │  Sheet    │
└──────┴──────────────┴──────────┴───────────┘
```

---

### 🧱 React Component Architecture

```tsx
// Phase 1: Split Layout (NOW)
<Workspace mode="full">
  <Panel position="left" type="navigation" width="60px" />
  <Panel position="center" type="main" flex={1} />
  <Panel position="right" type="inspector" width="320px" collapsible />
</Workspace>

// Phase 2: Dockable (FUTURE)
<Workspace mode="dockable">
  <DockablePanel id="nav" defaultPosition="left" />
  <DockablePanel id="main" defaultPosition="center" />
  <DockablePanel id="inspector" defaultPosition="right" draggable resizable />
  <DockablePanel id="logs" defaultPosition="bottom" draggable />
</Workspace>

// Phase 3: Floating Tools (FUTURE)
<Workspace>
  {/* ... panels ... */}
  <FloatingWindow id="calculator" trigger="keyboard" shortcut="Ctrl+=" />
  <FloatingWindow id="ai-assistant" trigger="button" />
  <FloatingWindow id="quick-lookup" trigger="keyboard" shortcut="Ctrl+L" />
</Workspace>
```

---

### 🚀 Implementation Roadmap

| Phase | What | When | Complexity |
|-------|------|------|------------|
| **Phase 1** | Split Panels (3-panel max) + responsive per screen | **NOW** | Medium |
| **Phase 2** | Dockable panels + drag/resize | Future | High |
| **Phase 3** | Saved workspaces + floating tools + AI panels | Future | Very High |

> **Phase 1 is the foundation.** Build the `<Workspace>` and `<Panel>` components with split layout support. Everything else layers on top.
