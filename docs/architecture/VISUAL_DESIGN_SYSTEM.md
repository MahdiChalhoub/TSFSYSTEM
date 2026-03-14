# TSFSYSTEM Visual Design System - Multiple Style Variants

**Problem Identified**: Your theme system only changes colors/fonts, but cards, buttons, and layouts stay the same shape.

**Solution**: Create **multiple visual design variants** that you can apply page-by-page.

---

## 🎨 Visual Design Variants (Choose Per Page)

### Variant 1: **Corporate Minimal** (Current Default)
- Flat cards with subtle borders
- Simple rounded corners
- Minimal shadows
- Clean, professional

### Variant 2: **Glassmorphism** (Modern, Premium)
- Frosted glass effect
- Backdrop blur
- Translucent backgrounds
- Floating elements

### Variant 3: **Neumorphism** (Soft, Tactile)
- Soft shadows (inset/outset)
- Subtle 3D depth
- Material-like feel
- Light/dark variants

### Variant 4: **Sharp Material** (Bold, Angular)
- Strong elevation shadows
- Crisp corners or sharp angles
- Bold separators
- High contrast

### Variant 5: **Organic Bubbles** (Friendly, Playful)
- Large border radius (2rem+)
- Soft gradients
- Pill-shaped elements
- Rounded everything

---

## 📦 Implementation: Style Variant System

Instead of having ONE card style, you'll have:
```tsx
<Card variant="glass" />      // Glassmorphism
<Card variant="neuro" />      // Neumorphism
<Card variant="sharp" />      // Sharp Material
<Card variant="bubble" />     // Organic Bubbles
<Card variant="minimal" />    // Corporate Minimal (default)
```

Then you can set **per-page** or **per-module** defaults:
```tsx
// Finance module: Professional minimal
<FinanceLayout designVariant="minimal">

// POS module: Bold and clear
<POSLayout designVariant="sharp">

// Dashboard: Modern glassmorphism
<DashboardLayout designVariant="glass">
```

---

## 🎨 Variant Showcase: CARD Component

Let me show you the **exact CSS** for each variant:

### 1. Minimal (Current Default)
```tsx
// src/components/ui/variants/card-minimal.tsx
const CardMinimal = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Minimal style
        "rounded-lg",
        "border border-[var(--app-border)]",
        "bg-[var(--app-surface)]",
        "shadow-sm",
        "p-6",
        className
      )}
      {...props}
    />
  )
);
```

**Visual**: 
```
┌─────────────────────┐
│  Flat card          │
│  Simple border      │
│  Minimal shadow     │
└─────────────────────┘
```

### 2. Glassmorphism (Modern Premium)
```tsx
// src/components/ui/variants/card-glass.tsx
const CardGlass = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Glass style
        "rounded-2xl",
        "bg-white/5",                    // Translucent
        "backdrop-blur-xl",              // Frosted glass
        "backdrop-saturate-150",
        "border border-white/10",
        "shadow-2xl shadow-black/20",
        "p-6",
        // Glass effect needs this
        "relative overflow-hidden",
        // Optional: glass shine
        "before:absolute before:inset-0",
        "before:bg-gradient-to-br before:from-white/10 before:to-transparent",
        "before:pointer-events-none",
        className
      )}
      {...props}
    />
  )
);
```

**Visual**:
```
╔═════════════════════╗
║ ░░░ Frosted    ░░░ ║  <- Blur effect
║ ░░ Translucent ░░  ║
║ ░ Glass effect  ░  ║
╚═════════════════════╝
```

### 3. Neumorphism (Soft 3D)
```tsx
// src/components/ui/variants/card-neuro.tsx
const CardNeuro = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Neuro style
        "rounded-3xl",
        "bg-[var(--app-surface)]",
        // Soft outset shadow (looks raised)
        "shadow-[8px_8px_16px_rgba(0,0,0,0.2),-8px_-8px_16px_rgba(255,255,255,0.05)]",
        "p-6",
        "transition-all duration-300",
        // Hover: looks pressed
        "hover:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2),inset_-4px_-4px_8px_rgba(255,255,255,0.05)]",
        className
      )}
      {...props}
    />
  )
);
```

**Visual**:
```
    ╱────────────────╲
   ╱  Soft raised    ╲   <- Looks 3D
  │   card with      │
  │   subtle depth   │
   ╲                ╱
    ╲──────────────╱
```

### 4. Sharp Material (Bold)
```tsx
// src/components/ui/variants/card-sharp.tsx
const CardSharp = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Sharp style
        "rounded-md",                    // Smaller radius
        "bg-[var(--app-surface)]",
        "border-l-4 border-l-[var(--app-primary)]",  // Bold accent
        "shadow-lg",
        "p-6",
        "transition-transform",
        "hover:translate-x-1",           // Slide effect
        className
      )}
      {...props}
    />
  )
);
```

**Visual**:
```
┃━━━━━━━━━━━━━━━━━━┓
┃ Bold left accent ┃  <- Colored border
┃ Sharp corners    ┃
┃━━━━━━━━━━━━━━━━━━┛
```

### 5. Organic Bubbles (Friendly)
```tsx
// src/components/ui/variants/card-bubble.tsx
const CardBubble = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Bubble style
        "rounded-[2rem]",                // Very round
        "bg-gradient-to-br from-[var(--app-surface)] to-[var(--app-surface-2)]",
        "border-2 border-[var(--app-border)]",
        "shadow-xl",
        "p-8",                           // More padding
        "transition-all duration-500",
        "hover:scale-[1.02]",            // Grows on hover
        "hover:shadow-2xl",
        className
      )}
      {...props}
    />
  )
);
```

**Visual**:
```
  ╭─────────────────╮
 ╭                   ╮
│  Soft rounded      │  <- Very round
│  bubble card       │
 ╰                   ╯
  ╰─────────────────╯
```

---

## 🔧 Implementation Strategy

### Step 1: Create Variant Components (1 day)

Create this file structure:
```
src/components/ui/variants/
├── card-minimal.tsx
├── card-glass.tsx
├── card-neuro.tsx
├── card-sharp.tsx
├── card-bubble.tsx
├── button-minimal.tsx
├── button-glass.tsx
├── button-neuro.tsx
├── button-sharp.tsx
├── button-bubble.tsx
└── index.ts
```

### Step 2: Create Unified Component with Variants

```tsx
// src/components/ui/card.tsx (NEW VERSION)
import * as React from "react"
import { cn } from "@/lib/utils"

// Import all variants
import { CardMinimal } from "./variants/card-minimal"
import { CardGlass } from "./variants/card-glass"
import { CardNeuro } from "./variants/card-neuro"
import { CardSharp } from "./variants/card-sharp"
import { CardBubble } from "./variants/card-bubble"

export type CardVariant = "minimal" | "glass" | "neuro" | "sharp" | "bubble"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "minimal", ...props }, ref) => {
    // Choose variant
    switch (variant) {
      case "glass":
        return <CardGlass ref={ref} {...props} />
      case "neuro":
        return <CardNeuro ref={ref} {...props} />
      case "sharp":
        return <CardSharp ref={ref} {...props} />
      case "bubble":
        return <CardBubble ref={ref} {...props} />
      default:
        return <CardMinimal ref={ref} {...props} />
    }
  }
)
Card.displayName = "Card"

export { Card }
```

### Step 3: Use Per-Page or Per-Module

**Option A: Set on the page**
```tsx
// app/(privileged)/finance/invoices/page.tsx
export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      {/* Use glass variant for this page */}
      <Card variant="glass">
        <h2>Invoices</h2>
      </Card>
      
      <Card variant="glass">
        <DataTable />
      </Card>
    </div>
  )
}
```

**Option B: Set module-wide default with Context**
```tsx
// src/contexts/DesignContext.tsx
const DesignContext = createContext<CardVariant>("minimal")

export function DesignProvider({ 
  children, 
  variant = "minimal" 
}: { 
  children: React.ReactNode
  variant?: CardVariant 
}) {
  return (
    <DesignContext.Provider value={variant}>
      {children}
    </DesignContext.Provider>
  )
}

export function useDesignVariant() {
  return useContext(DesignContext)
}

// Then in Card component:
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant, ...props }, ref) => {
    const defaultVariant = useDesignVariant()
    const finalVariant = variant || defaultVariant
    
    // ... switch statement
  }
)
```

**Usage**:
```tsx
// app/(privileged)/finance/layout.tsx
export default function FinanceLayout({ children }) {
  return (
    <DesignProvider variant="minimal">
      {children}
    </DesignProvider>
  )
}

// app/(privileged)/sales/layout.tsx
export default function SalesLayout({ children }) {
  return (
    <DesignProvider variant="glass">
      {children}
    </DesignProvider>
  )
}
```

---

## 🎨 Button Variants (Same Pattern)

### Glass Button
```tsx
const ButtonGlass = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "px-6 py-3 rounded-xl",
        "bg-white/10 backdrop-blur-md",
        "border border-white/20",
        "text-white font-medium",
        "hover:bg-white/20",
        "transition-all duration-300",
        "shadow-lg hover:shadow-xl",
        className
      )}
      {...props}
    />
  )
)
```

### Neuro Button
```tsx
const ButtonNeuro = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "px-6 py-3 rounded-2xl",
        "bg-[var(--app-surface)]",
        "shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)]",
        "active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)]",
        "transition-all duration-200",
        className
      )}
      {...props}
    />
  )
)
```

### Sharp Button
```tsx
const ButtonSharp = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "px-6 py-3 rounded-md",
        "bg-[var(--app-primary)]",
        "text-white font-bold uppercase text-sm tracking-wide",
        "border-b-4 border-[var(--app-primary-dark)]",
        "active:border-b-2 active:translate-y-0.5",
        "transition-all duration-100",
        "shadow-lg",
        className
      )}
      {...props}
    />
  )
)
```

### Bubble Button
```tsx
const ButtonBubble = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "px-8 py-4 rounded-full",
        "bg-gradient-to-r from-[var(--app-primary)] to-[var(--app-primary-dark)]",
        "text-white font-semibold",
        "shadow-xl hover:shadow-2xl",
        "hover:scale-105",
        "transition-all duration-300",
        className
      )}
      {...props}
    />
  )
)
```

---

## 📊 Visual Comparison

### Invoice List Page - 5 Variants

**Minimal**:
```
┌─────────────────────────────────┐
│ Invoices                        │
├─────────────────────────────────┤
│ INV-001  │ $1,200  │ [Pending] │
│ INV-002  │ $3,400  │ [Paid]    │
└─────────────────────────────────┘
```

**Glass**:
```
╔═════════════════════════════════╗
║ ░░░ Invoices ░░░░░░░░░░░░░░░░░ ║
║═════════════════════════════════║
║ ░ INV-001  │ $1,200  │ ░░░░░░ ║
║ ░ INV-002  │ $3,400  │ ░░░░░░ ║
╚═════════════════════════════════╝
```

**Neuro**:
```
    ╱─────────────────────────╲
   ╱ Invoices                 ╲
  ╱═══════════════════════════╲
 │ INV-001 │ $1,200 │ Pending │
 │ INV-002 │ $3,400 │ Paid    │
  ╲                           ╱
   ╲─────────────────────────╱
```

**Sharp**:
```
┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Invoices                    ┃
┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ INV-001 │ $1,200 │ PENDING ┃
┃ INV-002 │ $3,400 │ PAID    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**Bubble**:
```
  ╭────────────────────────────╮
 ╭  Invoices                    ╮
│                                │
│  ◉ INV-001  $1,200  ◷ Pending │
│  ◉ INV-002  $3,400  ✓ Paid    │
 ╰                              ╯
  ╰────────────────────────────╯
```

---

## ✅ NEXT STEPS - Page by Page Redesign

### Week 1: Build Variant System
- [ ] Create 5 card variants
- [ ] Create 5 button variants  
- [ ] Create 5 input variants
- [ ] Create 5 table variants
- [ ] Test all variants in Storybook

### Week 2-12: Redesign Page by Page

**You decide per page**:
```markdown
## Finance Module
- [ ] Invoice List → `glass` variant
- [ ] Invoice Detail → `glass` variant
- [ ] Payment List → `minimal` variant
- [ ] Journal Entries → `sharp` variant

## POS Module
- [ ] Terminal → `sharp` variant (bold, clear)
- [ ] Sales History → `minimal` variant
- [ ] Cashier Dashboard → `bubble` variant (friendly)

## Inventory
- [ ] Product List → `neuro` variant
- [ ] Stock Movements → `minimal` variant
- [ ] Warehouse View → `sharp` variant
```

---

## 🎯 Quick Start: Build ONE Variant Now

Want me to build the **Glass variant** right now? I can create:

1. `card-glass.tsx` - Glassmorphism card
2. `button-glass.tsx` - Glass button
3. Example page using glass variant

This will take 10 minutes and you'll see the EXACT difference!

---

**Generated**: 2026-03-05 02:55 UTC  
**Solution**: Visual Design Variants (not just color themes)  
**Status**: Ready to implement page-by-page
