# Alert → Toast Migration Documentation

## Goal
Replace all browser-native `alert()` calls with modern `toast()` notifications from the **sonner** library to provide a non-blocking, visually consistent UX.

## Data Read
- No data is read; this is a UI notification change.

## Data Saved
- No data is saved; this is a UI notification change.

## Variables User Interacts With
- `toast.success(message)` — shown for positive outcomes (save success, creation success, etc.)
- `toast.error(message)` — shown for validation errors and failure messages
- `toast(message, { icon })` — used for conditional success/failure display

## Step-by-Step Workflow
1. Scanned the entire `src/` directory for `alert(` calls.
2. For each file containing `alert()`:
   a. Added `import { toast } from 'sonner'` if missing.
   b. Replaced success/confirmation alerts with `toast.success()`.
   c. Replaced error/validation alerts with `toast.error()`.
3. Verified zero remaining `alert()` calls with final grep scan.

## How The Migration Achieves Its Goal
By replacing blocking `alert()` dialogs with non-blocking `toast()` notifications, users can continue interacting with the UI while receiving feedback. The sonner `<Toaster />` component (already in the root layout) renders these as sleek slide-in notifications.

## Files Modified

### Finance Module (10 files)
| File | Changes |
|------|---------|
| `finance/settings/form.tsx` | 2 alerts → toast.success + conditional toast |
| `finance/settings/posting-rules/form.tsx` | 3 alerts → toast.success + toast.error |
| `finance/fiscal-years/year-card.tsx` | 1 alert → toast.success |
| `finance/fiscal-years/wizard.tsx` | Alerts → toast (prior session) |
| `finance/fiscal-years/period-editor.tsx` | Alerts → toast (prior session) |
| `finance/ledger/new/form.tsx` | Import added (prior session) |
| `finance/ledger/opening/form.tsx` | Import added (prior session) |
| `finance/ledger/ledger-actions.tsx` | Import added (prior session) |
| `finance/chart-of-accounts/viewer.tsx` | Import added (prior session) |
| `finance/chart-of-accounts/templates/viewer.tsx` | Import added (prior session) |
| `finance/chart-of-accounts/migrate/viewer.tsx` | Import added (prior session) |
| `finance/reports/statement/form.tsx` | 1 alert → toast.error |
| `finance/loans/new/page.tsx` | 2 alerts → toast.error |
| `finance/loans/[id]/disburse-button.tsx` | 1 alert → toast.error |
| `finance/events/new/page.tsx` | 2 alerts → toast.error |
| `finance/dashboard/viewer.tsx` | 2 alerts → toast.success + toast.error |

### Components (5 files)
| File | Changes |
|------|---------|
| `components/finance/post-event-button.tsx` | 2 alerts → toast.error |
| `components/admin/ProductReassignmentTable.tsx` | 1 alert → toast.error |
| `components/admin/GroupedProductForm.tsx` | 2 alerts → toast.error |
| `components/admin/maintenance/UnifiedReassignmentTable.tsx` | 2 alerts → toast.error |
| `components/admin/categories/CategoryTree.tsx` | 1 alert → toast.error |

### Other Modules (4 files)
| File | Changes |
|------|---------|
| `sales/quotations/manager.tsx` | 1 alert → toast.success |
| `inventory/stock-count/[id]/verify/page.tsx` | 1 alert → toast.success |
| `inventory/warehouses/manager.tsx` | 1 alert → toast.error |
| `(saas)/currencies/page.tsx` | 1 alert → toast.error |
| `products/new/form.tsx` | 1 alert → toast.error |

## Dependencies
- `sonner` (already installed)
- `<Toaster />` component (already in root layout)
