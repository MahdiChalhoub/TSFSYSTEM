// @ts-nocheck
'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import {
    FolderTree, Plus, Layers, GitBranch, Box, Paintbrush, Search,
    Eye, Pencil, Trash2, Move, Copy, Package, Tag, CornerDownRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteCategory } from '@/app/actions/inventory/categories'
import { DeleteConflictDialog } from '@/components/ui/DeleteConflictDialog'
import { erpFetch } from '@/lib/erp-api'
import { buildTree } from '@/lib/utils/tree'
import { CategoryFormModal } from '@/components/admin/categories/CategoryFormModal'
import { MobileMasterPage } from '@/components/mobile/MobileMasterPage'
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet'
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet'
import { MobileCategoryRow } from './MobileCategoryRow'
import { MobileMoveDialog } from './MobileMoveDialog'
import { MobileBreadcrumb } from './MobileBreadcrumb'
import { MobileCategoryDetailSheet } from './MobileCategoryDetailSheet'
import type { CategoryNode, PanelTab } from '../components/types'
import { PageTour } from '@/components/ui/PageTour'
import '@/lib/tours/definitions/inventory-categories-mobile'

export function MobileCategoriesClient({ initialCategories }: { initialCategories: any[] }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [modalState, setModalState] = useState<{ open: boolean; category?: CategoryNode; parentId?: number }>({ open: false })
    const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null)
    const [sheetNode, setSheetNode] = useState<CategoryNode | null>(null)
    const [sheetTab, setSheetTab] = useState<PanelTab>('overview')
    const [actionNode, setActionNode] = useState<CategoryNode | null>(null)
    const [moveNode, setMoveNode] = useState<CategoryNode | null>(null)
    const [scopeId, setScopeId] = useState<number | null>(null)

    const data = initialCategories

    // Index for O(1) lookups
    const byId = useMemo(() => {
        const m = new Map<number, any>()
        for (const c of data) m.set(c.id, c)
        return m
    }, [data])

    // Breadcrumb: path from root to the scoped node
    const breadcrumbPath = useMemo(() => {
        if (scopeId == null) return []
        const path: any[] = []
        let cur = byId.get(scopeId)
        while (cur) {
            path.unshift(cur)
            cur = cur.parent != null ? byId.get(cur.parent) : null
        }
        return path
    }, [scopeId, byId])

    // Descendants of scopeId (inclusive)
    const scopedData = useMemo(() => {
        if (scopeId == null) return data
        const included = new Set<number>([scopeId])
        let grew = true
        while (grew) {
            grew = false
            for (const c of data) {
                if (c.parent != null && included.has(c.parent) && !included.has(c.id)) {
                    included.add(c.id); grew = true
                }
            }
        }
        return data.filter(c => included.has(c.id)).map(c => {
            // the scope root should render as a root — strip its parent for buildTree
            if (c.id === scopeId) return { ...c, parent: null }
            return c
        })
    }, [data, scopeId])

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

    const drillInto = useCallback((n: CategoryNode | null) => {
        setScopeId(n?.id ?? null)
    }, [])

    const actionItems = useMemo(() => {
        if (!actionNode) return []
        const isParent = !!(actionNode.children && actionNode.children.length > 0)
        const childCountInData = data.filter((c: any) => c.parent === actionNode.id).length
        const hasSubtree = childCountInData > 0
        return [
            { key: 'view', label: 'Overview', hint: 'Details', icon: <Eye size={16} />, variant: 'grid', onClick: () => openSheet(actionNode, 'overview') },
            { key: 'products', label: 'Products', hint: `${actionNode.product_count ?? 0}`, icon: <Package size={16} />, variant: 'grid', onClick: () => openSheet(actionNode, 'products') },
            { key: 'attrs', label: 'Attributes', hint: `${actionNode.attribute_count ?? 0}`, icon: <Tag size={16} />, variant: 'grid', onClick: () => openSheet(actionNode, 'attributes') },
            ...(hasSubtree ? [{ key: 'drill', label: 'Drill in', hint: `${childCountInData} children`, icon: <CornerDownRight size={16} />, variant: 'grid' as const, onClick: () => drillInto(actionNode) }] : []),
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
    }, [actionNode, openSheet, openAddModal, openEditModal, requestDelete, drillInto, data])

    const [deleteConflict, setDeleteConflict] = useState<any>(null)

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        const source = deleteTarget
        setDeleteTarget(null)
        startTransition(async () => {
            const result = await deleteCategory(source.id)
            if (result?.success) { toast.success(`"${source.name}" deleted`); router.refresh(); return }
            if ((result as any)?.conflict) {
                setDeleteConflict({ conflict: (result as any).conflict, source })
                return
            }
            toast.error(result?.message || 'Failed to delete')
        })
    }

    const handleMigrateAndDelete = async (targetId: number) => {
        const source = deleteConflict?.source
        if (!source) return
        try {
            await erpFetch('inventory/categories/move_products/', {
                method: 'POST',
                body: JSON.stringify({ source_category_id: source.id, target_category_id: targetId }),
            })
            const delRes = await deleteCategory(source.id, { force: true })
            if (delRes?.success) {
                toast.success(`Migrated & deleted "${source.name}"`)
                setDeleteConflict(null); router.refresh()
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
            setDeleteConflict(null); router.refresh()
        } else {
            toast.error(res?.message || 'Delete failed')
        }
    }

    const migrationTargets = useMemo(() => {
        const sourceId = deleteConflict?.source?.id
        return data
            .filter((c: any) => c.id !== sourceId)
            .map((c: any) => ({ id: c.id, name: c.name, code: c.code }))
    }, [data, deleteConflict])

    return (
        <MobileMasterPage
            config={{
                title: scopeId != null
                    ? (byId.get(scopeId)?.name ?? 'Categories')
                    : 'Categories',
                subtitle: scopeId != null
                    ? `Scoped · ${scopedData.length} nodes`
                    : `${data.length} Nodes · Tree`,
                icon: <FolderTree size={20} />,
                iconColor: 'var(--app-primary)',
                tourId: 'inventory-categories-mobile',
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
                onRefresh: async () => {
                    router.refresh()
                    await new Promise(r => setTimeout(r, 600))
                },
            }}
            belowTopBar={breadcrumbPath.length > 0 ? (
                <MobileBreadcrumb path={breadcrumbPath} onNavigate={(n) => drillInto(n)} />
            ) : undefined}
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
                    <PageTour tourId="inventory-categories-mobile" renderButton={false} />
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
            sheet={
                <MobileBottomSheet
                    open={sheetNode !== null}
                    onClose={() => setSheetNode(null)}
                    initialSnap="peek">
                    {sheetNode && (
                        <MobileCategoryDetailSheet
                            node={sheetNode}
                            allCategories={data}
                            initialTab={sheetTab}
                            onEdit={(n) => { setSheetNode(null); openEditModal(n) }}
                            onAdd={(pid) => { setSheetNode(null); openAddModal(pid) }}
                            onDelete={(n) => { setSheetNode(null); requestDelete(n) }}
                            onOpenChild={(child) => { setSheetNode(child); setSheetTab('overview') }}
                            onClose={() => setSheetNode(null)}
                        />
                    )}
                </MobileBottomSheet>
            }>
            {({ searchQuery, expandAll, expandKey }) => {
                const source = scopedData
                const filtered = searchQuery.trim()
                    ? source.filter((a: any) => {
                        const q = searchQuery.toLowerCase()
                        return a.name?.toLowerCase().includes(q)
                            || a.code?.toLowerCase().includes(q)
                            || a.short_name?.toLowerCase().includes(q)
                    })
                    : source

                const tree = buildTree(filtered)

                if (tree.length === 0) {
                    return (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <FolderTree size={40} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground mb-1">
                                {searchQuery ? 'No matching categories' : 'No categories yet'}
                            </p>
                            <p className="text-tp-md text-app-muted-foreground mb-5 max-w-xs">
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

                return (
                    <>
                        {searchQuery.trim() && (
                            <div className="mb-2 px-3 py-2 flex items-center justify-between rounded-xl"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)',
                                }}>
                                <span className="text-tp-md font-bold text-app-foreground truncate">
                                    <span className="font-black tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>
                                        {filtered.length}
                                    </span>
                                    <span className="text-app-muted-foreground"> of {source.length} · matches "</span>
                                    <span className="font-black text-app-foreground">{searchQuery}</span>
                                    <span className="text-app-muted-foreground">"</span>
                                </span>
                            </div>
                        )}
                        {tree.map((node: CategoryNode) => (
                            <MobileCategoryRow
                                key={`${node.id}-${expandKey}-${scopeId ?? 'all'}`}
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
                                onDrillIn={drillInto}
                            />
                        ))}
                    </>
                )
            }}
        </MobileMasterPage>
    )
}
