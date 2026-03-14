# Layout System - Quick Reference Card

## 🎯 One-Page Cheat Sheet

---

## Spacing Scale

```
--space-1:  4px    --space-6:  24px
--space-2:  8px    --space-8:  32px
--space-3:  12px   --space-10: 40px
--space-4:  16px   --space-12: 48px
--space-5:  20px   --space-16: 64px
```

---

## Text Safety

```tsx
<span className="text-truncate">...</span>     // Ellipsis
<p className="line-clamp-2">...</p>           // 2 lines max
<div className="text-wrap">...</div>          // Wrapping
<div className="flex-item-safe">...</div>     // Flex safe
```

---

## Layout Primitives

### Stack (Vertical)
```tsx
<Stack spacing={4}>  // 16px gaps
  <div>Item 1</div>
  <div>Item 2</div>
</Stack>
```

### Row (Horizontal)
```tsx
<Row spacing={3}>    // 12px gaps
  <button>A</button>
  <button>B</button>
</Row>

<Row spacing={4} wrap>...</Row>        // Wraps
<Row spacing={4} responsive>...</Row>  // Column on mobile
```

---

## Page Structure

```tsx
<PageShell>
  <PageHeader
    title="Page Title"
    subtitle="Optional subtitle"
    actions={<button>Action</button>}
    breadcrumbs={<span>Home / Page</span>}
  />
  <PageContent>
    <Section title="Section" actions={<button>More</button>}>
      {content}
    </Section>
  </PageContent>
</PageShell>
```

---

## Components

### Card
```tsx
<Card
  title="Card Title"
  actions={<button>Edit</button>}
>
  Content
</Card>
```

### Sidebar Item
```tsx
<SidebarItem
  icon={<Icon />}
  label="Label"
  badge={5}
  chevron
  active
  onClick={() => {}}
/>
```

### Toolbar
```tsx
<Toolbar
  left={<>Actions</>}
  right={<>Search & Filter</>}
/>
```

### Tabs
```tsx
<Tabs>
  <Tab active>Overview</Tab>
  <Tab>Details</Tab>
  <Tab>Settings</Tab>
</Tabs>
```

### Empty State
```tsx
<EmptyState
  icon={<Icon />}
  title="No items"
  description="Description text"
  action={<button>Create</button>}
/>
```

### Badge
```tsx
<Badge variant="primary">New</Badge>
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Failed</Badge>
```

---

## Common Patterns

### Sidebar Item with Everything
```tsx
<div className="sidebar-item">
  <span className="sidebar-item-icon">🏠</span>
  <span className="sidebar-item-label">Label</span>
  <span className="sidebar-item-badge">5</span>
  <span className="sidebar-item-chevron">→</span>
</div>
```

### Page Header
```tsx
<div className="page-header">
  <div className="page-header-row">
    <h1 className="page-header-title text-truncate">Title</h1>
    <div className="page-header-actions">
      <button>Action</button>
    </div>
  </div>
</div>
```

### Card with Header
```tsx
<div className="card-safe">
  <div className="card-header">
    <h3 className="card-title text-truncate">Title</h3>
    <div className="card-actions">
      <button>Edit</button>
    </div>
  </div>
  <div className="card-body">Content</div>
</div>
```

---

## CSS Classes

### Layout
- `stack` `stack-1` through `stack-8` - Vertical with gap
- `row` `row-1` through `row-6` - Horizontal with gap
- `row-wrap` - Wrapping row
- `row-responsive` - Column on mobile
- `grid` `grid-cols-2/3/4` - Grid layouts

### Text
- `text-safe` - Prevent flex overflow
- `text-truncate` - Single line ellipsis
- `text-wrap` - Allow wrapping
- `line-clamp-1/2/3` - Multi-line ellipsis

### Flex
- `flex-grow` - Grow to fill
- `flex-no-shrink` - Don't shrink
- `flex-item-safe` - Safe flex child

### Responsive
- `hide-mobile` - Hidden on <768px
- `hide-desktop` - Hidden on >768px
- `stack-mobile` - Column on mobile

---

## Migration Shortcuts

### Replace Flex Justify-Between
```tsx
// Before
<div className="flex justify-between">
  <span>Left</span>
  <button>Right</button>
</div>

// After
<Row spacing={3}>
  <span className="flex-grow">Left</span>
  <button>Right</button>
</Row>
```

### Replace Manual Spacing
```tsx
// Before
<div className="space-y-4">
  <div>A</div>
  <div>B</div>
</div>

// After
<Stack spacing={4}>
  <div>A</div>
  <div>B</div>
</Stack>
```

### Replace Long Text in Flex
```tsx
// Before
<div className="flex">
  <span>{longText}</span>
</div>

// After
<div className="flex">
  <span className="text-truncate">{longText}</span>
</div>
```

---

## Z-Index Layers

```
--z-base: 0        // Normal content
--z-dropdown: 100  // Dropdowns
--z-sticky: 200    // Sticky headers
--z-overlay: 300   // Modal overlays
--z-modal: 400     // Modal dialogs
--z-toast: 500     // Toasts/notifications
```

---

## Complete Example

```tsx
import {
  PageShell,
  PageHeader,
  PageContent,
  Section,
  Card,
  Stack,
  Row,
  Toolbar,
  Badge,
  EmptyState
} from '@/components/layout'

export default function Page() {
  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        actions={<Button>New</Button>}
      />

      <PageContent>
        <Stack spacing={8}>
          <Toolbar
            left={<Row spacing={2}>
              <button>Edit</button>
              <button>Delete</button>
            </Row>}
            right={<input placeholder="Search..." />}
          />

          <Section title="Cards">
            <div className="grid grid-cols-3 gap-6">
              <Card title="Stats" actions={<button>View</button>}>
                <div className="text-3xl">1,234</div>
              </Card>
            </div>
          </Section>

          <Section
            title="Activity"
            actions={<button>View All</button>}
          >
            {hasData ? (
              <Stack spacing={4}>...</Stack>
            ) : (
              <EmptyState
                title="No activity"
                description="Get started"
                action={<button>Create</button>}
              />
            )}
          </Section>
        </Stack>
      </PageContent>
    </PageShell>
  )
}
```

---

## 🚨 Remember

1. ✅ Use `gap` not `margin`
2. ✅ Add `min-width: 0` to flex text
3. ✅ Use primitives not custom layouts
4. ✅ Let content flow naturally
5. ✅ Test with long text
6. ✅ Test on mobile
7. ❌ Avoid `position: absolute`
8. ❌ Avoid fixed heights
9. ❌ Avoid hardcoded offsets
10. ❌ Avoid manual spacing

---

## 📚 Full Docs

- `/LAYOUT_SYSTEM_GUIDE.md` - Complete guide
- `/src/styles/layout-system.css` - CSS source
- `/src/components/layout/index.tsx` - Components

---

**Print this page and keep it at your desk!** 📄
