# ConfirmDialog Migration — SaaS Pages

## Goal
Replace all native browser `confirm()` calls across SaaS admin pages with the branded `ConfirmDialog` component for a consistent, premium UX.

## ConfirmDialog Component API

**Source:** `@/components/ui/confirm-dialog`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | ✅ | Controls dialog visibility |
| `onOpenChange` | `(open: boolean) => void` | ✅ | Called when dialog open state changes |
| `onConfirm` | `() => void \| Promise<void>` | ✅ | Callback when user confirms |
| `title` | `string` | ❌ | Dialog title (default: "Are you sure?") |
| `description` | `string` | ❌ | Dialog body text |
| `confirmText` | `string` | ❌ | Confirm button label (default: "Confirm") |
| `cancelText` | `string` | ❌ | Cancel button label (default: "Cancel") |
| `variant` | `'danger' \| 'warning' \| 'info'` | ❌ | Visual style (default: "danger") |
| `loading` | `boolean` | ❌ | External loading state |

## Pattern Used

Each `confirm()` call was replaced with:
1. A **state variable** to track the pending action (e.g., `pendingDeleteId`)
2. The **button onClick** sets the state instead of calling the handler directly
3. A **`<ConfirmDialog>`** component reads the state, and on confirm calls the original handler then resets state

## Files Modified

### 1. `updates/page.tsx`
- **Action:** Apply system update
- **State:** `pendingUpdate: { id, version } | null`
- **Variant:** `warning`

### 2. `subscription-plans/page.tsx`
- **Action:** Delete add-on
- **State:** `pendingDeleteAddon: any | null`
- **Variant:** `danger`

### 3. `modules/page.tsx` (3 dialogs)
- **Actions:** Revoke module (`danger`), Delete module (`danger`), Rollback module (`warning`)
- **States:** `pendingUninstall`, `pendingDelete`, `pendingRollback`

### 4. `organizations/page.tsx`
- **Action:** Delete organization
- **State:** `pendingDeleteOrg: any | null`
- **Variant:** `danger`

### 5. `organizations/registrations/RegistrationQueue.tsx`
- **Action:** Reject registration
- **State:** `pendingRejectId: number | null`
- **Variant:** `danger`

### 6. `encryption/page.tsx`
- **Action:** Rotate encryption key
- **State:** `showRotateConfirm: boolean`
- **Variant:** `warning`

### 7. `currencies/page.tsx`
- **Action:** Delete currency
- **State:** `pendingDelete: { id, code } | null`
- **Variant:** `danger`

### 8. `connector/policies/page.tsx` (2 dialogs)
- **Actions:** Delete policy (`danger`), Auto-generate policies (`warning`)
- **States:** `pendingDeleteId`, `showAutoGenConfirm`

## Data Flow
- **Read:** Each page reads from its own state variables and existing API data
- **Write:** State is set on button click; on confirm, the original async handler is called which writes to backend APIs
- No new API endpoints or database changes were required

## Variables User Interacts With
- Confirm/Cancel buttons within the ConfirmDialog modal
- The original action buttons (delete, revoke, rollback, etc.) that now trigger the dialog instead of a native `confirm()`
