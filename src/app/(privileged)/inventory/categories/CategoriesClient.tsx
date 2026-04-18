// @ts-nocheck
'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import {
    FolderTree, Plus, Layers, GitBranch, Box, Paintbrush, Search
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteCategory } from '@/app/actions/inventory/categories'
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
    const data = initialCategories

    // Actions
    const openAddModal = useCallback((parentId?: number) => { setModalState({ open: true, parentId }) }, [])
    const openEditModal = useCallback((cat: CategoryNode) => { setModalState({ open: true, category: cat }) }, [])
    const requestDelete = useCallback((cat: CategoryNode) => { setDeleteTarget(cat) }, [])
    const closeModal = useCallback(() => { setModalState({ open: false }) }, [])

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        startTransition(async () => {
            const result = await deleteCategory(deleteTarget.id)
            if (result?.success) {
                toast.success(`"${deleteTarget.name}" deleted`)
                router.refresh()
            } else {
                toast.error(result?.message || 'Failed to delete')
            }
            setDeleteTarget(null)
        })
    }

    return (
        <TreeMasterPage
            config={{
                title: 'Categories',
                subtitle: `${data.length} Nodes · Hierarchical Tree`,
                icon: <FolderTree size={20} />,
                iconColor: 'var(--app-primary)',
                tourId: 'inventory-categories',
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
                kpis: [],  // Populated dynamically via useMemo below
                footerLeft: <></>,
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
                    <GuidedTour tourId="inventory-categories" />
                    <ConfirmDialog
                        open={deleteTarget !== null}
                        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                        onConfirm={handleConfirmDelete}
                        title={`Delete "${deleteTarget?.name}"?`}
                        description="This will permanently remove this category. Make sure it has no products assigned."
                        confirmText="Delete"
                        variant="danger"
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
                const { searchQuery, expandAll, expandKey, splitPanel, pinnedSidebar, selectedNode, setSelectedNode, sidebarNode, setSidebarNode, sidebarTab, setSidebarTab, panelTab, setPanelTab } = renderProps

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
