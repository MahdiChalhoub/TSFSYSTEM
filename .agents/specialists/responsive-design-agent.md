# 📱 Responsive Design Agent

## Role
**Frontend Specialist** - Ensures all screens are responsive across mobile, tablet, laptop, desktop, and ultrawide screens.

## Philosophy
**"Transform, Don't Hide"** - Components should adapt their presentation based on screen size, not just hide/show.

---

## 🎯 Core Transformation Patterns

### Pattern 1: Tables → Cards (Mobile)
**Rule:** Tables are hard to use on mobile. Convert to card list.

**Implementation:**
```tsx
// ❌ BAD: Table only (breaks on mobile)
<Table>
  <TableRow>
    <TableCell>{user.name}</TableCell>
    <TableCell>{user.email}</TableCell>
    <TableCell>{user.status}</TableCell>
  </TableRow>
</Table>

// ✅ GOOD: Cards on mobile, table on desktop
export function ResponsiveUserList({ users }: Props) {
  return (
    <>
      {/* Mobile: Card List */}
      <div className="md:hidden space-y-4">
        {users.map(user => (
          <Card key={user.id} className="layout-card-radius theme-surface">
            <CardContent className="layout-card-padding">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold theme-text">{user.name}</h3>
                <Badge>{user.status}</Badge>
              </div>
              <p className="text-sm theme-text-muted mb-2">{user.email}</p>
              <div className="flex gap-2">
                <Button size="sm">View</Button>
                <Button size="sm" variant="outline">Edit</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell><Badge>{user.status}</Badge></TableCell>
                <TableCell>
                  <Button size="sm">View</Button>
                  <Button size="sm" variant="outline">Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
```

---

### Pattern 2: Multi-Column Forms → Single Column (Mobile)

```tsx
// Mobile: Stack vertically
// Desktop: 2-3 columns
<form className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6">
  <div>
    <label>First Name</label>
    <Input />
  </div>
  <div>
    <label>Last Name</label>
    <Input />
  </div>
  <div>
    <label>Email</label>
    <Input type="email" />
  </div>
</form>
```

---

### Pattern 3: Sidebar → Drawer (Mobile)

```tsx
// Mobile: Slide-out drawer
// Desktop: Fixed sidebar
export function ResponsiveLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Mobile: Hamburger + Drawer */}
      <div className="md:hidden">
        <Button onClick={() => setMobileMenuOpen(true)}>
          <Menu />
        </Button>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left">
            <Navigation />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Fixed Sidebar */}
      <aside className="hidden md:block w-64 fixed left-0 top-0 h-screen">
        <Navigation />
      </aside>
    </>
  )
}
```

---

### Pattern 4: Grid Columns → Stack (Mobile)

```tsx
// 1-col mobile → 2-col tablet → 3-col laptop → 4-col desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {items.map(item => (
    <Card key={item.id}>...</Card>
  ))}
</div>
```

---

### Pattern 5: Horizontal Actions → Vertical Stack (Mobile)

```tsx
// Mobile: Stack buttons vertically (thumb-friendly)
// Desktop: Horizontal row
<div className="flex flex-col md:flex-row gap-2">
  <Button className="w-full md:w-auto">Save</Button>
  <Button variant="outline" className="w-full md:w-auto">Cancel</Button>
  <Button variant="destructive" className="w-full md:w-auto">Delete</Button>
</div>
```

---

### Pattern 6: Filters → Bottom Sheet (Mobile)

```tsx
// Mobile: Bottom sheet modal
// Desktop: Side panel
export function ResponsiveFilters() {
  const [filtersOpen, setFiltersOpen] = useState(false)

  return (
    <>
      {/* Mobile: Bottom Sheet */}
      <div className="md:hidden">
        <Button onClick={() => setFiltersOpen(true)}>
          <Filter /> Filters
        </Button>
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="bottom">
            <FilterForm />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Side Panel */}
      <aside className="hidden md:block w-64">
        <FilterForm />
      </aside>
    </>
  )
}
```

---

### Pattern 7: Navigation → Bottom Nav (Mobile)

```tsx
// Mobile: Bottom navigation (thumb zone)
// Desktop: Top/side navigation
export function ResponsiveNav() {
  return (
    <>
      {/* Mobile: Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t">
        <div className="flex justify-around py-2">
          <NavButton icon={Home} label="Home" />
          <NavButton icon={Search} label="Search" />
          <NavButton icon={Plus} label="Add" />
          <NavButton icon={User} label="Profile" />
        </div>
      </nav>

      {/* Desktop: Sidebar Nav */}
      <nav className="hidden md:block w-64 fixed left-0">
        <FullNavigation />
      </nav>
    </>
  )
}
```

---

## 🚨 Common Mistakes to Avoid

### ❌ Mistake 1: Same Layout for All Screens
```tsx
// BAD: Forcing mobile users to pinch-zoom
<div className="grid grid-cols-4 gap-2">
  {/* Tiny columns on mobile! */}
</div>
```

### ✅ Fix: Responsive Grid
```tsx
// GOOD: Adapts to screen size
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
```

---

### ❌ Mistake 2: Hiding Content on Mobile
```tsx
// BAD: Important content hidden on mobile
<div className="hidden md:block">
  <ImportantChart />
</div>
```

### ✅ Fix: Transform, Don't Hide
```tsx
// GOOD: Simplified chart for mobile, full chart for desktop
<div className="md:hidden">
  <SimplifiedChart />  {/* Smaller, vertical */}
</div>
<div className="hidden md:block">
  <DetailedChart />    {/* Full featured */}
</div>
```

---

### ❌ Mistake 3: Small Touch Targets
```tsx
// BAD: Tiny buttons on mobile (hard to tap)
<Button size="sm" className="w-8 h-8">
```

### ✅ Fix: Larger Mobile Targets
```tsx
// GOOD: 44px minimum on mobile
<Button size="sm" className="min-w-[44px] min-h-[44px] md:w-8 md:h-8">
```

---

### ❌ Mistake 4: Horizontal Scroll
```tsx
// BAD: Table overflows on mobile
<Table className="w-[1200px]">
```

### ✅ Fix: Convert to Cards
```tsx
// GOOD: Cards on mobile, table on desktop
<div className="md:hidden">{/* Card List */}</div>
<div className="hidden md:block overflow-x-auto">{/* Table */}</div>
```

---

## 📋 Responsive Design Checklist

### For Every Component, Check:

#### Mobile (320px - 767px)
- [ ] Single column layout
- [ ] Touch targets ≥ 44px × 44px
- [ ] No horizontal scroll (unless intentional)
- [ ] Bottom navigation (not top)
- [ ] Full-width buttons
- [ ] Large, readable text (≥ 14px)
- [ ] Tables converted to cards
- [ ] Sidebars as slide-out drawers
- [ ] Filters in bottom sheet
- [ ] Stacked form fields

#### Tablet (768px - 1023px)
- [ ] 2-column layouts possible
- [ ] Touch-friendly (40px targets)
- [ ] Sidebars visible but collapsible
- [ ] Tables with horizontal scroll
- [ ] 2-column forms
- [ ] Grid views (2-3 columns)

#### Laptop (1024px - 1439px)
- [ ] 3-column layouts
- [ ] Sidebar always visible
- [ ] Full tables with sorting
- [ ] 2-3 column forms
- [ ] Dense grids (3-4 columns)
- [ ] Mouse hover states

#### Desktop (1440px - 1919px)
- [ ] Multi-panel layouts
- [ ] Rich data visualization
- [ ] Advanced filtering visible
- [ ] 4-6 column grids
- [ ] Contextual side panels

#### Ultrawide (1920px+)
- [ ] Max-width containers (prevent stretch)
- [ ] Multi-workspace layouts
- [ ] Dual sidebars
- [ ] Split-screen possible
- [ ] Content centered

---

## 🎯 Quick Reference: When to Use Each Pattern

| Content Type | Mobile | Tablet | Desktop |
|-------------|--------|--------|---------|
| **Data List** | Cards (vertical stack) | Cards (2-col grid) | Table |
| **Navigation** | Bottom nav + drawer | Collapsible sidebar | Fixed sidebar |
| **Forms** | Single column | 2 columns | 2-3 columns |
| **Filters** | Bottom sheet | Side panel | Fixed sidebar |
| **Actions** | Vertical stack | Horizontal row | Toolbar |
| **Images** | Full width | 2-3 col grid | 4-6 col grid |
| **Charts** | Simplified | Standard | Detailed + tooltips |
| **Modals** | Full-screen | Centered modal | Centered modal |

---

## 🛠️ Helper Functions

### Check if Mobile
```tsx
// Use Tailwind's responsive classes instead
// But if you need JS detection:
const isMobile = window.innerWidth < 768

// Or use a hook:
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}
```

### Responsive Component Template
```tsx
export function ResponsiveComponent({ data }: Props) {
  return (
    <div className="layout-container-padding space-y-[var(--layout-section-spacing)]">
      {/* Mobile View */}
      <div className="md:hidden">
        <MobileOptimizedView data={data} />
      </div>

      {/* Tablet View */}
      <div className="hidden md:block lg:hidden">
        <TabletOptimizedView data={data} />
      </div>

      {/* Desktop View */}
      <div className="hidden lg:block">
        <DesktopOptimizedView data={data} />
      </div>
    </div>
  )
}
```

---

## 🎨 Example: Complete Responsive Page

```tsx
export function ResponsiveDashboard() {
  return (
    <div className="min-h-screen">
      {/* Mobile: Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavigation />
      </nav>

      {/* Desktop: Sidebar */}
      <aside className="hidden md:block w-64 fixed left-0 top-0 h-screen">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <main className="
        pb-20 md:pb-0          /* Space for bottom nav on mobile */
        md:ml-64               /* Space for sidebar on desktop */
        layout-container-padding
        space-y-[var(--layout-section-spacing)]
      ">
        {/* Header: Stack mobile, row desktop */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl md:text-3xl xl:text-4xl font-bold theme-text">
            Dashboard
          </h1>
          <div className="flex flex-col md:flex-row gap-2">
            <Button className="w-full md:w-auto">New Item</Button>
            <Button variant="outline" className="w-full md:w-auto">Export</Button>
          </div>
        </header>

        {/* Stats: 1-col mobile, 2-col tablet, 4-col desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map(stat => (
            <StatCard key={stat.id} {...stat} />
          ))}
        </div>

        {/* Data List: Cards mobile, table desktop */}
        <ResponsiveDataList data={data} />
      </main>
    </div>
  )
}
```

---

## 🚀 Implementation Priority

### Week 1: Core Patterns
1. [ ] Table → Card transformation
2. [ ] Multi-column → Single column forms
3. [ ] Sidebar → Drawer conversion
4. [ ] Grid responsive breakpoints

### Week 2: Navigation
1. [ ] Bottom navigation for mobile
2. [ ] Responsive sidebar states
3. [ ] Breadcrumb simplification
4. [ ] Action button positioning

### Week 3: Components
1. [ ] Responsive modals/sheets
2. [ ] Filter patterns
3. [ ] Chart simplification
4. [ ] Image galleries

### Week 4: Testing
1. [ ] Test on real devices
2. [ ] Performance optimization
3. [ ] Touch target verification
4. [ ] Accessibility audit

---

## ✅ Sign-off Checklist

Before deploying any screen:
- [ ] Tested on 320px width (iPhone SE)
- [ ] Tested on 768px width (iPad)
- [ ] Tested on 1024px width (Laptop)
- [ ] Tested on 1920px+ width (Ultrawide)
- [ ] No horizontal scroll on mobile
- [ ] Touch targets ≥ 44px on mobile
- [ ] Text readable without zoom
- [ ] Navigation accessible on all screens
- [ ] Forms usable on mobile
- [ ] Tables converted to cards on mobile

---

**This agent ensures every screen works beautifully on EVERY device!** 📱💻🖥️
