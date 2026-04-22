# Archive — Categories page

Snapshot taken 20260422-0905 UTC, before a planned update of the Categories page.

## Restore

To roll back, copy these paths back over the live tree:

```bash
cp -r "/root/.gemini/antigravity/scratch/TSFSYSTEM/ARCHIVE/inventory-categories-20260422-0905/src/app/(privileged)/inventory/categories" \
  /root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/\(privileged\)/inventory/categories
cp "/root/.gemini/antigravity/scratch/TSFSYSTEM/ARCHIVE/inventory-categories-20260422-0905/src/app/actions/inventory/categories.ts" \
  /root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/actions/inventory/categories.ts
```

Then hard-refresh the browser (dev mode HMR picks it up; no rebuild needed).

## What's in the snapshot

- `src/app/(privileged)/inventory/categories/` — page, client, detail panel, row, tabs, modals, mobile variant
- `src/app/actions/inventory/categories.ts` — server actions (createCategory, updateCategory, deleteCategory, archiveCategory, restoreCategory, duplicateCategory, moveProducts, etc.)

## NOT included

These are shared / not owned by this page — if the update touches them, archive those files separately:

- Backend: `erp_backend/apps/inventory/views/taxonomy_views.py` (CategoryViewSet)
- Backend: `erp_backend/apps/inventory/serializers/taxonomy_serializers.py` (CategorySerializer)
- Backend: `erp_backend/apps/inventory/models/product_models.py` (Category model)
- Shared template: `src/components/templates/TreeMasterPage.tsx`
- Shared modal: `src/components/admin/categories/CategoryFormModal.tsx`
- Sidebar menu entry: `src/components/admin/_lib/menu/inventory.ts`
