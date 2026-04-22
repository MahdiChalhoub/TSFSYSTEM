// @ts-nocheck
'use client'

import { useState, useMemo, useCallback, useTransition, useRef } from 'react'
import {
    FolderTree, Plus, Layers, GitBranch, Box, Paintbrush, Search,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DeleteConflictDialog } from '@/components/ui/DeleteConflictDialog'
import { deleteCategory } from '@/app/actions/inventory/categories'
import { erpFetch } from '@/lib/erp-api'
import { buildTree } from '@/lib/utils/tree'
import { CategoryFormModal } from '@/components/admin/categories/CategoryFormModal'
import { GuidedTour } from '@/components/ui/GuidedTour'
import '@/lib/tours/definitions/inventory-categories'

import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import type { CategoryNode, PanelTab } from './components/types'
import { CategoryRow } from './components/CategoryRow'
import { CategoryDetailPanel } from './components/CategoryDetailPanel'

/* ═══════════════════════════════════════════════════════════
 *  CategoriesClient — thin consumer; TreeMasterPage is the single
 *  source of truth for search, KPI filtering, tree build, and
 *  empty-state UI. This file only supplies data + row + modals.
 * ═══════════════════════════════════════════════════════════ */
export function CategoriesClient({ initialCategories }: { initialCategories: any[] }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [modalState, setModalState] = useState<{ open: boolean; category?: CategoryNode; parentId?: number }>({ open: false })
    const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null)
    const [deleteConflict, setDeleteConflict] = useState<any>(null)
    const data = initialCategories

    // Actions
    const openAddModal = useCallback((parentId?: number) => { setModalState({ open: true, parentId }) }, [])
    const openEditModal = useCallback((cat: CategoryNode) => { setModalState({ open: true, category: cat }) }, [])
    const requestDelete = useCallback((cat: CategoryNode) => { setDeleteTarget(cat) }, [])
    const closeModal = useCallback(() => { setModalState({ open: false }) }, [])

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        const source = deleteTarget
        setDeleteTarget(null)
        startTransition(async () => {
            const result = await deleteCategory(source.id)
            if (result?.success) { toast.success(`"${source.name}" deleted`); router.refresh(); return }
            if ((result as any)?.conflict) { setDeleteConflict({ conflict: (result as any).conflict, source }); return }
            const msg = result?.message || 'Failed to delete'
            const hint = (result as any)?.actionHint
            if (hint) toast.error(msg, { description: hint, duration: 8000 })
            else toast.error(msg, { duration: 6000 })
        })
    }

    const handleMigrateAndDelete = async (targetId: number) => {
        const source = deleteConflict?.source
        if (!source) return
        try {
            // Step 1: preview — surface exactly which brands/attributes will
            // be auto-linked to the target so the user can abort before the
            // reconciliation fires silently.
            const preview = await erpFetch('inventory/categories/move_products/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source_category_id: source.id, target_category_id: targetId, preview: true,
                }),
            })
            const brandNames: string[] = (preview?.conflict_brands || []).map((b: any) => b.name)
            const attrNames: string[] = (preview?.conflict_attributes || []).map((a: any) => a.name)
            if (brandNames.length || attrNames.length) {
                const pieces = []
                if (brandNames.length) pieces.push(`${brandNames.length} brand${brandNames.length !== 1 ? 's' : ''} (${brandNames.slice(0, 3).join(', ')}${brandNames.length > 3 ? '…' : ''})`)
                if (attrNames.length) pieces.push(`${attrNames.length} attribute group${attrNames.length !== 1 ? 's' : ''} (${attrNames.slice(0, 3).join(', ')}${attrNames.length > 3 ? '…' : ''})`)
                const go = confirm(
                    `Moving ${preview?.count ?? 'these'} product${preview?.count === 1 ? '' : 's'} will auto-link the following to the target:\n\n` +
                    pieces.map(p => `• ${p}`).join('\n') +
                    `\n\nProceed?`
                )
                if (!go) return
            }
            // Step 2: execute the move with default reconciliation (auto-link all).
            const moveRes = await erpFetch('inventory/categories/move_products/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_category_id: source.id, target_category_id: targetId }),
            })
            if (moveRes && moveRes.success === false) { toast.error(moveRes.message || 'Migration failed — delete aborted'); return }
            const delRes = await deleteCategory(source.id, { force: true })
            if (delRes?.success) {
                toast.success(`Products migrated and "${source.name}" deleted`)
                setDeleteConflict(null); router.refresh()
            } else { toast.error(delRes?.message || 'Delete failed after migration') }
        } catch (e: any) { toast.error(e?.message || 'Migration failed') }
    }


    const handleForceDelete = async () => {
        const source = deleteConflict?.source
        if (!source) return
        const res = await deleteCategory(source.id, { force: true })
        if (res?.success) { toast.success(`"${source.name}" force-deleted`); setDeleteConflict(null); router.refresh() }
        else { toast.error(res?.message || 'Delete failed') }
    }

    const migrationTargets = useMemo(() => {
        const sourceId = deleteConflict?.source?.id
        return data.filter((c: any) => c.id !== sourceId).map((c: any) => ({ id: c.id, name: c.name, code: c.code }))
    }, [data, deleteConflict])

    const renderPropsRef = useRef<any>(null)
    const tourStepActions = useMemo(() => ({
        5: () => { renderPropsRef.current?.setExpandAll(true); renderPropsRef.current?.setExpandKey((k: number) => k + 1) },
        6: () => {
            const tree = buildTree(data)
            const n = tree[0]
            if (n) { renderPropsRef.current?.setSidebarNode(n); renderPropsRef.current?.setSidebarTab('overview') }
        },
        8: () => { renderPropsRef.current?.setSidebarTab('brands') },
        9: () => { renderPropsRef.current?.setSidebarTab('attributes') },
        10: () => { renderPropsRef.current?.setSidebarTab('products') },
        11: () => { renderPropsRef.current?.setSidebarNode(null) },
    }), [data])

    return (
        <TreeMasterPage
            config={{
                title: 'Categories',
                subtitle: (filtered, all) => `${all.length} Nodes · Hierarchical Tree`,
                icon: <FolderTree size={20} />,
                iconColor: 'var(--app-primary)',
                tourId: 'inventory-categories',
                treeTourId: 'category-tree',
                searchPlaceholder: 'Search by name, code, or short name... (Ctrl+K)',
                primaryAction: { label: 'New Category', icon: <Plus size={14} />, onClick: () => openAddModal(), dataTour: 'add-category-btn' },
                secondaryActions: [
                    { label: 'Cleanup', icon: <FolderTree size={13} />, href: '/inventory/maintenance?tab=category' },
                ],
                columnHeaders: [
                    { label: 'Category', width: 'auto' },
                    { label: 'Sub', width: '48px', hideOnMobile: true },
                    { label: 'Brands', width: '56px', color: 'var(--app-info)', hideOnMobile: true },
                    { label: 'Attrs', width: '48px', color: 'var(--app-warning)', hideOnMobile: true },
                    { label: 'Products', width: '56px', color: 'var(--app-success)', hideOnMobile: true },
                ],

                // ── Template owns filtering ──
                data,
                searchFields: ['name', 'code', 'short_name', 'full_path'],
                kpiPredicates: {
                    root: (c) => !c.parent,
                    leaf: (c, all) => !all.some((child: any) => child.parent === c.id),
                    products: (c) => (c.product_count || 0) > 0,
                    brands: (c) => (c.brand_count || 0) > 0,
                },

                kpis: [
                    {
                        label: 'Total', icon: <Layers size={11} />, color: 'var(--app-primary)',
                        filterKey: 'all', hint: 'Show all categories (clear filters)',
                        value: (_, all) => all.length,
                    },
                    {
                        label: 'Root', icon: <FolderTree size={11} />, color: 'var(--app-success)',
                        filterKey: 'root', hint: 'Show only top-level categories',
                        value: (filtered) => buildTree(filtered).length,
                    },
                    {
                        label: 'Leaf', icon: <GitBranch size={11} />, color: 'var(--app-info)',
                        filterKey: 'leaf', hint: 'Show only leaf categories (no children)',
                        value: (filtered) => filtered.filter((d: any) => !filtered.some((c: any) => c.parent === d.id)).length,
                    },
                    {
                        label: 'Products', icon: <Box size={11} />, color: 'var(--app-info)',
                        filterKey: 'products', hint: 'Show only categories with products',
                        value: (filtered) => filtered.reduce((sum: number, d: any) => sum + (d.product_count || 0), 0),
                    },
                    {
                        label: 'Brands', icon: <Paintbrush size={11} />, color: 'var(--app-warning)',
                        filterKey: 'brands', hint: 'Show only categories with brands',
                        value: (filtered) => filtered.reduce((sum: number, d: any) => sum + (d.brand_count || 0), 0),
                    },
                    {
                        label: 'Showing', icon: <Search size={11} />, color: 'var(--app-muted-foreground)',
                        value: (filtered, all) => filtered.length < all.length ? `${filtered.length}/${all.length}` : all.length,
                    },
                ],
                emptyState: {
                    icon: <FolderTree size={36} />,
                    title: (hasSearch) => hasSearch ? 'No matching categories' : 'No categories defined yet',
                    subtitle: (hasSearch) => hasSearch
                        ? 'Try a different search term or clear filters.'
                        : 'Create a root category to start organizing your product catalog.',
                    actionLabel: 'Create First Category',
                },
                footerLeft: (_, all) => (
                    <div className="flex items-center gap-3 flex-wrap">
                        <span>{all.length} total categories</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{all.reduce((s: number, d: any) => s + (d.product_count || 0), 0).toLocaleString()} linked products</span>
                    </div>
                ),
            }}
            modals={
                <>
                    <CategoryFormModal
                        isOpen={modalState.open}
                        onClose={closeModal}
                        category={modalState.category}
                        parentId={modalState.parentId}
                        potentialParents={data}
                    />
                    <GuidedTour tourId="inventory-categories" stepActions={tourStepActions} />
                    <ConfirmDialog
                        open={deleteTarget !== null}
                        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                        onConfirm={handleConfirmDelete}
                        title={`Delete "${deleteTarget?.name}"?`}
                        description="This will permanently remove this category. Products or sub-categories will be checked — if any reference this, you'll be guided to migrate them."
                        confirmText="Delete"
                        variant="danger"
                    />
                    <DeleteConflictDialog
                        conflict={deleteConflict?.conflict || null}
                        sourceName={deleteConflict?.source?.name || ''}
                        entityName="category"
                        targets={migrationTargets}
                        onMigrate={handleMigrateAndDelete}
                        onForceDelete={handleForceDelete}
                        onCancel={() => setDeleteConflict(null)}
                    />
                </>
            }
            detailPanel={(node, { tab, onClose, onPin }) => (
                <CategoryDetailPanel
                    node={node}
                    onEdit={openEditModal}
                    onAdd={openAddModal}
                    onDelete={requestDelete}
                    allCategories={data}
                    initialTab={tab as PanelTab}
                    onClose={onClose}
                    onPin={onPin ? (n) => onPin(n) : undefined}
                />
            )}
        >
            {(renderProps) => {
                const { tree, expandKey, expandAll, searchQuery, isSelected, openNode } = renderProps
                renderPropsRef.current = renderProps

                return tree.map((node: CategoryNode) => (
                    <div key={`${node.id}-${expandKey}`}
                        className={`rounded-xl transition-all duration-300 ${isSelected(node) ? 'ring-2 ring-app-primary/40 bg-app-primary/[0.03] shadow-sm' : ''}`}>
                        <CategoryRow
                            node={node}
                            level={0}
                            onEdit={openEditModal}
                            onAdd={openAddModal}
                            onDelete={requestDelete}
                            onSelect={(n) => openNode(n, 'overview')}
                            onViewProducts={(n) => openNode(n, 'products')}
                            onViewBrands={(n) => openNode(n, 'brands')}
                            onViewAttributes={(n) => openNode(n, 'attributes')}
                            searchQuery={searchQuery}
                            forceExpanded={expandAll}
                        />
                    </div>
                ))
            }}
        </TreeMasterPage>
    )
}
