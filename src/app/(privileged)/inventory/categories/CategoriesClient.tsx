// @ts-nocheck
'use client'

import { useState, useMemo, useCallback, useTransition, useRef } from 'react'
import {
    FolderTree, Plus, Layers, GitBranch, Box, Paintbrush, Search
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DeleteConflictDialog } from '@/components/ui/DeleteConflictDialog'
import { deleteCategory, moveProducts } from '@/app/actions/inventory/categories'
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
 *  CategoriesClient — Decomposed & migrated to TreeMasterPage
 * ═══════════════════════════════════════════════════════════ */
export function CategoriesClient({ initialCategories }: { initialCategories: any[] }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [modalState, setModalState] = useState<{ open: boolean; category?: CategoryNode; parentId?: number }>({ open: false })
    const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null)
    const [deleteConflict, setDeleteConflict] = useState<any>(null)  // { conflict, source } when backend 409s
    const data = initialCategories

    // Compute stats for KPIs
    const stats = useMemo(() => {
        const tree = buildTree(data)
        const leafCount = data.filter((d: any) => !data.some((c: any) => c.parent === d.id)).length
        const totalProducts = data.reduce((sum: number, d: any) => sum + (d.product_count || 0), 0)
        const totalBrands = data.reduce((sum: number, d: any) => sum + (d.brand_count || 0), 0)
        return { total: data.length, roots: tree.length, leafCount, totalProducts, totalBrands }
    }, [data])

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
            if (result?.success) {
                toast.success(`"${source.name}" deleted`)
                router.refresh()
                return
            }
            // Backend raised a 409 conflict — open the guided migration dialog.
            if ((result as any)?.conflict) {
                setDeleteConflict({ conflict: (result as any).conflict, source })
                return
            }
            toast.error(result?.message || 'Failed to delete')
        })
    }

    // Migrate every product from the source category → target, then force-delete.
    // Uses the bulk shortcut path on the backend (move_products accepts
    // source_category_id when product_ids is empty).
    const handleMigrateAndDelete = async (targetId: number) => {
        const source = deleteConflict?.source
        if (!source) return
        try {
            // Call move_products with source_category_id shortcut
            const moveRes = await erpFetch('inventory/categories/move_products/', {
                method: 'POST',
                body: JSON.stringify({ source_category_id: source.id, target_category_id: targetId }),
            })
            if (moveRes && moveRes.success === false) {
                toast.error(moveRes.message || 'Migration failed — delete aborted')
                return
            }
            const delRes = await deleteCategory(source.id, { force: true })
            if (delRes?.success) {
                toast.success(`Products migrated and "${source.name}" deleted`)
                setDeleteConflict(null)
                router.refresh()
            } else {
                toast.error(delRes?.message || 'Delete failed after migration')
            }
        } catch (e: any) {
            toast.error(e?.message || 'Migration failed')
        }
    }

    const handleForceDelete = async () => {
        const source = deleteConflict?.source
        if (!source) return
        const res = await deleteCategory(source.id, { force: true })
        if (res?.success) {
            toast.success(`"${source.name}" force-deleted`)
            setDeleteConflict(null)
            router.refresh()
        } else {
            toast.error(res?.message || 'Delete failed')
        }
    }

    // Targets list = all other categories (excluding the one being deleted)
    const migrationTargets = useMemo(() => {
        const sourceId = deleteConflict?.source?.id
        return data
            .filter((c: any) => c.id !== sourceId)
            .map((c: any) => ({ id: c.id, name: c.name, code: c.code }))
    }, [data, deleteConflict])

    // Ref to access render props from tour step actions
    const renderPropsRef = useRef<any>(null)

    // Interactive tour step actions (programmatic UI interactions during tour)
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
                subtitle: `${data.length} Nodes · Hierarchical Tree`,
                icon: <FolderTree size={20} />,
                iconColor: 'var(--app-primary)',
                tourId: 'inventory-categories',
                treeTourId: 'category-tree',
                searchPlaceholder: 'Search by name, code, or short name... (Ctrl+K)',
                primaryAction: {
                    label: 'New Category',
                    icon: <Plus size={14} />,
                    onClick: () => openAddModal(),
                    dataTour: 'add-category-btn',
                },
                secondaryActions: [
                    {
                        label: 'Cleanup',
                        icon: <FolderTree size={13} />,
                        href: '/inventory/maintenance?tab=category',
                    },
                ],
                columnHeaders: [
                    { label: 'Category', width: 'auto' },
                    { label: 'Sub', width: '48px', hideOnMobile: true },
                    { label: 'Brands', width: '56px', color: '#8b5cf6', hideOnMobile: true },
                    { label: 'Attrs', width: '48px', color: 'var(--app-warning)', hideOnMobile: true },
                    { label: 'Products', width: '56px', color: 'var(--app-success)', hideOnMobile: true },
                ],
                kpis: [
                    { label: 'Total', value: stats.total, icon: <Layers size={11} />, color: 'var(--app-primary)' },
                    { label: 'Root', value: stats.roots, icon: <FolderTree size={11} />, color: 'var(--app-success)' },
                    { label: 'Leaf', value: stats.leafCount, icon: <GitBranch size={11} />, color: '#8b5cf6' },
                    { label: 'Products', value: stats.totalProducts, icon: <Box size={11} />, color: 'var(--app-info)' },
                    { label: 'Brands', value: stats.totalBrands, icon: <Paintbrush size={11} />, color: 'var(--app-warning)' },
                    { label: 'Showing', value: stats.total, icon: <Search size={11} />, color: 'var(--app-muted-foreground)' },
                ],
                footerLeft: (
                    <div className="flex items-center gap-3 flex-wrap">
                        <span>{stats.total} total categories</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{stats.totalProducts.toLocaleString()} linked products</span>
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
                const { searchQuery, expandAll, expandKey, splitPanel, pinnedSidebar, selectedNode, setSelectedNode, sidebarNode, setSidebarNode, sidebarTab, setSidebarTab, panelTab, setPanelTab, setExpandAll, setExpandKey } = renderProps
                renderPropsRef.current = renderProps

                // Build tree with search filter
                const filtered = searchQuery.trim()
                    ? data.filter((a: any) => {
                        const q = searchQuery.toLowerCase()
                        return a.name?.toLowerCase().includes(q) || a.code?.toLowerCase().includes(q) || a.short_name?.toLowerCase().includes(q)
                    })
                    : data

                const tree = buildTree(filtered)
                const leafCount = filtered.filter((d: any) => !filtered.some((c: any) => c.parent === d.id)).length
                const totalProducts = filtered.reduce((sum: number, d: any) => sum + (d.product_count || 0), 0)
                const totalBrands = filtered.reduce((sum: number, d: any) => sum + (d.brand_count || 0), 0)

                return tree.length > 0 ? (
                    tree.map((node: CategoryNode) => (
                        <div key={`${node.id}-${expandKey}`}
                            className={`rounded-xl transition-all duration-300 ${((splitPanel || pinnedSidebar) ? selectedNode?.id === node.id : sidebarNode?.id === node.id) ? 'ring-2 ring-app-primary/40 bg-app-primary/[0.03] shadow-sm' : ''}`}>
                            <CategoryRow
                                node={node}
                                level={0}
                                onEdit={openEditModal}
                                onAdd={openAddModal}
                                onDelete={requestDelete}
                                onSelect={(n) => {
                                    if (splitPanel || pinnedSidebar) { setSelectedNode(n) }
                                    else { setSidebarNode(n); setSidebarTab('overview') }
                                }}
                                onViewProducts={(n) => {
                                    if (splitPanel || pinnedSidebar) { setSelectedNode(n); setPanelTab('products') }
                                    else { setSidebarNode(n); setSidebarTab('products') }
                                }}
                                onViewBrands={(n) => {
                                    if (splitPanel || pinnedSidebar) { setSelectedNode(n); setPanelTab('brands') }
                                    else { setSidebarNode(n); setSidebarTab('brands') }
                                }}
                                onViewAttributes={(n) => {
                                    if (splitPanel || pinnedSidebar) { setSelectedNode(n); setPanelTab('attributes') }
                                    else { setSidebarNode(n); setSidebarTab('attributes') }
                                }}
                                searchQuery={searchQuery}
                                forceExpanded={expandAll}
                            />
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                        <FolderTree size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground mb-1">
                            {searchQuery ? 'No matching categories' : 'No categories defined yet'}
                        </p>
                        <p className="text-[11px] text-app-muted-foreground mb-5 max-w-xs">
                            {searchQuery ? 'Try a different search term or clear filters.' : 'Create a root category to start organizing your product catalog.'}
                        </p>
                        {!searchQuery && (
                            <button onClick={() => openAddModal()}
                                className="px-4 py-2 rounded-xl bg-app-primary text-white text-sm font-bold hover:brightness-110 transition-all"
                                style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                <Plus size={16} className="inline mr-1.5" />Create First Category
                            </button>
                        )}
                    </div>
                )
            }}
        </TreeMasterPage>
    )
}
