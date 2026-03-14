# 🎨 Unified Design Engine - Complete Guide

**Created**: 2026-03-11
**Status**: ✅ Production Ready

---

## 🎯 What is the Design Engine?

The **Design Engine** is a **unified system** that replaces the old separate `LayoutContext` + `ThemeContext`.

### Before (2 Separate Systems) ❌
```
User has to switch:
1. Layout (spacing, sidebar, cards) → LayoutContext
2. Theme (colors, dark/light) → ThemeContext

Problem: Confusing! Users don't know which combination looks good.
```

### After (1 Unified Engine) ✅
```
User selects ONE design preset:
→ "Finance Pro" preset automatically sets:
  ✅ Colors (dark emerald)
  ✅ Layout (compact, dense)
  ✅ Components (small buttons, tight cards)
  ✅ Sidebar (compact, collapsible)
  ✅ Typography (small fonts)
  ✅ Everything!
```

---

## 🚀 Quick Start

### 1. Wrap Your App with Provider

**File**: `src/app/layout.tsx` or `src/app/providers.tsx`

```tsx
import { DesignEngineProvider } from '@/contexts/DesignEngineContext'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DesignEngineProvider defaultPreset="finance-pro">
          {children}
        </DesignEngineProvider>
      </body>
    </html>
  )
}
```

### 2. Add the Switcher Component

**File**: Any component (Header, Sidebar, Settings)

```tsx
import { DesignEngineSwitcher } from '@/components/shared/DesignEngineSwitcher'

export function TopHeader() {
  return (
    <header>
      <h1>My App</h1>
      <DesignEngineSwitcher />  {/* That's it! */}
    </header>
  )
}
```

### 3. Use Design Variables in Your CSS

**File**: Any component

```tsx
<div
  className="p-[var(--layout-container-padding)] bg-[var(--theme-bg)]"
  style={{
    borderRadius: 'var(--card-radius)',
    color: 'var(--theme-text)',
  }}
>
  <button
    style={{
      height: 'var(--button-height)',
      borderRadius: 'var(--button-radius)',
      backgroundColor: 'var(--theme-primary)',
    }}
  >
    Click me
  </button>
</div>
```

---

## 📦 10 Available Design Presets

### Professional & Corporate

#### 1. **Corporate Minimal** 💼
- **Colors**: Light mode, Apple blue
- **Layout**: Balanced spacing, single-column
- **Best For**: Corporate, Professional, Clean design
- **Sidebar**: Side, minimal, collapsible
- **Example**: macOS-style interface

#### 2. **Finance Pro** 💰
- **Colors**: Dark emerald (professional)
- **Layout**: Compact, dense, grid
- **Best For**: Finance, Accounting, Reports
- **Sidebar**: Side, compact, collapsible
- **Example**: Financial dashboards

#### 3. **Executive Spacious** 👔
- **Colors**: Light indigo (premium)
- **Layout**: Generous whitespace, single-column
- **Best For**: Presentations, Reports, Executive dashboards
- **Sidebar**: Top, minimal
- **Example**: PowerPoint-style layouts

### Creative & Modern

#### 4. **Creative Purple** 🎨
- **Colors**: Dark purple (modern, creative)
- **Layout**: Card-heavy, grid
- **Best For**: Marketing, Creative work, Dashboards
- **Sidebar**: Side, expanded, collapsible
- **Example**: Modern SaaS apps

#### 5. **Modern Ocean** 🌊
- **Colors**: Deep blue (trust, stability)
- **Layout**: Balanced, two-column
- **Best For**: HR, Admin, Settings
- **Sidebar**: Side, expanded, collapsible
- **Example**: Admin panels

#### 6. **Sunset Energy** 🔥
- **Colors**: Bold orange (energetic)
- **Layout**: Grid, balanced
- **Best For**: Sales, Marketing, Analytics
- **Sidebar**: Side, expanded, collapsible
- **Example**: High-energy dashboards

### Efficiency & Productivity

#### 7. **Dashboard Compact** 📊
- **Colors**: Dark emerald
- **Layout**: Dense, grid, minimal spacing
- **Best For**: Dashboards, Monitoring, Data tables
- **Sidebar**: Side, compact, collapsible
- **Example**: Grafana/Datadog-style

#### 8. **Data Dense** 📈
- **Colors**: Dark blue
- **Layout**: Dense, grid, analytics-focused
- **Best For**: Analytics, KPI tracking, Data visualization
- **Sidebar**: Top, compact
- **Example**: Trading terminals

### Specialized

#### 9. **POS Fullscreen** 🛒
- **Colors**: Dark emerald
- **Layout**: Fullscreen, no cards, large buttons
- **Best For**: POS Terminal, Kiosk, Cashier
- **Sidebar**: Hidden
- **Example**: Retail point-of-sale

#### 10. **Light Minimal** ☀️
- **Colors**: Light mode, indigo
- **Layout**: Balanced, two-column
- **Best For**: Light mode, Daylight work, Reading
- **Sidebar**: Side, minimal, collapsible
- **Example**: Clean light interfaces

---

## 🎨 CSS Variables Reference

### Color Variables
```css
--theme-primary         /* Primary brand color */
--theme-primary-dark    /* Darker shade for hover */
--theme-bg              /* Page background */
--theme-surface         /* Card/surface background */
--theme-surface-hover   /* Surface hover state */
--theme-text            /* Primary text color */
--theme-text-muted      /* Secondary/muted text */
--theme-border          /* Border color */
--theme-accent          /* Optional accent color */
--theme-success         /* Success state color */
--theme-warning         /* Warning state color */
--theme-error           /* Error state color */
```

### Layout Variables
```css
--layout-container-padding  /* Container padding */
--layout-section-spacing    /* Section gap */
--layout-card-padding       /* Card internal padding */
--layout-element-gap        /* Element spacing */
```

### Component Variables
```css
/* Cards */
--card-radius      /* Border radius */
--card-shadow      /* Box shadow */
--card-border      /* Border style */
--card-padding     /* Internal padding */

/* Buttons */
--button-radius      /* Border radius */
--button-height      /* Default height */
--button-padding     /* Horizontal padding */
--button-font-size   /* Font size */
--button-font-weight /* Font weight */

/* Inputs */
--input-radius      /* Border radius */
--input-height      /* Default height */
--input-padding     /* Horizontal padding */
--input-font-size   /* Font size */
--input-border      /* Border style */

/* Typography */
--font-heading    /* Heading font family */
--font-body       /* Body font family */
--font-size-h1    /* H1 size */
--font-size-h2    /* H2 size */
--font-size-h3    /* H3 size */
--font-size-body  /* Body text size */
--font-size-small /* Small text size */

/* Navigation */
--nav-width       /* Sidebar width */
```

### Data Attributes
```html
<html
  data-design-preset="finance-pro"
  data-color-mode="dark"
  data-layout-density="dense"
  data-layout-structure="grid"
  data-cards-enabled="true"
  data-nav-position="side"
  data-nav-collapsible="true"
>
```

---

## 🔧 Advanced Usage

### Using the Hook

```tsx
import { useDesignEngine } from '@/contexts/DesignEngineContext'

function MyComponent() {
  const {
    preset,              // Current preset ID
    config,              // Full preset configuration
    setPreset,           // Function to change preset
    availablePresets,    // All presets array
    presetsByCategory,   // Presets grouped by category
  } = useDesignEngine()

  return (
    <div>
      <p>Current: {config.name}</p>
      <p>Category: {config.category}</p>
      <p>Mode: {config.colors.mode}</p>

      <button onClick={() => setPreset('corporate-minimal')}>
        Switch to Corporate
      </button>
    </div>
  )
}
```

### Programmatic Preset Change

```tsx
import { useDesignEngine } from '@/contexts/DesignEngineContext'

function AutoSwitcher() {
  const { setPreset } = useDesignEngine()

  useEffect(() => {
    const hour = new Date().getHours()

    // Auto switch based on time of day
    if (hour >= 9 && hour < 17) {
      setPreset('light-minimal')  // Daylight hours
    } else {
      setPreset('finance-pro')    // Evening/night
    }
  }, [])

  return <></>
}
```

### Per-Module Presets

```tsx
'use client'

import { DesignEngineProvider } from '@/contexts/DesignEngineContext'

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <DesignEngineProvider
      defaultPreset="pos-fullscreen"
      storageKey="pos-design-preset"  // Separate storage
    >
      {children}
    </DesignEngineProvider>
  )
}
```

### Conditional Styling

```tsx
function AdaptiveCard() {
  const { config } = useDesignEngine()

  return (
    <div
      style={{
        padding: config.layout.spacing.card,
        borderRadius: config.components.cards.borderRadius,
        backgroundColor: config.colors.surface,
        color: config.colors.text,
      }}
    >
      Card content adapts to current preset!
    </div>
  )
}
```

---

## 🎯 Migration Guide

### From Old System (LayoutContext + ThemeContext)

**Before**:
```tsx
import { useLayout } from '@/contexts/LayoutContext'
import { useTheme } from '@/contexts/ThemeContext'

function MyComponent() {
  const { layout, setLayout } = useLayout()
  const { theme, setTheme } = useTheme()

  // User has to switch both separately!
  setLayout('compact')
  setTheme('midnight-pro')
}
```

**After**:
```tsx
import { useDesignEngine } from '@/contexts/DesignEngineContext'

function MyComponent() {
  const { preset, setPreset } = useDesignEngine()

  // One switch controls everything!
  setPreset('finance-pro')  // Sets compact layout + midnight colors
}
```

### CSS Variable Migration

**Before**:
```css
/* Layout variables */
var(--layout-container-padding)
var(--layout-card-radius)

/* Theme variables */
var(--theme-primary)
var(--theme-bg)
```

**After** (Same variables, but now controlled by ONE preset!):
```css
/* All variables still work the same */
var(--layout-container-padding)  /* From preset's layout.spacing */
var(--card-radius)                /* From preset's components.cards */
var(--theme-primary)              /* From preset's colors */
var(--button-height)              /* NEW! From preset's components.buttons */
```

---

## 📊 Comparison: Old vs New

| Feature | Old System | New System |
|---------|------------|------------|
| **Number of Systems** | 2 separate (Layout + Theme) | 1 unified (Design Engine) |
| **User Switches** | 2 switches needed | 1 switch controls all |
| **Presets** | 6 layouts × 10 themes = 60 combos | 10 curated presets |
| **Consistency** | Users pick bad combos | All presets guaranteed good |
| **Controls** | Layout + Colors only | Layout + Colors + Components + Sidebar |
| **CSS Variables** | ~15 variables | ~35 variables |
| **Complexity** | Medium | Low (easier to use) |
| **Flexibility** | High (but confusing) | Medium (but guided) |

---

## ✅ Testing Checklist

After integrating the Design Engine:

- [ ] Wrap app with `DesignEngineProvider`
- [ ] Add `DesignEngineSwitcher` to header/sidebar
- [ ] Test all 10 presets
- [ ] Verify colors change correctly
- [ ] Verify spacing changes correctly
- [ ] Verify components (buttons/inputs) change correctly
- [ ] Verify sidebar position changes correctly
- [ ] Test localStorage persistence (refresh page)
- [ ] Test responsive behavior
- [ ] Verify no CSS conflicts

---

## 🚨 Common Issues & Solutions

### Issue: Variables not updating
```tsx
// ❌ WRONG: Don't use inline styles for colors
<div style={{ color: '#10B981' }}>Text</div>

// ✅ CORRECT: Use CSS variables
<div style={{ color: 'var(--theme-primary)' }}>Text</div>
<div className="text-[var(--theme-text)]">Text</div>
```

### Issue: Preset not persisting after refresh
```tsx
// Make sure you have a unique storageKey per context
<DesignEngineProvider storageKey="my-app-design-preset">
```

### Issue: Sidebar not changing
```tsx
// Ensure your sidebar component uses the variables
<aside style={{ width: 'var(--nav-width)' }}>
  {/* Sidebar content */}
</aside>

// Or use the data attribute in CSS
aside[data-nav-position="side"] {
  display: block;
}

aside[data-nav-position="hidden"] {
  display: none;
}
```

---

## 🎓 Best Practices

### 1. Use Variables Consistently
```tsx
// ✅ GOOD: Always use CSS variables
<Button
  style={{
    height: 'var(--button-height)',
    borderRadius: 'var(--button-radius)',
  }}
/>

// ❌ BAD: Don't hardcode values
<Button style={{ height: '40px', borderRadius: '8px' }} />
```

### 2. Respect Data Attributes
```tsx
// ✅ GOOD: Use data attributes for conditional styling
<div data-layout-density="dense" className="...">

// In CSS:
[data-layout-density="dense"] {
  padding: 0.5rem;
}

[data-layout-density="sparse"] {
  padding: 2rem;
}
```

### 3. Provide Preset Recommendations
```tsx
// ✅ GOOD: Guide users to appropriate presets
function FinanceModule() {
  const { preset, setPreset } = useDesignEngine()

  useEffect(() => {
    // Suggest finance-pro for finance module
    if (preset !== 'finance-pro' && preset !== 'dashboard-compact') {
      // Show hint: "Try Finance Pro preset for better data visibility"
    }
  }, [preset])
}
```

---

## 📝 Summary

**What You Get**:
- ✅ **1 unified system** instead of 2 separate systems
- ✅ **10 curated presets** that work perfectly
- ✅ **35+ CSS variables** controlling everything
- ✅ **Automatic consistency** - no bad combinations
- ✅ **Easy to use** - one switcher, one hook
- ✅ **Fully typed** - TypeScript support
- ✅ **LocalStorage persistence** - saves user choice

**Files Created**:
1. `src/contexts/DesignEngineContext.tsx` - Main engine
2. `src/components/shared/DesignEngineSwitcher.tsx` - UI switcher
3. `DESIGN_ENGINE_GUIDE.md` - This guide (you are here!)

**Next Steps**:
1. Integrate into your app (follow Quick Start)
2. Test all 10 presets
3. Gradually migrate old Layout/Theme code
4. Remove old `LayoutContext` and `ThemeContext` when ready

---

**🎉 Enjoy your unified design system!**

**Questions?** Check the examples in the Advanced Usage section or inspect the source code in `DesignEngineContext.tsx`.
