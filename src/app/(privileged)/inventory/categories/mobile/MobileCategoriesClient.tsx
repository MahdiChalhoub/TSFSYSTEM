// @ts-nocheck
'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import {
    FolderTree, Plus, Layers, GitBranch, Box, Paintbrush, Search,
    Eye, Pencil, Trash2, Move, Copy, Package, Tag,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteCategory } from '@/app/actions/inventory/categories'
import { buildTree } from '@/lib/utils/tree'
import { CategoryFormModal } from '@/components/admin/categories/CategoryFormModal'
import { MobileMasterPage } from '@/components/mobile/MobileMasterPage'
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet'
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet'
import { MobileCategoryRow } from './MobileCategoryRow'
import { MobileMoveDialog } from './MobileMoveDialog'
import { CategoryDetailPanel } from '../components/CategoryDetailPanel'
import type { CategoryNode, PanelTab } from '../components/types'

export function MobileCategoriesClient({ initialCategories }: { initialCategories: any[] }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [modalState, setModalState] = useState<{ open: boolean; category?: CategoryNode; parentId?: number }>({ open: false })
    const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null)
    const [sheetNode, setSheetNode] = useState<CategoryNode | null>(null)
    const [sheetTab, setSheetTab] = useState<PanelTab>('overview')
    const [actionNode, setActionNode] = useState<CategoryNode | null>(null)
    const [moveNode, setMoveNode] = useState<CategoryNode | null>(null)

    const data = initialCategories

    const stats = useMemo(() => {
        const tree = buildTree(data)
        const leafCount = data.filter((d: any) => !data.some((c: any) => c.parent === d.id)).length
        const totalProducts = data.reduce((s: number, d: any) => s + (d.product_count || 0), 0)
        const totalBrands = data.reduce((s: number, d: any) => s + (d.brand_count || 0), 0)
        return { total: data.length, roots: tree.length, leafCount, totalProducts, totalBrands }
    }, [data])

    const openAddModal = useCallback((parentId?: number) => setModalState({ open: true, parentId }), [])
    const openEditModal = useCallback((cat: CategoryNode) => setModalState({ open: true, category: cat }), [])
    const requestDelete = useCallback((cat: CategoryNode) => setDeleteTarget(cat), [])
    const closeModal = useCallback(() => setModalState({ open: false }), [])

    const openSheet = useCallback((n: CategoryNode, tab: PanelTab = 'overview') => {
        setSheetNode(n); setSheetTab(tab)
    }, [])

    const openActionMenu = useCallback((n: CategoryNode) => setActionNode(n), [])

    const actionItems = useMemo(() => {
        if (!actionNode) return []
        const isParent = !!(actionNode.children && actionNode.children.length > 0)
        return [
            { key: 'view', label: 'View details', hint: 'Open detail sheet', icon: <Eye size={16} />, onClick: () => openSheet(actionNode, 'overview') },
            { key: 'products', label: 'View products', hint: `${actionNode.product_count ?? 0} products`, icon: <Package size={16} />, onClick: () => openSheet(actionNode, 'products') },
            { key: 'attrs', label: 'View attributes', hint: `${actionNode.attribute_count ?? 0} attributes`, icon: <Tag size={16} />, onClick: () => openSheet(actionNode, 'attributes') },
            { key: 'add', label: 'Add sub-category', icon: <Plus size={16} />, onClick: () => openAddModal(actionNode.id) },
            { key: 'edit', label: 'Edit', icon: <Pencil size={16} />, onClick: () => openEditModal(actionNode) },
            { key: 'move', label: 'Move to…', hint: 'Change parent', icon: <Move size={16} />, onClick: () => setMoveNode(actionNode) },
            { key: 'copy', label: 'Copy ID', hint: `#${actionNode.id}`, icon: <Copy size={16} />, onClick: () => {
                try {
                    navigator.clipboard?.writeText(String(actionNode.id))
                    toast.success('ID copied')
                } catch { toast.error('Copy failed') }
            } },
            { key: 'delete', label: isParent ? 'Delete (locked)' : 'Delete', hint: isParent ? 'Delete sub-categories first' : undefined, icon: <Trash2 size={16} />, destructive: true, disabled: isParent, onClick: () => requestDelete(actionNode) },
        ]
    }, [actionNode, openSheet, openAddModal, openEditModal, requestDelete])

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
        <MobileMasterPage
            config={{
                title: 'Categories',
                subtitle: `${data.length} Nodes · Tree`,
                icon: <FolderTree size={20} />,
                iconColor: 'var(--app-primary)',
                searchPlaceholder: 'Search categories…',
                primaryAction: {
                    label: 'New Category',
                    icon: <Plus size={16} strokeWidth={2.6} />,
                    onClick: () => openAddModal(),
                },
                secondaryActions: [
                    { label: 'Cleanup', icon: <FolderTree size={14} />, href: '/inventory/maintenance?tab=category' },
                ],
                kpis: [
                    { label: 'Total', value: stats.total, icon: <Layers size={13} />, color: 'var(--app-primary)' },
                    { label: 'Root', value: stats.roots, icon: <FolderTree size={13} />, color: 'var(--app-success, #10b981)' },
                    { label: 'Leaf', value: stats.leafCount, icon: <GitBranch size={13} />, color: '#8b5cf6' },
                    { label: 'Products', value: stats.totalProducts, icon: <Box size={13} />, color: 'var(--app-info, #3b82f6)' },
                    { label: 'Brands', value: stats.totalBrands, icon: <Paintbrush size={13} />, color: 'var(--app-warning, #f59e0b)' },
                    { label: 'Showing', value: stats.total, icon: <Search size={13} />, color: 'var(--app-muted-foreground)' },
                ],
                footerLeft: (
                    <>
                        <span>{stats.total} categories</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{stats.totalProducts.toLocaleString()} products</span>
                    </>
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
                    <ConfirmDialog
                        open={deleteTarget !== null}
                        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
                        onConfirm={handleConfirmDelete}
                        title={`Delete "${deleteTarget?.name}"?`}
                        description="This permanently removes the category."
                        confirmText="Delete"
                        variant="danger"
                    />
                    <MobileActionSheet
                        open={actionNode !== null}
                        onClose={() => setActionNode(null)}
                        title={actionNode?.name}
                        subtitle={actionNode ? `${actionNode.code || '—'} · Long-press menu` : undefined}
                        items={actionItems}
                    />
                    <MobileMoveDialog
                        node={moveNode}
                        allCategories={data}
                        onClose={() => setMoveNode(null)}
                    />
                </>
            }
            sheet={
                <MobileBottomSheet
                    open={sheetNode !== null}
                    onClose={() => setSheetNode(null)}
                    initialSnap="peek">
                    {sheetNode && (
                        <CategoryDetailPanel
                            node={sheetNode}
                            onEdit={(n) => { setSheetNode(null); openEditModal(n) }}
                            onAdd={(pid) => { setSheetNode(null); openAddModal(pid) }}
                            onDelete={(n) => { setSheetNode(null); requestDelete(n) }}
                            allCategories={data}
                            initialTab={sheetTab}
                            onClose={() => setSheetNode(null)}
                        />
                    )}
                </MobileBottomSheet>
            }>
            {({ searchQuery, expandAll, expandKey }) => {
                const filtered = searchQuery.trim()
                    ? data.filter((a: any) => {
                        const q = searchQuery.toLowerCase()
                        return a.name?.toLowerCase().includes(q)
                            || a.code?.toLowerCase().includes(q)
                            || a.short_name?.toLowerCase().includes(q)
                    })
                    : data

                const tree = buildTree(filtered)

                if (tree.length === 0) {
                    return (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <FolderTree size={40} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground mb-1">
                                {searchQuery ? 'No matching categories' : 'No categories yet'}
                            </p>
                            <p className="text-[12px] text-app-muted-foreground mb-5 max-w-xs">
                                {searchQuery ? 'Try a different search term.' : 'Tap + to create your first category.'}
                            </p>
                            {!searchQuery && (
                                <button onClick={() => openAddModal()}
                                    className="px-5 py-2.5 rounded-xl bg-app-primary text-white text-sm font-bold active:scale-95 transition-transform"
                                    style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                    <Plus size={16} className="inline mr-1.5" />Create First Category
                                </button>
                            )}
                        </div>
                    )
                }

                return tree.map((node: CategoryNode) => (
                    <MobileCategoryRow
                        key={`${node.id}-${expandKey}`}
                        node={node}
                        level={0}
                        searchQuery={searchQuery}
                        forceExpanded={expandAll}
                        selected={sheetNode?.id === node.id}
                        onOpenSheet={openSheet}
                        onEdit={openEditModal}
                        onAdd={openAddModal}
                        onDelete={requestDelete}
                        onLongPress={openActionMenu}
                    />
                ))
            }}
        </MobileMasterPage>
    )
}
