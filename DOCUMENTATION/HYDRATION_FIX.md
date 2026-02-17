# Hydration Mismatch & Tab Duplicates Fix

## Goal
Fix page flashing (hydration mismatch) and duplicate tabs in the navigation bar.

## Root Causes

### 1. Hydration Mismatch (Flashing)
- **Problem**: Next.js 16 SSR streaming wraps page children in a `<Suspense>` boundary on the server, but the client-side layout rendered a plain `<main>` tag without `<Suspense>`.
- **Effect**: React detected server/client HTML mismatch → re-rendered entire tree → visible flash.
- **Fix**: Wrapped `{children}` in `<Suspense fallback={null}>` inside `layout.tsx` to match server output.

### 2. Duplicate Tabs
- **Problem**: `openTab()` deduplicated by path only. Different paths (e.g., `/dashboard` vs `/admin`) could create multiple tabs with the same "Dashboard" title.
- **Fix**: Added title-based deduplication — if a tab with the same title already exists, update its path instead of creating a duplicate.

### 3. Missing Globe Icon
- **Problem**: Migration module manifest uses `Globe` icon, but `ICON_MAP` in `Sidebar.tsx` didn't include it.
- **Fix**: Added `Globe` to both the lucide-react import and `ICON_MAP`.

## Files Modified

| File | Change |
|------|--------|
| `src/app/(privileged)/layout.tsx` | Added `<Suspense>` around `{children}` |
| `src/context/AdminContext.tsx` | Added title-based tab deduplication in `openTab()` |
| `src/components/admin/Sidebar.tsx` | Added `Globe` to icon imports and `ICON_MAP` |

## Data Flow
- **READ**: `AdminContext` reads tabs from `localStorage` on mount
- **SAVE**: `AdminContext` saves tabs to `localStorage` on change
- **Variables**: `openTabs`, `activeTab` (derived from `pathname`)

## Verification
- Hard refresh the page — no flash
- Click sidebar items — no duplicate tabs appear
- Migration module shows Globe icon in sidebar
