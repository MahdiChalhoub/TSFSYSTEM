# Anti-Overlap Layout System - Complete Guide

## 🎯 Problem Solved

**Before:** Text and components overlapping due to fragile positioning, fixed heights, and hardcoded spacing.

**After:** Dynamic, flow-based layouts that adapt to content and never overlap.

---

## 📚 Table of Contents

1. [Core Principles](#core-principles)
2. [Spacing System](#spacing-system)
3. [Layout Primitives](#layout-primitives)
4. [Text Safety](#text-safety)
5. [Component Patterns](#component-patterns)
6. [Migration Guide](#migration-guide)
7. [Examples](#examples)

---

## Core Principles

### 1. Flow-Based Over Absolute

❌ **BAD:**
```tsx
<div style={{ position: 'absolute', top: '20px', left: '100px' }}>
  <h1>Title</h1>
  <span className="badge">New</span>
</div>
```

✅ **GOOD:**
```tsx
<div className="row-3">
  <h1 className="text-truncate flex-grow">Title</h1>
  <Badge>New</Badge>
</div>
```

### 2. Gap Over Margin

❌ **BAD:**
```css
.item { margin-right: 16px; }
.item:last-child { margin-right: 0; }
```

✅ **GOOD:**
```css
.container { display: flex; gap: 1rem; }
```

### 3. Min-Width: 0 for Flex Children

❌ **BAD:**
```tsx
<div className="flex">
  <span>{veryLongText}</span> {/* Overflows! */}
</div>
```

✅ **GOOD:**
```tsx
<div className="flex">
  <span className="text-truncate">{veryLongText}</span>
</div>
```

---

## Spacing System

### Unified Scale (4px increments)

| Variable | Value | Pixels | Use Case |
|----------|-------|--------|----------|
| `--space-1` | 0.25rem | 4px | Tight spacing, icon gaps |
| `--space-2` | 0.5rem | 8px | Small gaps, compact layouts |
| `--space-3` | 0.75rem | 12px | Default gaps between items |
| `--space-4` | 1rem | 16px | Standard spacing |
| `--space-5` | 1.25rem | 20px | Medium spacing |
| `--space-6` | 1.5rem | 24px | Large spacing, section padding |
| `--space-8` | 2rem | 32px | Section spacing |
| `--space-10` | 2.5rem | 40px | Large sections |
| `--space-12` | 3rem | 48px | Extra large sections |
| `--space-16` | 4rem | 64px | Empty states |

### Usage

```tsx
// React components
<Stack spacing={4}>  {/* 16px gap */}
  <div>Item 1</div>
  <div>Item 2</div>
</Stack>

// CSS classes
<div className="stack stack-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

// Direct CSS
.custom-container {
  padding: var(--space-6);
  gap: var(--space-4);
}
```

---

## Layout Primitives

### PageShell

Main application container.

```tsx
import { PageShell, PageHeader, PageContent } from '@/components/layout'

function MyPage() {
  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your system"
        actions={<Button>New Item</Button>}
      />
      <PageContent>
        {/* Your content */}
      </PageContent>
    </PageShell>
  )
}
```

### Stack (Vertical Layout)

```tsx
<Stack spacing={4}>
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</Stack>
```

Spacing options: `1, 2, 3, 4, 5, 6, 8`

### Row (Horizontal Layout)

```tsx
// Basic row
<Row spacing={3}>
  <button>Action 1</button>
  <button>Action 2</button>
</Row>

// Row that wraps
<Row spacing={3} wrap>
  <button>Action 1</button>
  <button>Action 2</button>
  <button>Action 3</button>
</Row>

// Responsive row (column on mobile)
<Row spacing={4} responsive>
  <div>Left content</div>
  <div>Right content</div>
</Row>
```

### Section

```tsx
<Section
  title="Recent Activity"
  actions={<Button>View All</Button>}
>
  {/* Section content */}
</Section>
```

### Card

```tsx
<Card
  title="Statistics"
  actions={
    <>
      <button>Edit</button>
      <button>Delete</button>
    </>
  }
>
  <p>Card content here</p>
</Card>
```

### SidebarItem

```tsx
<SidebarItem
  icon={<HomeIcon />}
  label="Dashboard"
  badge={5}
  chevron
  active
  onClick={() => navigate('/dashboard')}
/>
```

### Toolbar

```tsx
<Toolbar
  left={
    <>
      <button>New</button>
      <button>Edit</button>
      <button>Delete</button>
    </>
  }
  right={
    <>
      <input placeholder="Search..." />
      <button>Filter</button>
    </>
  }
/>
```

### Tabs

```tsx
<Tabs>
  <Tab active onClick={() => setTab('overview')}>
    Overview
  </Tab>
  <Tab onClick={() => setTab('details')}>
    Details
  </Tab>
  <Tab onClick={() => setTab('settings')}>
    Settings
  </Tab>
</Tabs>
```

### Empty State

```tsx
<EmptyState
  icon={<InboxIcon />}
  title="No items found"
  description="Get started by creating your first item"
  action={<Button>Create Item</Button>}
/>
```

### Step Header (Wizards)

```tsx
<StepHeader
  number={1}
  title="Choose Template"
  description="Select a template to get started"
  status="current"
/>
```

### Badge

```tsx
<Badge variant="primary">New</Badge>
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Failed</Badge>
```

### Status Indicator

```tsx
<StatusIndicator status="online" label="System Online" />
<StatusIndicator status="offline" label="System Offline" />
<StatusIndicator status="busy" label="Processing" />
<StatusIndicator status="away" label="Idle" />
```

---

## Text Safety

### Problem: Text Overflow in Flex

```tsx
❌ BAD:
<div className="flex">
  <h1>{veryLongTitle}</h1>  {/* Overflows container! */}
</div>

✅ GOOD:
<div className="flex">
  <h1 className="text-truncate flex-grow">{veryLongTitle}</h1>
</div>
```

### Text Safety Classes

| Class | Behavior | Use Case |
|-------|----------|----------|
| `text-safe` | `min-width: 0` | Prevent flex overflow |
| `text-truncate` | Ellipsis on one line | Sidebar items, table cells |
| `text-wrap` | Allow wrapping | Long descriptions |
| `line-clamp-1` | Truncate to 1 line | Titles |
| `line-clamp-2` | Truncate to 2 lines | Descriptions |
| `line-clamp-3` | Truncate to 3 lines | Longer content |

### Examples

```tsx
// Sidebar item with safe text
<div className="sidebar-item">
  <Icon />
  <span className="sidebar-item-label text-truncate">
    Very Long Navigation Item Name
  </span>
  <Badge>5</Badge>
</div>

// Card title with truncation
<div className="card-header">
  <h3 className="card-title text-truncate flex-grow">
    Very Long Card Title That Should Not Overlap Actions
  </h3>
  <button>Edit</button>
</div>

// Description with line clamp
<p className="line-clamp-3">
  This is a very long description that will be truncated
  to exactly 3 lines with an ellipsis at the end...
</p>
```

---

## Component Patterns

### Sidebar Navigation

#### Problem
Labels, badges, and chevrons overlapping in sidebar.

#### Solution

```tsx
// ❌ OLD (Causes overlap)
<div className="flex items-center">
  <HomeIcon />
  <span>Dashboard</span>
  <span className="ml-auto">5</span>
  <ChevronRight />
</div>

// ✅ NEW (Safe)
<SidebarItem
  icon={<HomeIcon />}
  label="Dashboard"
  badge={5}
  chevron
  onClick={() => navigate('/dashboard')}
/>

// Or using CSS classes:
<div className="sidebar-item">
  <span className="sidebar-item-icon"><HomeIcon /></span>
  <span className="sidebar-item-label">Dashboard</span>
  <span className="sidebar-item-badge">5</span>
  <span className="sidebar-item-chevron">→</span>
</div>
```

### Page Header with Actions

#### Problem
Title overlapping action buttons on narrow screens.

#### Solution

```tsx
// ❌ OLD (Causes overlap)
<div className="flex justify-between">
  <h1>Very Long Page Title That Might Overlap</h1>
  <button>Action</button>
</div>

// ✅ NEW (Safe)
<PageHeader
  title="Very Long Page Title That Might Overlap"
  actions={<button>Action</button>}
/>

// Or using CSS classes:
<div className="page-header">
  <div className="page-header-row">
    <h1 className="page-header-title text-truncate">
      Very Long Page Title
    </h1>
    <div className="page-header-actions">
      <button>Action 1</button>
      <button>Action 2</button>
    </div>
  </div>
</div>
```

### Card with Title and Actions

#### Problem
Long card titles pushing action buttons off screen.

#### Solution

```tsx
// ❌ OLD (Causes overlap)
<div className="card">
  <div className="flex justify-between">
    <h3>Very Long Card Title</h3>
    <button>Edit</button>
  </div>
  <div className="content">...</div>
</div>

// ✅ NEW (Safe)
<Card
  title="Very Long Card Title"
  actions={<button>Edit</button>}
>
  <div>Card content</div>
</Card>

// Or using CSS classes:
<div className="card-safe">
  <div className="card-header">
    <h3 className="card-title text-truncate">
      Very Long Card Title
    </h3>
    <div className="card-actions">
      <button>Edit</button>
    </div>
  </div>
  <div className="card-body">
    Card content
  </div>
</div>
```

### Toolbar with Search and Actions

#### Problem
Search input and buttons overlapping on mobile.

#### Solution

```tsx
// ❌ OLD (Causes overlap)
<div className="flex">
  <button>New</button>
  <button>Edit</button>
  <input placeholder="Search..." />
  <button>Filter</button>
</div>

// ✅ NEW (Safe - wraps on mobile)
<Toolbar
  left={
    <>
      <button>New</button>
      <button>Edit</button>
    </>
  }
  right={
    <>
      <input placeholder="Search..." />
      <button>Filter</button>
    </>
  }
/>
```

### Wizard Steps

#### Problem
Step numbers, titles, and descriptions overlapping.

#### Solution

```tsx
// ❌ OLD (Causes overlap)
<div className="flex">
  <div className="step-number">1</div>
  <div>
    <h3>Step Title</h3>
    <p>Description</p>
  </div>
</div>

// ✅ NEW (Safe)
<StepHeader
  number={1}
  title="Choose Template"
  description="Select a template to get started quickly"
  status="current"
/>
```

### Empty States

#### Problem
Icon, title, description, and action button not properly aligned.

#### Solution

```tsx
// ❌ OLD (Inconsistent)
<div className="text-center">
  <Icon />
  <h3>No items</h3>
  <p>Description</p>
  <button>Action</button>
</div>

// ✅ NEW (Safe, consistent spacing)
<EmptyState
  icon={<InboxIcon />}
  title="No items found"
  description="Get started by creating your first item"
  action={<Button>Create Item</Button>}
/>
```

---

## Migration Guide

### Step 1: Identify Overlap Issues

Look for:
- `position: absolute` (unless decorative)
- `position: fixed` (unless modals/toasts)
- Fixed `height` values
- Hardcoded `top`, `left`, `right`, `bottom`
- Negative margins
- Uncontrolled `z-index`
- Long text without `text-truncate`
- Flex containers without `min-width: 0` on children

### Step 2: Replace Fragile Patterns

| Old Pattern | New Pattern |
|-------------|-------------|
| `<div className="flex justify-between">` | `<div className="row-3">` or `<Row spacing={3}>` |
| `<div className="grid grid-cols-3">` | `<div className="grid grid-cols-3 gap-4">` |
| Manual margin spacing | Use `gap` and spacing classes |
| Fixed heights | Use `min-height` and let content flow |
| Long text in flex | Add `text-truncate` or `line-clamp-N` |

### Step 3: Adopt Layout Primitives

```tsx
// Before
function MyPage() {
  return (
    <div>
      <div className="flex justify-between p-6">
        <h1>Title</h1>
        <button>Action</button>
      </div>
      <div className="p-6">
        {content}
      </div>
    </div>
  )
}

// After
import { PageShell, PageHeader, PageContent } from '@/components/layout'

function MyPage() {
  return (
    <PageShell>
      <PageHeader
        title="Title"
        actions={<button>Action</button>}
      />
      <PageContent>
        {content}
      </PageContent>
    </PageShell>
  )
}
```

### Step 4: Fix Sidebar Items

```tsx
// Before
<div className="flex items-center gap-3">
  <Icon />
  <span>Label</span>
  <span className="ml-auto">Badge</span>
</div>

// After
<SidebarItem
  icon={<Icon />}
  label="Label"
  badge="Badge"
/>
```

### Step 5: Fix Page Headers

```tsx
// Before
<div className="flex justify-between items-center">
  <h1>{title}</h1>
  <button>Action</button>
</div>

// After
<PageHeader
  title={title}
  actions={<button>Action</button>}
/>
```

### Step 6: Fix Cards

```tsx
// Before
<div className="card">
  <div className="flex justify-between">
    <h3>{title}</h3>
    <button>Edit</button>
  </div>
  {content}
</div>

// After
<Card title={title} actions={<button>Edit</button>}>
  {content}
</Card>
```

### Step 7: Add Text Safety

Add to any text in flex containers:

```tsx
<span className="text-truncate">{longText}</span>
<p className="line-clamp-2">{description}</p>
```

### Step 8: Test Responsive Behavior

```tsx
// Use responsive utilities
<div className="row-responsive"> {/* Column on mobile */}
  <div>Left</div>
  <div>Right</div>
</div>

<div className="hide-mobile">Desktop only</div>
<div className="hide-desktop">Mobile only</div>
```

---

## Examples

### Complete Page Example

```tsx
import {
  PageShell,
  PageHeader,
  PageContent,
  Section,
  Card,
  Row,
  Stack,
  Toolbar,
  EmptyState
} from '@/components/layout'

export default function DashboardPage() {
  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your system"
        breadcrumbs={
          <span>Home / Dashboard</span>
        }
        actions={
          <Row spacing={2}>
            <button>Export</button>
            <button>Settings</button>
          </Row>
        }
      />

      <PageContent>
        <Stack spacing={8}>
          {/* Toolbar */}
          <Toolbar
            left={
              <Row spacing={3}>
                <button>New Item</button>
                <button>Import</button>
              </Row>
            }
            right={
              <Row spacing={3}>
                <input placeholder="Search..." />
                <button>Filter</button>
              </Row>
            }
          />

          {/* Statistics Cards */}
          <Section title="Statistics">
            <div className="grid grid-cols-3 gap-6">
              <Card title="Total Users" actions={<button>View</button>}>
                <div className="text-3xl font-bold">1,234</div>
              </Card>
              <Card title="Revenue" actions={<button>View</button>}>
                <div className="text-3xl font-bold">$56,789</div>
              </Card>
              <Card title="Orders" actions={<button>View</button>}>
                <div className="text-3xl font-bold">432</div>
              </Card>
            </div>
          </Section>

          {/* Recent Activity */}
          <Section
            title="Recent Activity"
            actions={<button>View All</button>}
          >
            {hasActivity ? (
              <Stack spacing={4}>
                {/* Activity items */}
              </Stack>
            ) : (
              <EmptyState
                title="No recent activity"
                description="Activity will appear here once you start using the system"
                action={<button>Get Started</button>}
              />
            )}
          </Section>
        </Stack>
      </PageContent>
    </PageShell>
  )
}
```

### Complete Sidebar Example

```tsx
import { SidebarItem, Stack } from '@/components/layout'
import { HomeIcon, SettingsIcon, UsersIcon } from 'lucide-react'

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn('sidebar', collapsed && 'sidebar-collapsed')}>
      <Stack spacing={1}>
        <SidebarItem
          icon={<HomeIcon />}
          label="Dashboard"
          active
          onClick={() => navigate('/dashboard')}
        />
        <SidebarItem
          icon={<UsersIcon />}
          label="Users"
          badge={5}
          onClick={() => navigate('/users')}
        />
        <SidebarItem
          icon={<SettingsIcon />}
          label="Settings"
          chevron
          onClick={() => toggleSettings()}
        />
      </Stack>
    </div>
  )
}
```

---

## CSS-Only Usage

If you prefer CSS classes over React components:

```html
<!-- Page Structure -->
<div class="page-shell">
  <div class="page-header">
    <div class="page-header-row">
      <h1 class="page-header-title text-truncate">Title</h1>
      <div class="page-header-actions">
        <button>Action</button>
      </div>
    </div>
  </div>

  <div class="page-content">
    <!-- Content -->
  </div>
</div>

<!-- Card -->
<div class="card-safe">
  <div class="card-header">
    <h3 class="card-title text-truncate">Card Title</h3>
    <div class="card-actions">
      <button>Edit</button>
    </div>
  </div>
  <div class="card-body">
    Card content
  </div>
</div>

<!-- Row with spacing -->
<div class="row row-4">
  <button>Action 1</button>
  <button>Action 2</button>
</div>

<!-- Stack with spacing -->
<div class="stack stack-6">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

---

## Before/After Comparison

### Sidebar Item

**Before (Overlapping):**
```tsx
<div className="flex items-center gap-2 p-2">
  <HomeIcon />
  <span>Very Long Navigation Label</span>
  <span className="ml-auto bg-blue-500 px-2 rounded">5</span>
  <ChevronRight />
</div>
```
**Problem:** Badge covers label on narrow sidebars.

**After (Safe):**
```tsx
<SidebarItem
  icon={<HomeIcon />}
  label="Very Long Navigation Label"
  badge={5}
  chevron
/>
```
**Result:** Label truncates with ellipsis, badge never overlaps.

### Page Header

**Before (Overlapping):**
```tsx
<div className="flex justify-between items-center p-6">
  <h1 className="text-2xl">
    Very Long Page Title That Extends Beyond Container
  </h1>
  <div className="flex gap-2">
    <button>Edit</button>
    <button>Delete</button>
  </div>
</div>
```
**Problem:** Title pushes buttons off screen on mobile.

**After (Safe):**
```tsx
<PageHeader
  title="Very Long Page Title That Extends Beyond Container"
  actions={
    <>
      <button>Edit</button>
      <button>Delete</button>
    </>
  }
/>
```
**Result:** Title truncates, actions wrap to new row on mobile.

---

## Summary of Fixes

### What Was Fixed

1. **Spacing:** Unified 4px-increment scale with CSS variables
2. **Layout:** Flow-based primitives (Stack, Row, Section, etc.)
3. **Text Safety:** Truncation, wrapping, line-clamping utilities
4. **Sidebar:** Safe item component with icon/label/badge/chevron
5. **Headers:** Page headers that wrap actions responsively
6. **Cards:** Card headers that prevent title/action overlap
7. **Toolbars:** Horizontal bars that wrap gracefully
8. **Tabs:** Tab bars that scroll/wrap without breaking
9. **Empty States:** Centered, consistent empty state layout
10. **Wizards:** Step headers with safe content flow

### Files Created

1. `/src/styles/layout-system.css` - Complete CSS framework
2. `/src/components/layout/index.tsx` - React component primitives
3. `/LAYOUT_SYSTEM_GUIDE.md` - This comprehensive guide

### Global Changes

1. Imported layout system in `globals.css`
2. Available throughout entire application
3. Works with existing Tailwind classes
4. No breaking changes to existing code

---

## Next Steps

1. **Start with new components:** Use layout primitives in all new code
2. **Gradual migration:** Refactor existing components as you touch them
3. **Prioritize visible issues:** Fix overlap issues in main navigation first
4. **Test responsive:** Check mobile/tablet breakpoints
5. **Document patterns:** Add team-specific patterns to this guide

---

## Support

**Layout system files:**
- CSS: `/src/styles/layout-system.css`
- Components: `/src/components/layout/index.tsx`
- Guide: `/LAYOUT_SYSTEM_GUIDE.md`

**Questions?**
This is a living document. Add examples and patterns as you discover them!
