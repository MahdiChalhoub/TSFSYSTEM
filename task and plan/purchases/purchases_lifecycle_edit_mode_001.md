# Purchases — PO Lifecycle Interactive Edit Mode

## Goal
Make the Purchase Order lifecycle widget interactive in edit mode so operators
can transition a PO through its state machine (DRAFT → SUBMITTED → APPROVED →
SENT → … → COMPLETED) directly from the sidebar.

## Problem
- The `POLifecycle` component had an `onStageChange` prop but it was never
  passed in any usage — the lifecycle was always read-only.
- The component had only 7 simplified stages (`DRAFT`, `APPROVED`, `SENT`,
  `IN_TRANSIT`, `PARTIAL`, `DELIVERED`, `FAILED`) that didn't match the
  backend's actual 13-state machine.
- In edit mode, the status was hardcoded to `"DRAFT"` instead of reading
  from `initialPO.status`.

## Changes Made

### [MODIFY] `POLifecycle.tsx`
- Aligned `POStatus` type with the backend's full 13-state lifecycle
- Added `transitioning` prop for loading state during API calls
- Added `Loader2` spinner icon shown while transitioning
- Replaced single "Failed" alternate path with "Cancelled / Rejected" dual terminal
- Used `Ban` icon for terminal states instead of `AlertTriangle`

### [MODIFY] `purchases.ts` (server actions)
- Added `transitionPurchaseOrderStatus()` server action that calls the
  backend's `purchase-orders/{id}/transition/` endpoint
- Returns `{ status }` on success, `{ error, current_status }` on failure
- Revalidates `/purchases` and `/purchases/{id}` after transition

### [MODIFY] `AdminSidebar.tsx`
- Added `poStatus`, `onStatusChange`, `statusTransitioning` props
- Passes them through to `POLifecycle` component
- Lifecycle auto-expands when status is not DRAFT (edit mode)

### [MODIFY] `form.tsx`
- Added `poStatus` state (reads from `initialPO.status` in edit mode)
- Added `statusTransitioning` loading state
- Added `handleStatusChange` callback that calls `transitionPurchaseOrderStatus`
- Wired compact lifecycle chip in header to show real status
- Passes `onStatusChange` to sidebar ONLY in edit mode (new POs stay read-only)

## Behavior

| Mode | Lifecycle | Interactive? |
|------|-----------|-------------|
| New PO (`/purchases/new`) | Always DRAFT, collapsed | ❌ Read-only |
| Edit PO (`/purchases/new?edit=ID`) | Real status from DB, expanded | ✅ Clickable stages |

## Verification
- [x] TypeScript: `tsc --noEmit` — 0 errors
- [x] Build: `next build` — exit code 0
