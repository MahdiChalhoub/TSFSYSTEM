# Theme & Layout System - Quick Start Guide

## 🚀 5-Minute Integration Guide

### Step 1: Start the Dev Server
```bash
npm run dev
```

### Step 2: Visit the Demo
Open your browser to:
```
http://localhost:3000/theme-layout-demo
```

### Step 3: Try Switching!
Click the **"Palette"** button (Theme Switcher) in the top-right corner and select different themes. Watch the entire page change colors instantly!

Click the **"Layout Grid"** button (Layout Switcher) and try different layouts. See how spacing, card styles, and density change!

---

## 📦 What You Get

### 10 Color Themes
1. **Midnight Pro** (Dark emerald - professional)
2. **Purple Dream** (Dark purple - creative) ⭐ User favorite
3. **Ocean Blue** (Dark blue - calm)
4. **Sunset Orange** (Dark orange - energetic)
5. **Forest Green** (Dark green - natural)
6. **Ruby Red** (Dark red - bold)
7. **Arctic Blue** (Light sky blue)
8. **Ivory** (Light warm white)
9. **Cyber Neon** (Dark with neon accents)
10. **Monochrome** (Minimal black & white)

### 5 Layout Structures
1. **Minimal** (Spacious, clean, lots of whitespace)
2. **Card Heavy** (Modern cards with shadows) ⭐ Default
3. **Split View** (Sidebar + main content)
4. **Dashboard Grid** (Dense, information-rich)
5. **Fullscreen Focus** (Single-task, no distractions)

### Result
**50 visual combinations** (10 themes × 5 layouts)

---

## 🎨 How to Use in Your Pages

### Basic Setup

```tsx
"use client"

import { ThemeProvider } from '@/contexts/ThemeContext'
import { LayoutProvider } from '@/contexts/LayoutContext'
import { ThemeSwitcher } from '@/components/shared/ThemeSwitcher'
import { LayoutSwitcher } from '@/components/shared/LayoutSwitcher'

export default function MyPage() {
  return (
    <ThemeProvider defaultTheme="midnight-pro">
      <LayoutProvider defaultLayout="card-heavy">
        <div style={{ background: 'var(--theme-bg)', minHeight: '100vh' }}>
          {/* Header with switchers */}
          <header style={{
            background: 'var(--theme-surface)',
            padding: 'var(--layout-container-padding)',
            borderBottom: '1px solid var(--theme-border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h1 style={{ color: 'var(--theme-text)' }}>My Page</h1>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <ThemeSwitcher />
                <LayoutSwitcher />
              </div>
            </div>
          </header>

          {/* Main content */}
          <main style={{ padding: 'var(--layout-container-padding)' }}>
            <div style={{
              background: 'var(--theme-surface)',
              padding: 'var(--layout-card-padding)',
              borderRadius: 'var(--layout-card-radius)',
              border: '1px solid var(--theme-border)',
              boxShadow: 'var(--layout-card-shadow)'
            }}>
              <h2 style={{ color: 'var(--theme-text)' }}>Content Card</h2>
              <p style={{ color: 'var(--theme-text-muted)' }}>
                This card adapts to both theme colors AND layout spacing!
              </p>
            </div>
          </main>
        </div>
      </LayoutProvider>
    </ThemeProvider>
  )
}
```

---

## 🎯 Using with Tailwind

You can also use theme variables in Tailwind classes:

```tsx
<div className="bg-[var(--theme-surface)] p-[var(--layout-card-padding)] border-[var(--theme-border)]">
  <h2 className="text-[var(--theme-text)]">Title</h2>
  <p className="text-[var(--theme-text-muted)]">Description</p>
</div>
```

---

## 🔧 Accessing Context

### In a Component

```tsx
"use client"

import { useTheme } from '@/contexts/ThemeContext'
import { useLayout } from '@/contexts/LayoutContext'

export function MyComponent() {
  const { theme, themeConfig, setTheme, availableThemes } = useTheme()
  const { layout, layoutConfig, setLayout, availableLayouts } = useLayout()

  return (
    <div>
      <p>Current theme: {themeConfig.name}</p>
      <p>Current theme color: {themeConfig.colors.primary}</p>
      <p>Current layout: {layoutConfig.name}</p>
      <p>Layout density: {layoutConfig.characteristics.density}</p>

      {/* Programmatically switch */}
      <button onClick={() => setTheme('purple-dream')}>
        Switch to Purple Dream
      </button>
      <button onClick={() => setLayout('minimal')}>
        Switch to Minimal Layout
      </button>
    </div>
  )
}
```

---

## 📋 Available CSS Variables

### Theme Variables (Colors)
```css
var(--theme-primary)         /* Main accent color */
var(--theme-primary-dark)    /* Darker variant */
var(--theme-bg)              /* Page background */
var(--theme-surface)         /* Card/panel background */
var(--theme-surface-hover)   /* Hover state */
var(--theme-text)            /* Primary text */
var(--theme-text-muted)      /* Secondary text */
var(--theme-border)          /* Border color */
```

### Layout Variables (Spacing & Structure)
```css
var(--layout-container-padding)   /* Page container padding (1rem - 3rem) */
var(--layout-section-spacing)     /* Section gaps (1.5rem - 3rem) */
var(--layout-card-padding)        /* Card internal padding (1rem - 2rem) */
var(--layout-element-gap)         /* Element spacing (0.75rem - 1.5rem) */
var(--layout-card-radius)         /* Border radius (0 - 0.75rem) */
var(--layout-card-shadow)         /* Box shadow */
var(--layout-card-border)         /* Border style */
```

---

## 🎨 Real-World Examples

### Dashboard Card
```tsx
<div style={{
  background: 'var(--theme-surface)',
  padding: 'var(--layout-card-padding)',
  borderRadius: 'var(--layout-card-radius)',
  border: '1px solid var(--theme-border)',
  boxShadow: 'var(--layout-card-shadow)'
}}>
  <h3 style={{ color: 'var(--theme-text)', fontSize: '1.25rem', fontWeight: '600' }}>
    Revenue
  </h3>
  <p style={{ color: 'var(--theme-primary)', fontSize: '2rem', fontWeight: '700', margin: '0.5rem 0' }}>
    $45,231
  </p>
  <p style={{ color: 'var(--theme-text-muted)', fontSize: '0.875rem' }}>
    +12.5% from last month
  </p>
</div>
```

### Button with Theme Colors
```tsx
<button style={{
  background: 'var(--theme-primary)',
  color: '#fff',
  padding: '0.75rem 1.5rem',
  borderRadius: '0.5rem',
  border: 'none',
  cursor: 'pointer',
  fontWeight: '500'
}}>
  Primary Action
</button>

<button style={{
  background: 'transparent',
  color: 'var(--theme-text)',
  padding: '0.75rem 1.5rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--theme-border)',
  cursor: 'pointer',
  fontWeight: '500'
}}>
  Secondary Action
</button>
```

### Grid with Layout Spacing
```tsx
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: 'var(--layout-section-spacing)',
  padding: 'var(--layout-container-padding)'
}}>
  <Card>Content 1</Card>
  <Card>Content 2</Card>
  <Card>Content 3</Card>
</div>
```

---

## 🔍 Debugging

### Check Current Theme/Layout in Console
```javascript
// Get current theme
console.log(document.documentElement.getAttribute('data-theme'))
// Output: "midnight-pro"

// Get current layout
console.log(document.documentElement.getAttribute('data-layout'))
// Output: "card-heavy"

// Get theme primary color
console.log(getComputedStyle(document.documentElement).getPropertyValue('--theme-primary'))
// Output: "#10B981"

// Get layout container padding
console.log(getComputedStyle(document.documentElement).getPropertyValue('--layout-container-padding'))
// Output: "2rem"
```

### Check localStorage
```javascript
// Theme preference
console.log(localStorage.getItem('tsfsystem-theme'))

// Layout preference
console.log(localStorage.getItem('tsfsystem-layout'))
```

---

## 🚨 Common Issues

### Issue 1: "useTheme must be used within ThemeProvider"
**Solution**: Wrap your component tree with `<ThemeProvider>`

```tsx
// ❌ Wrong
export default function Page() {
  const { theme } = useTheme() // ERROR!
  return <div>Content</div>
}

// ✅ Correct
export default function Page() {
  return (
    <ThemeProvider>
      <Content />
    </ThemeProvider>
  )
}

function Content() {
  const { theme } = useTheme() // Works!
  return <div>Content</div>
}
```

### Issue 2: Styles Not Updating
**Solution**: Make sure you're using CSS variables, not hardcoded values

```tsx
// ❌ Wrong
<div style={{ background: '#0F172A' }}>Content</div>

// ✅ Correct
<div style={{ background: 'var(--theme-surface)' }}>Content</div>
```

### Issue 3: Server-Side Rendering Issues
**Solution**: Mark component as client-side with `"use client"`

```tsx
"use client"  // Add this at the top

import { useTheme } from '@/contexts/ThemeContext'

export function MyComponent() {
  // ...
}
```

---

## 📖 Best Practices

### 1. Always Use CSS Variables
```tsx
// ✅ Good - adapts to theme changes
<div style={{ color: 'var(--theme-text)' }}>Text</div>

// ❌ Bad - hardcoded, won't change
<div style={{ color: '#F1F5F9' }}>Text</div>
```

### 2. Respect Layout Variables
```tsx
// ✅ Good - adapts to layout density
<div style={{ padding: 'var(--layout-card-padding)' }}>Card</div>

// ❌ Bad - fixed padding, ignores layout
<div style={{ padding: '1rem' }}>Card</div>
```

### 3. Provide Default Props
```tsx
<ThemeProvider defaultTheme="midnight-pro">
  <LayoutProvider defaultLayout="card-heavy">
    {children}
  </LayoutProvider>
</ThemeProvider>
```

### 4. Use Semantic Variable Names
```tsx
// ✅ Good - semantic, clear purpose
<div style={{ color: 'var(--theme-text-muted)' }}>Subtitle</div>

// ❌ Bad - not semantic, unclear
<div style={{ color: 'var(--theme-primary)' }}>Subtitle</div>
```

---

## 🎓 Advanced Usage

### Conditional Theming
```tsx
const { themeConfig } = useTheme()

// Different UI based on dark/light mode
if (themeConfig.mode === 'dark') {
  return <DarkModeComponent />
} else {
  return <LightModeComponent />
}
```

### Layout-Specific Rendering
```tsx
const { layout } = useLayout()

// Different layout for fullscreen focus
if (layout === 'fullscreen-focus') {
  return <FullscreenView />
} else {
  return <NormalView />
}
```

### Programmatic Theme Change
```tsx
function ThemeButton() {
  const { setTheme } = useTheme()

  return (
    <div>
      <button onClick={() => setTheme('midnight-pro')}>Professional</button>
      <button onClick={() => setTheme('purple-dream')}>Creative</button>
      <button onClick={() => setTheme('arctic-blue')}>Light Mode</button>
    </div>
  )
}
```

---

## 🔗 Related Files

- **Theme Context**: `src/contexts/ThemeContext.tsx`
- **Layout Context**: `src/contexts/LayoutContext.tsx`
- **Theme Switcher**: `src/components/shared/ThemeSwitcher.tsx`
- **Layout Switcher**: `src/components/shared/LayoutSwitcher.tsx`
- **Live Demo**: `src/app/(public)/theme-layout-demo/page.tsx`
- **Full Documentation**: `LAYOUT_THEME_SYSTEM.md`
- **Day 1 Report**: `LAYOUT_THEME_SYSTEM_DAY1_COMPLETE.md`

---

## 🎯 Next Steps

1. **Explore the Demo**: Visit `/theme-layout-demo` and try all combinations
2. **Integrate in a Test Page**: Pick a simple page and add the providers
3. **Experiment with Variables**: Try different theme/layout combinations
4. **Build Custom Themes**: Modify ThemeContext.tsx to add your own themes
5. **Create Module-Specific Layouts**: Design layouts optimized for specific modules

---

## 💡 Tips

- **Start Simple**: Wrap one page first, test, then expand
- **Use the Demo**: Reference the demo page for implementation examples
- **Check Variables**: Use browser DevTools to inspect CSS variables
- **Test Combinations**: Try different theme+layout combos to find what works best
- **User Preferences**: The system automatically saves user choices to localStorage

---

**Questions?** Check the full documentation in `LAYOUT_THEME_SYSTEM.md` or the Day 1 completion report in `LAYOUT_THEME_SYSTEM_DAY1_COMPLETE.md`.

**Status**: ✅ System is production-ready. Start integrating today!
