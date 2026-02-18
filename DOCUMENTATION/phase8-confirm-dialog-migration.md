# Phase 8 — Confirm Dialog Migration & Profile Fix

## Goal
Migrate high-traffic pages from native `confirm()` to the reusable `ConfirmDialog` component.

## Migrated Pages (5)

| File | Component | What changed |
|------|-----------|-------------|
| `inventory/warehouses/manager.tsx` | WarehouseManager | Delete warehouse → `ConfirmDialog` (danger) |
| `components/admin/categories/CategoryTree.tsx` | CategoryTree | Delete category → lifted state to parent, `ConfirmDialog` (danger) |
| `components/admin/UnitTree.tsx` | UnitTreeNode | Delete unit → `ConfirmDialog` (danger) |
| `settings/roles/RoleManager.tsx` | RoleManager | Delete role → `ConfirmDialog` (danger) |
| `sales/quotations/manager.tsx` | QuotationManager | Delete quotation → `ConfirmDialog` (danger) |

## Migration Pattern

### Before (native confirm)
```tsx
const handleDelete = async (id: number) => {
    if (!confirm('Delete this?')) return;
    await deleteItem(id);
};
```

### After (ConfirmDialog)
```tsx
const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

const handleDelete = async () => {
    if (deleteTarget === null) return;
    await deleteItem(deleteTarget);
    setDeleteTarget(null);
};

// In JSX: onClick={() => setDeleteTarget(item.id)}
// At bottom:
<ConfirmDialog
    open={deleteTarget !== null}
    onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
    onConfirm={handleDelete}
    title="Delete Item?"
    description="This cannot be undone."
    confirmText="Delete"
    variant="danger"
/>
```

## Data Flow
- Delete button sets `deleteTarget` state (ID or object)
- `ConfirmDialog` opens based on `deleteTarget !== null`
- On confirm → async action executes → state cleared
- On cancel → `onOpenChange(false)` → state cleared

## Remaining confirm() calls
~25 more pages still use native `confirm()`. These can be migrated incrementally using the same pattern above.
