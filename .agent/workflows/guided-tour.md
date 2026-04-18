---
description: How to create a guided tour for any page in TSFSYSTEM
---

# Guided Tour Workflow

## File Locations

- Definitions: `src/lib/tours/definitions/{module}-{page}.ts`
- Types: `src/lib/tours/types.ts`
- Registry: `src/lib/tours/registry.ts`
- Context: `src/lib/tours/context.tsx` (mounted in privileged layout)
- Storage: `src/lib/tours/storage.ts` (localStorage)
- Hook: `src/lib/tours/useTour.ts`
- Renderer: `src/components/ui/GuidedTour.tsx` (shared — DO NOT modify per-page)
- Reference: `src/lib/tours/definitions/inventory-categories.ts` (14-step example)

## Step 1: Create Definition File

Create `src/lib/tours/definitions/{module}-{page}.ts`:

```typescript
import { createElement } from 'react'
import { registerTour } from '@/lib/tours/registry'
import type { TourConfig } from '@/lib/tours/types'
import { Sparkles, Keyboard } from 'lucide-react'

/**
 * Step index reference (for stepActions):
 *  0 = Welcome (centered)
 *  1 = Feature X (info)
 *  2 = Feature Y (ACTION)
 *  ...
 *  N = Complete (centered)
 */
const tour: TourConfig = {
    id: '{module}-{page}',
    title: 'Page Title',
    module: '{module}',
    description: 'What this tour covers.',
    version: 1,
    steps: [
        { target: null, isWelcome: true, title: 'Welcome 👋', description: '...', icon: createElement(Sparkles, { size: 16 }), color: 'var(--app-primary)' },
        // ... feature steps ...
        { target: null, isWelcome: true, title: 'All Set! 🎉', description: '...', icon: createElement(Sparkles, { size: 16 }), color: 'var(--app-primary)' },
    ],
}
registerTour(tour)
export default tour
```

## Step 2: Three Step Behaviors

| Behavior | Effect | Use When |
|----------|--------|----------|
| `'info'` (default) | Tooltip + Next button | Passive explanation |
| `'click'` | Waits for user click on target | User must interact |
| `'action'` | Runs callback programmatically | Tour does something for user |

## Step 3: Add `data-tour` Attributes to Page JSX

```tsx
<div data-tour="kpi-strip">...</div>
<button data-tour="add-btn">...</button>
<div data-tour="detail-drawer">...</div>
<div data-tour="detail-tabs">...</div>
```

Convention: `data-tour="{descriptive-slug}"` — lowercase hyphenated.

CRITICAL: Element MUST exist when step activates. For dynamic elements (drawers), use `behavior: 'action'` to create them first. Engine retries at 150ms and 600ms.

## Step 4: Wire Into Page Component

```tsx
'use client'
import { GuidedTour, TourTriggerButton } from '@/components/ui/GuidedTour'
import { usePageTour } from '@/lib/tours/useTour'
import '@/lib/tours/definitions/{module}-{page}'  // Side-effect import

export function MyPageClient() {
    const { start: startTour } = usePageTour('{module}-{page}')

    const tourStepActions = useMemo(() => ({
        3: () => { setExpandAll(true) },        // ACTION step
        4: () => { setSidebarNode(data[0]) },   // ACTION step
        6: () => { setActiveTab('brands') },    // ACTION step
    }), [data])

    return (
        <div>
            <TourTriggerButton onClick={startTour} />
            <GuidedTour tourId="{module}-{page}" stepActions={tourStepActions} />
            {/* page content with data-tour attributes */}
        </div>
    )
}
```

## Step 5: Mandatory Pattern

Every tour: Welcome → Features → Shortcuts → Complete

## Performance Rules

1. NO `backdropFilter: blur()` — only `rgba(0,0,0,0.45)`
2. NO SVG masks — use `box-shadow: 0 0 0 9999px` spotlight
3. NO `key` prop on root div — prevents remount
4. CSS transitions only — `transition: 0.3s ease`
5. Inline styles over Tailwind in tooltip

## Color Tokens

- Primary: `var(--app-primary)`
- Info: `var(--app-info, #3b82f6)`
- Success: `var(--app-success, #22c55e)`
- Warning: `var(--app-warning, #f59e0b)`
- Error: `var(--app-error, #ef4444)`
- Purple: `#8b5cf6`

## Versioning

Increment `version` to re-trigger for users who completed it.

## Checklist

- [ ] ID: `{module}-{page}` convention
- [ ] Welcome (step 0) + completion (last step) exist
- [ ] All `data-tour` attributes in JSX
- [ ] `stepActions` indexes match step index comment
- [ ] Side-effect import in component
- [ ] `<GuidedTour>` at root level (not inside conditionals)
- [ ] `<TourTriggerButton>` in header
- [ ] Descriptions explain interaction model
- [ ] Build passes
