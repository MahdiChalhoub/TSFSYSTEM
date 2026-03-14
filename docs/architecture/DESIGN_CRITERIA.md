# TSFSYSTEM — Uniform Design Criteria

A mandatory reference for all agents and developers. Every page, component, and backend endpoint **must** follow these rules to maintain a consistent, premium experience across the entire platform.

---

## 1. Visual Identity

| Token | Value |
|-------|-------|
| **Font** | `Outfit` (via `globals.css --font-sans`) |
| **Primary** | Emerald `#10B981` |
| **Secondary** | Slate-900 `#0F172A` |
| **Accent** | Amber `#F59E0B` |
| **Background** | Slate-50 `#F8FAFC` with subtle radial gradient |
| **Surface** | `#FFFFFF` |
| **Border Radius** | `0.625rem` base (`--radius`) |
| **Shadows** | Use `shadow-sm` for cards, `shadow-lg shadow-{color}-200` for icon badges |

> [!IMPORTANT]
> Never hardcode one-off colors. Use the theme variables defined in [globals.css](file:///root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/globals.css).

---

## 2. Page Header — The Standard

**Every list/module page** must use this exact header pattern:

```tsx
<header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
  <div>
    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
      <div className="w-14 h-14 rounded-[1.5rem] bg-{accent}-600 flex items-center justify-center shadow-lg shadow-{accent}-200">
        <Icon size={28} className="text-white" />
      </div>
      Page <span className="text-{accent}-600">Title</span>
    </h1>
    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">
      Subtitle or engine badge
    </p>
  </div>
  {/* Action buttons on the right */}
</header>
```

**Rules:**
- Icon badge: `w-14 h-14`, `rounded-[1.5rem]`, solid accent-600 background, white icon (28px)
- Title: `text-4xl font-black tracking-tighter`, second word colored with accent
- Subtitle: `text-sm font-medium text-gray-400 uppercase tracking-widest`

> [!CAUTION]
> Do **not** use `text-2xl font-bold` headers (legacy pattern). Always use `text-4xl font-black`.

---

## 3. List Pages — Two Standard Engines

### 3a. `UniversalDataTable` (UDLE) — For Backend-Driven Lists

Use when the backend exposes UDLE metadata (`/meta/` endpoint).

```tsx
import { UniversalDataTable } from "@/components/ui/universal-data-table";

<UniversalDataTable
  endpoint="module/resource"
  fetcher={getResourceUDLE}
  metaFetcher={getResourceMeta}
  onRowClick={(row) => router.push(`/module/${row.id}`)}
  actions={(row) => <ActionButtons row={row} />}
/>
```

**Features included automatically:** search, filters, column selector, saved views, pagination, sorting.

### 3b. `UniversalList` — For Frontend-Driven Lists

Use when data is fetched by custom actions and you need fine-grained control over columns/filters.

```tsx
import UniversalList from "@/components/universal-list";

<UniversalList
  listKey="module.resource"
  title="Resource Name"
  icon={IconComponent}
  accent="emerald"
  columns={columns}
  data={data}
  totalCount={total}
  filters={filterDefs}
  actions={actionDefs}
  loading={loading}
  onParamsChange={handleParams}
/>
```

**Features included automatically:** search, filters, column toggling (persisted), pagination, sorting, bulk actions.

> [!WARNING]
> **Never build a custom table from scratch.** If neither engine fits your use case, extend them — do not create a new pattern.

---

## 4. Detail Pages

| Element | Standard |
|---------|----------|
| **Layout** | `<div className="p-6 space-y-6 max-w-[1400px] mx-auto">` |
| **Back button** | `<Link href="/parent" className="text-sm text-gray-500 hover:text-gray-700">← Back</Link>` |
| **Title** | Same header pattern as list pages (Section 2) |
| **Content sections** | Use `<Card>` with `<CardHeader>` + `<CardContent>` |
| **Status badges** | Use `<Badge>` with status-config maps |
| **Not found** | Call `notFound()` from `next/navigation` |

---

## 5. Form Pages

| Element | Standard |
|---------|----------|
| **Layout** | Same as detail pages |
| **Inputs** | `<Input>` from `@/components/ui/input` with `input-field` class |
| **Selects** | `<Select>` from `@/components/ui/select` |
| **Validation** | Client-side with `toast.error()` before submit |
| **Submit** | `<Button>` with loading state, disabled during submission |
| **Server actions** | Always `'use server'` with try/catch returning `{ success, error }` |

---

## 6. Dashboard Pages

| Element | Standard |
|---------|----------|
| **Stat cards** | Use consistent `<Card>` with icon, value, label — all same height/width |
| **Charts** | (TBD based on chart library) |
| **Layout** | `grid grid-cols-2 md:grid-cols-4 gap-4` for stat row |
| **Icon style** | Same icon badge as page headers but smaller: `w-10 h-10 rounded-xl` |

---

## 7. Status & Badge Configs

Define status maps as `const` at the top of the file:

```tsx
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE:    { label: 'Active',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  DRAFT:     { label: 'Draft',     color: 'bg-stone-100 text-stone-600 border-stone-200' },
  CANCELLED: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700 border-rose-200' },
}
```

Use with: `<Badge className={config.color}>{config.label}</Badge>`

---

## 8. UI Primitives — Mandatory Imports

Always use components from `@/components/ui/`:

| Need | Component |
|------|-----------|
| Container | `Card`, `CardHeader`, `CardContent`, `CardTitle` |
| Table | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` |
| Form inputs | `Input`, `Select`, `Textarea`, `Checkbox`, `Switch` |
| Feedback | `toast()` from `sonner`, `Badge`, `Skeleton` |
| Overlays | `Dialog`, `Sheet`, `Popover`, `DropdownMenu` |
| Navigation | `Tabs`, `Breadcrumb` |
| Confirmation | `ConfirmDialog` |
| Icons | `lucide-react` only — never use other icon sets |

> [!CAUTION]
> Never use raw `<table>`, `<input>`, `<select>`, or `<button>` elements. Always use the shadcn/ui wrappers.

---

## 9. Frontend Architecture

### File Structure
```
src/app/(privileged)/{module}/{feature}/
  page.tsx        ← Server component (data fetching + try/catch)
  client.tsx      ← Client component (interactive UI)
  actions.ts      ← Server actions ('use server')
```

### Rules
| Rule | Detail |
|------|--------|
| **Server components** | Fetch data with try/catch, pass as props to client |
| **Client components** | `'use client'` at top, contain all interactivity |
| **Server actions** | `'use server'` at top, always return `{ success, error?, data? }` |
| **Error handling** | Server: try/catch with fallback values. Client: try/catch with `toast.error()` |
| **Currency** | Always use `useCurrency()` hook → `fmt(amount)` |
| **Dates** | Always guard with `if (dateValue)` before `new Date()` |
| **Loading** | Use `<Skeleton>` components during initial load |
| **Empty state** | Show icon + message — never show a blank page |

---

## 10. Backend Architecture (Django REST Framework)

### ViewSet Standard
```python
class ResourceViewSet(viewsets.ModelViewSet):
    serializer_class = ResourceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Resource.objects.filter(
            organization=self.request.user.organization
        )
    
    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            created_by=self.request.user
        )
```

### Rules
| Rule | Detail |
|------|--------|
| **Scoping** | Always filter by `request.user.organization` |
| **Serializer** | One per model, define `fields` explicitly (never `__all__`) |
| **URL pattern** | `{module}/{resource}/` for list, `{module}/{resource}/{id}/` for detail |
| **UDLE support** | Add `@action(detail=False, methods=['get']) def meta()` for column metadata |
| **Pagination** | Use DRF's `PageNumberPagination` with configurable `page_size` |
| **Search** | Use `SearchFilter` with `search_fields` |
| **Ordering** | Use `OrderingFilter` with `ordering_fields` |

---

## 11. Workflow Patterns

### Server Action Pattern
```typescript
'use server'
import { erpFetch } from "@/lib/erp-api"

export async function createResource(data: FormData) {
  try {
    const result = await erpFetch('module/resource/', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(data)),
    })
    return { success: true, data: result }
  } catch (error: any) {
    return { success: false, error: error.message || 'Operation failed' }
  }
}
```

### Client-Side Action Call
```typescript
const result = await createResource(formData)
if (result.success) {
  toast.success("Created successfully")
  router.push('/module/resource')
} else {
  toast.error(result.error)
}
```

---

## 12. Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Page files | `page.tsx` | `inventory/movements/page.tsx` |
| Client components | `client.tsx` or `{Name}Client.tsx` | `movements/client.tsx` |
| Server actions | `actions.ts` or `actions/{module}.ts` | `actions/inventory.ts` |
| List keys | `{module}.{resource}` | `inventory.movements` |
| API endpoints | `{module}/{resource}/` | `inventory/inventory-movements/` |
| CSS classes | Tailwind only, no custom CSS per-page | — |
| Types | PascalCase interfaces | `SalesOrder`, `InventoryMovement` |
| Backend models | PascalCase | `InventoryMovement` |

---

## Verification Plan

### Audit Script
Run across all pages to find violations:
```bash
# Find pages not using standard header pattern
grep -rL "text-4xl font-black" src/app/(privileged)/*/page.tsx

# Find pages using raw <table> instead of ui components
grep -rl "<table" src/app/(privileged)/ --include="*.tsx" | grep -v node_modules

# Find pages without try/catch in server components
```

### Manual Review
Walk through each module's list page to confirm uniform header, engine, and empty-state patterns.
