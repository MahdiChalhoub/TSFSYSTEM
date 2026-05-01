'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import {
    Ruler, Plus, Layers, GitBranch, Package, Scale, Search,
    Eye, Pencil, Trash2, Copy, ArrowRightLeft, Wrench,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteUnit } from '@/app/actions/inventory/units'
import { DeleteConflictDialog } from '@/components/ui/DeleteConflictDialog'
import { erpFetch } from '@/lib/erp-api'
import { buildTree } from '@/lib/utils/tree'
import { UnitFormModal } from '@/components/admin/UnitFormModal'
import { UnitCalculator } from '@/components/admin/UnitCalculator'
import { MobileMasterPage } from '@/components/mobile/MobileMasterPage'
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet'
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet'
import { MobileUnitRow } from './MobileUnitRow'
import { PageTour } from '@/components/ui/PageTour'
import '@/lib/tours/definitions/inventory-units-mobile'
import type { UnitNode } from '../components/UnitRow'

type DeleteUnitResult = {
    success: boolean
    conflict?: unknown
    message?: string
    actionHint?: string
}

type DeleteConflictState = { conflict: unknown; source: UnitNode } | null

export function MobileUnitsClient({ initialUnits }: { initialUnits: UnitNode[] }) {
    const router = useRouter()
    const [, startTransition] = useTransition()
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [formKey, setFormKey] = useState(0)
    const [editingUnit, setEditingUnit] = useState<UnitNode | null>(null)
    const [parentPresetId, setParentPresetId] = useState<number | undefined>(undefined)
    const [deleteTarget, setDeleteTarget] = useState<UnitNode | null>(null)
    const [sheetNode, setSheetNode] = useState<UnitNode | null>(null)
    const [actionNode, setActionNode] = useState<UnitNode | null>(null)
    const [showCalc, setShowCalc] = useState(false)

    const data = initialUnits

    const stats = useMemo(() => {
        const base = data.filter((u) => !u.base_unit).length
        const derived = data.filter((u) => u.base_unit).length
        const totalProducts = data.reduce((s, u) => s + (u.product_count || 0), 0)
        const scaleUnits = data.filter((u) => u.needs_balance).length
        return { total: data.length, base, derived, totalProducts, scaleUnits }
    }, [data])

    const openForm = useCallback((parentId?: number) => {
        setEditingUnit(null); setParentPresetId(parentId); setFormKey(k => k + 1); setIsFormOpen(true)
    }, [])
    const openEditForm = useCallback((u: UnitNode) => {
        setEditingUnit(u); setParentPresetId(undefined); setFormKey(k => k + 1); setIsFormOpen(true)
    }, [])
    const closeForm = useCallback(() => setIsFormOpen(false), [])

    const openSheet = useCallback((n: UnitNode) => setSheetNode(n), [])
    const openActionMenu = useCallback((n: UnitNode) => setActionNode(n), [])
    const requestDelete = useCallback((u: UnitNode) => setDeleteTarget(u), [])

    const [deleteConflict, setDeleteConflict] = useState<DeleteConflictState>(null)

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        const source = deleteTarget
        setDeleteTarget(null)
        startTransition(async () => {
            const result = (await deleteUnit(source.id)) as DeleteUnitResult
            if (result?.success) { toast.success(`"${source.name}" deleted`); router.refresh(); return }
            if (result?.conflict) {
                setDeleteConflict({ conflict: result.conflict, source })
                return
            }
            toast.error(result?.message || 'Failed to delete')
        })
    }

    const handleMigrateAndDelete = async (targetId: number) => {
        const source = deleteConflict?.source
        if (!source) return
        try {
            await erpFetch('/units/move_products/', {
                method: 'POST',
                body: JSON.stringify({ source_unit_id: source.id, target_unit_id: targetId }),
            })
            const delRes = (await deleteUnit(source.id, { force: true })) as DeleteUnitResult
            if (delRes?.success) {
                toast.success(`Migrated & deleted "${source.name}"`)
                setDeleteConflict(null); router.refresh()
            } else {
                toast.error(delRes?.message || 'Delete failed after migration')
            }
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Migration failed')
        }
    }

    const handleForceDelete = async () => {
        const source = deleteConflict?.source
        if (!source) return
        const res = (await deleteUnit(source.id, { force: true })) as DeleteUnitResult
        if (res?.success) {
            toast.success(`"${source.name}" force-deleted`)
            setDeleteConflict(null); router.refresh()
        } else {
            toast.error(res?.message || 'Delete failed')
        }
    }

    const unitTargets = useMemo(() => {
        const sourceId = deleteConflict?.source?.id
        return data
            .filter((u) => u.id !== sourceId)
            .map((u) => ({ id: u.id, name: u.name, code: u.code }))
    }, [data, deleteConflict])

    const actionItems = useMemo(() => {
        if (!actionNode) return []
        const isParent = !!(actionNode.children && actionNode.children.length > 0)
        return [
            { key: 'view', label: 'Details', hint: 'Info & stats', icon: <Eye size={16} />, variant: 'grid' as const, onClick: () => openSheet(actionNode) },
            { key: 'add', label: 'Add derived', hint: 'Sub-unit', icon: <Plus size={16} />, variant: 'grid' as const, onClick: () => openForm(actionNode.id) },
            { key: 'edit', label: 'Edit', icon: <Pencil size={16} />, onClick: () => openEditForm(actionNode) },
            { key: 'copy', label: 'Copy code', hint: actionNode.code || '—', icon: <Copy size={16} />, onClick: () => {
                try { navigator.clipboard?.writeText(actionNode.code || String(actionNode.id)); toast.success('Copied') }
                catch { toast.error('Copy failed') }
            } },
            { key: 'delete', label: isParent ? 'Delete (locked)' : 'Delete', hint: isParent ? 'Remove derived units first' : undefined, icon: <Trash2 size={16} />, destructive: true, disabled: isParent, onClick: () => requestDelete(actionNode) },
        ]
    }, [actionNode, openSheet, openForm, openEditForm, requestDelete])

    return (
        <MobileMasterPage
            config={{
                title: 'Units of Measure',
                subtitle: `${stats.total} units · hierarchical conversions`,
                icon: <Ruler size={20} />,
                iconColor: 'var(--app-info, #3b82f6)',
                tourId: 'inventory-units-mobile',
                searchPlaceholder: 'Search by name, code, or type…',
                primaryAction: {
                    label: 'New Unit',
                    icon: <Plus size={16} strokeWidth={2.6} />,
                    onClick: () => openForm(),
                },
                secondaryActions: [
                    {
                        label: showCalc ? 'Hide Calculator' : 'Calculator',
                        icon: <ArrowRightLeft size={14} />,
                        onClick: () => setShowCalc(s => !s),
                    },
                    { label: 'Cleanup', icon: <Wrench size={14} />, href: '/inventory/maintenance?tab=unit' },
                ],
                kpis: [
                    { label: 'Total', value: stats.total, icon: <Layers size={13} />, color: 'var(--app-primary)' },
                    { label: 'Base', value: stats.base, icon: <Ruler size={13} />, color: 'var(--app-info, #3b82f6)' },
                    { label: 'Derived', value: stats.derived, icon: <GitBranch size={13} />, color: 'var(--app-info)' },
                    { label: 'Products', value: stats.totalProducts, icon: <Package size={13} />, color: 'var(--app-success, #10b981)' },
                    { label: 'Scale', value: stats.scaleUnits, icon: <Scale size={13} />, color: 'var(--app-warning, #f59e0b)' },
                    { label: 'Showing', value: stats.total, icon: <Search size={13} />, color: 'var(--app-muted-foreground)' },
                ],
                footerLeft: (
                    <>
                        <span>{stats.total} units</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{stats.base} base</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{stats.derived} derived</span>
                    </>
                ),
                onRefresh: async () => {
                    router.refresh()
                    await new Promise(r => setTimeout(r, 600))
                },
            }}
            modals={
                <>
                    <UnitFormModal
                        key={formKey}
                        isOpen={isFormOpen}
                        onClose={closeForm}
                        potentialParents={data as Record<string, unknown>[]}
                        unit={editingUnit ? (editingUnit as Record<string, unknown>) : undefined}
                        baseUnitId={parentPresetId ?? null}
                    />
                    <ConfirmDialog
                        open={deleteTarget !== null}
                        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                        onConfirm={handleConfirmDelete}
                        title={`Delete "${deleteTarget?.name}"?`}
                        description="This permanently removes the unit. Ensure no products are using it."
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
                    <PageTour tourId="inventory-units-mobile" renderButton={false} />
                    <DeleteConflictDialog
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- conflict shape is server-derived; the dialog narrows internally
                        conflict={(deleteConflict?.conflict ?? null) as any}
                        sourceName={deleteConflict?.source?.name || ''}
                        entityName="unit"
                        targets={unitTargets}
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
                        <MobileUnitDetail
                            node={sheetNode}
                            onEdit={(n) => { setSheetNode(null); openEditForm(n) }}
                            onAdd={(pid) => { setSheetNode(null); openForm(pid) }}
                            onDelete={(n) => { setSheetNode(null); requestDelete(n) }}
                            onClose={() => setSheetNode(null)}
                        />
                    )}
                </MobileBottomSheet>
            }>
            {({ searchQuery, expandAll, expandKey }) => {
                const q = searchQuery.trim().toLowerCase()
                const filtered = q
                    ? data.filter((u) =>
                        u.name?.toLowerCase().includes(q)
                        || u.code?.toLowerCase().includes(q)
                        || u.short_name?.toLowerCase().includes(q)
                        || u.type?.toLowerCase().includes(q)
                    )
                    : data

                const tree = buildTree(filtered, 'base_unit') as UnitNode[]

                if (tree.length === 0) {
                    return (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <Ruler size={40} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="font-bold text-app-muted-foreground mb-1"
                                style={{ fontSize: 'var(--tp-lg)' }}>
                                {q ? 'No matching units' : 'No units yet'}
                            </p>
                            <p className="text-app-muted-foreground mb-5 max-w-xs"
                                style={{ fontSize: 'var(--tp-md)' }}>
                                {q ? 'Try a different search term.' : 'Tap + to create your first base unit.'}
                            </p>
                        </div>
                    )
                }

                return (
                    <>
                        {showCalc && (
                            <div className="animate-in slide-in-from-top-2 duration-200 mb-3">
                                <UnitCalculator units={data.map((u) => ({ ...u, code: u.code ?? '' }))} />
                            </div>
                        )}
                        {tree.map((node) => (
                            <MobileUnitRow
                                key={`${node.id}-${expandKey}`}
                                node={node}
                                level={0}
                                searchQuery={searchQuery}
                                forceExpanded={expandAll}
                                selected={sheetNode?.id === node.id}
                                onOpenSheet={openSheet}
                                onEdit={openEditForm}
                                onAdd={openForm}
                                onDelete={requestDelete}
                                onLongPress={openActionMenu}
                            />
                        ))}
                    </>
                )
            }}
        </MobileMasterPage>
    )
}

/* Inline minimal detail sheet — keeps Phase 3 scope tight */
interface MobileUnitDetailProps {
    node: UnitNode
    onEdit: (n: UnitNode) => void
    onAdd: (parentId?: number) => void
    onDelete: (n: UnitNode) => void   // wired by caller; not consumed here yet
    onClose: () => void
}

function MobileUnitDetail({ node, onEdit, onAdd, onClose }: MobileUnitDetailProps) {
    const isBase = !node.base_unit
    const productCount = node.product_count ?? 0
    const childCount = node.children?.length ?? 0
    const conv = node.conversion_factor ?? 1

    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 px-3 pt-2 pb-3 flex items-center gap-2"
                style={{
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-info, #3b82f6) 10%, var(--app-surface)), var(--app-surface))',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                }}>
                <div className="flex items-center justify-center flex-shrink-0 rounded-xl"
                    style={{
                        width: 40, height: 40,
                        background: 'linear-gradient(135deg, var(--app-info, #3b82f6), color-mix(in srgb, var(--app-info, #3b82f6) 70%, var(--app-accent)))',
                        boxShadow: '0 4px 14px color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)',
                        color: '#fff',
                    }}>
                    <Ruler size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-app-foreground truncate leading-tight" style={{ fontSize: 'var(--tp-2xl)' }}>
                        {node.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        {node.code && (
                            <span className="font-mono font-bold" style={{ fontSize: 'var(--tp-sm)', color: 'var(--app-info, #3b82f6)' }}>
                                {node.code}
                            </span>
                        )}
                        {isBase && (
                            <span className="font-bold uppercase tracking-wide rounded-full px-2 py-0.5"
                                style={{
                                    fontSize: 'var(--tp-xxs)',
                                    background: 'color-mix(in srgb, var(--app-info, #3b82f6) 14%, transparent)',
                                    color: 'var(--app-info, #3b82f6)',
                                }}>
                                Base
                            </span>
                        )}
                    </div>
                </div>
                <button onClick={onClose}
                    className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
                    style={{
                        width: 36, height: 36,
                        color: 'var(--app-muted-foreground)',
                        background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                    }}
                    aria-label="Close">
                    <Package size={16} />
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                <div className="rounded-2xl overflow-hidden"
                    style={{
                        background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    }}>
                    {[
                        ['Type', node.type || '—'],
                        ['Conversion', isBase ? '×1 (base)' : `×${conv}`],
                        ['Short name', node.short_name || '—'],
                        ['Derived units', String(childCount)],
                        ['Products using', String(productCount)],
                        ['Needs balance', node.needs_balance ? 'Yes (scale)' : 'No'],
                    ].map(([label, value], i) => (
                        <div key={label}
                            className="flex items-center justify-between gap-3 px-3 py-2.5"
                            style={{ borderTop: i === 0 ? undefined : '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
                            <span className="font-bold uppercase tracking-wide text-app-muted-foreground"
                                style={{ fontSize: 'var(--tp-xxs)' }}>{label}</span>
                            <span className="font-bold text-app-foreground truncate text-right"
                                style={{ fontSize: 'var(--tp-md)' }}>{value}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2"
                style={{
                    borderTop: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                    background: 'var(--app-surface)',
                }}>
                <button
                    onClick={() => onAdd(node.id)}
                    className="flex items-center justify-center gap-1.5 rounded-xl active:scale-[0.97] transition-transform font-bold flex-shrink-0"
                    style={{
                        fontSize: 'var(--tp-md)',
                        height: 42, padding: '0 14px',
                        color: 'var(--app-primary)',
                        background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)',
                    }}>
                    <Plus size={14} /> Derived
                </button>
                <button
                    onClick={() => onEdit(node)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl active:scale-[0.98] transition-transform font-bold"
                    style={{
                        fontSize: 'var(--tp-md)',
                        height: 42,
                        color: '#fff',
                        background: 'var(--app-primary)',
                        boxShadow: '0 2px 10px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                    }}>
                    <Pencil size={14} /> Edit
                </button>
            </div>
        </div>
    )
}
