# Phase 7 — Search Bar & Confirm Dialog

## Goal
Replace the non-functional search bar with a working command palette and provide a reusable ConfirmDialog component.

## Changes

### CommandPalette (`src/components/admin/CommandPalette.tsx`) [NEW]
- Ctrl+K / Cmd+K keyboard shortcut to open
- Fuzzy search over all sidebar pages (uses `MENU_ITEMS` from Sidebar)
- Arrow key navigation + Enter to open page
- Shows section and path for each result
- Animated overlay with backdrop blur
- Mobile: tap search icon in TopHeader to open

### ConfirmDialog (`src/components/ui/confirm-dialog.tsx`) [NEW]
- Reusable wrapper around shadcn/ui Dialog
- 3 variants: `danger` (red), `warning` (amber), `info` (blue)
- Async `onConfirm` with loading state
- Customizable title, description, button text
- Drop-in replacement for native `confirm()` calls

### TopHeader (`src/components/admin/TopHeader.tsx`) [MODIFIED]
- Replaced non-functional `<input>` with styled trigger button
- Desktop: shows "Search pages, settings, reports..." + Ctrl+K badge
- Mobile: search icon dispatches Ctrl+K event

### Sidebar (`src/components/admin/Sidebar.tsx`) [MODIFIED]
- Exported `MENU_ITEMS` for CommandPalette consumption

### Layout (`src/app/(privileged)/layout.tsx`) [MODIFIED]
- Added `<CommandPalette />` to render globally

## Data Flow
- `MENU_ITEMS` is the single source of truth (Sidebar.tsx)
- `CommandPalette` imports and flattens it into searchable items
- TopHeader dispatches keyboard events to trigger the palette

## Variables User Interacts With
- Search box in header (click or Ctrl+K)
- Keyboard navigation in palette (↑↓ + Enter)
- ConfirmDialog appears when a confirmation is needed

## ConfirmDialog Usage
```tsx
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const [showConfirm, setShowConfirm] = useState(false)

<ConfirmDialog
    open={showConfirm}
    onOpenChange={setShowConfirm}
    onConfirm={handleDelete}
    title="Delete Item?"
    description="This cannot be undone."
    confirmText="Delete"
    variant="danger"
/>
```
