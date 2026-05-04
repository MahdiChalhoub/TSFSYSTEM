'use client'

import { useState, useMemo, useCallback, useEffect, useTransition } from 'react'
import {
    Ruler, Plus, Layers, GitBranch, Package, Scale, Search,
    Eye, Pencil, Trash2, Copy, ArrowRightLeft, Wrench, X,
    Box, Calculator, History, Loader2, ChevronRight, User as UserIcon,
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
import { buildUnitsDataTools } from '../_lib/dataTools'

type DeleteUnitResult = {
    success: boolean
    conflict?: unknown
    message?: string
    actionHint?: string
}

type DeleteConflictState = { conflict: unknown; source: UnitNode } | null

export function MobileUnitsClient({ initialUnits, currentUser }: { initialUnits: UnitNode[]; currentUser?: { is_staff?: boolean; is_superuser?: boolean } | null }) {
    const canDeleteBaseUnit = !!(currentUser?.is_staff || currentUser?.is_superuser)
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
        const isBaseUnit = actionNode.base_unit == null
        // Base-unit deletion is staff-only (backend mirrors this with a 403).
        const showDelete = !isBaseUnit || canDeleteBaseUnit
        return [
            { key: 'view', label: 'Details', hint: 'Info & stats', icon: <Eye size={16} />, variant: 'grid' as const, onClick: () => openSheet(actionNode) },
            { key: 'add', label: 'Add derived', hint: 'Sub-unit', icon: <Plus size={16} />, variant: 'grid' as const, onClick: () => openForm(actionNode.id) },
            { key: 'edit', label: 'Edit', icon: <Pencil size={16} />, onClick: () => openEditForm(actionNode) },
            { key: 'copy', label: 'Copy code', hint: actionNode.code || '—', icon: <Copy size={16} />, onClick: () => {
                try { navigator.clipboard?.writeText(actionNode.code || String(actionNode.id)); toast.success('Copied') }
                catch { toast.error('Copy failed') }
            } },
            ...(showDelete ? [
                { key: 'delete', label: isParent ? 'Delete (locked)' : 'Delete', hint: isParent ? 'Remove derived units first' : undefined, icon: <Trash2 size={16} />, destructive: true, disabled: isParent, onClick: () => requestDelete(actionNode) },
            ] : []),
        ]
    }, [actionNode, openSheet, openForm, openEditForm, requestDelete, canDeleteBaseUnit])

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
                // Mobile reuses the desktop dataTools factory verbatim — same
                // 2-pass importer, same id round-trip export, same column
                // specs. Keeps both surfaces in lockstep so a CSV exported
                // from mobile re-imports cleanly on desktop and vice versa.
                dataTools: buildUnitsDataTools(data),
                secondaryActions: [
                    {
                        label: showCalc ? 'Hide Calculator' : 'Calculator',
                        icon: <ArrowRightLeft size={14} />,
                        onClick: () => setShowCalc(s => !s),
                        dataTour: 'unit-calc-btn',
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
                            allUnits={data}
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

/**
 * MobileUnitDetail — full-parity sheet for a single unit
 *
 * Five tabs mirroring the desktop UnitDetailPanel:
 *   - Overview   (key/value list)
 *   - Packages   (UnitPackage templates linked to this unit)
 *   - Calculator (embedded UnitCalculator preset to this unit)
 *   - Audit      (kernel audit-trail timeline scoped to this unit)
 *
 * Each tab lazy-loads on first activation. The header carries the title /
 * code / Base badge; the footer keeps the existing Edit + Add-derived
 * action bar so the operator's primary verbs stay one tap away.
 */
type MobileTabId = 'overview' | 'packages' | 'calculator' | 'audit'

interface MobileUnitDetailProps {
    node: UnitNode
    allUnits: UnitNode[]
    onEdit: (n: UnitNode) => void
    onAdd: (parentId?: number) => void
    onDelete: (n: UnitNode) => void   // wired by caller; not consumed here yet
    onClose: () => void
}

function MobileUnitDetail({ node, allUnits, onEdit, onAdd, onClose }: MobileUnitDetailProps) {
    const isBase = !node.base_unit
    const productCount = node.product_count ?? 0
    const initialPackageCount = (node as { package_count?: number }).package_count ?? 0
    const childCount = node.children?.length ?? 0
    const conv = node.conversion_factor ?? 1
    const [tab, setTab] = useState<MobileTabId>('overview')

    // Reset to Overview whenever the operator opens a different unit.
    useEffect(() => { setTab('overview') }, [node.id])

    const tabs: { id: MobileTabId; label: string; icon: React.ReactNode; count?: number }[] = [
        { id: 'overview',   label: 'Overview',   icon: <Layers size={13} /> },
        { id: 'packages',   label: 'Packages',   icon: <Box size={13} />,        count: initialPackageCount || undefined },
        { id: 'calculator', label: 'Calc',       icon: <Calculator size={13} /> },
        { id: 'audit',      label: 'Audit',      icon: <History size={13} /> },
    ]

    return (
        <div className="flex flex-col h-full">
            {/* ── Header ── */}
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
                    <X size={16} />
                </button>
            </div>

            {/* ── Tab strip ── */}
            <div className="flex-shrink-0 px-2 py-2 flex items-center gap-1 overflow-x-auto custom-scrollbar"
                style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    background: 'var(--app-surface)',
                }}>
                {tabs.map(t => {
                    const active = tab === t.id
                    return (
                        <button key={t.id} type="button" onClick={() => setTab(t.id)}
                            className="flex-shrink-0 flex items-center gap-1.5 rounded-xl font-bold active:scale-[0.97] transition-all"
                            style={{
                                padding: '6px 11px',
                                fontSize: 'var(--tp-xs)',
                                background: active
                                    ? 'color-mix(in srgb, var(--app-info, #3b82f6) 14%, transparent)'
                                    : 'transparent',
                                color: active ? 'var(--app-info, #3b82f6)' : 'var(--app-muted-foreground)',
                                border: `1px solid ${active ? 'color-mix(in srgb, var(--app-info, #3b82f6) 35%, transparent)' : 'transparent'}`,
                            }}>
                            {t.icon}
                            {t.label}
                            {typeof t.count === 'number' && (
                                <span className="font-mono rounded-full px-1.5 py-0.5"
                                    style={{
                                        fontSize: 'var(--tp-xxs)',
                                        background: 'color-mix(in srgb, var(--app-foreground) 8%, transparent)',
                                        color: active ? 'var(--app-info, #3b82f6)' : 'var(--app-muted-foreground)',
                                    }}>
                                    {t.count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* ── Tab body ── */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {tab === 'overview' && (
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
                            ['Packages', String(initialPackageCount)],
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
                )}

                {tab === 'packages' && <MobileUnitPackagesPanel unitId={node.id} />}

                {tab === 'calculator' && (
                    <UnitCalculator
                        units={allUnits.map((u) => ({ ...u, code: u.code ?? '' }))}
                        defaultUnit={{ ...node, code: node.code ?? '' }}
                        variant="embedded"
                    />
                )}

                {tab === 'audit' && <MobileUnitAuditPanel unitId={node.id} />}
            </div>

            {/* ── Action bar ── */}
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


/* ─── Packages tab body ─── */
type UnitPackageRow = {
    id: number
    name?: string
    code?: string
    ratio?: number | string
    is_default?: boolean
}
function MobileUnitPackagesPanel({ unitId }: { unitId: number }) {
    const [rows, setRows] = useState<UnitPackageRow[]>([])
    const [loading, setLoading] = useState(true)
    useEffect(() => {
        let cancelled = false
        setLoading(true)
        erpFetch(`unit-packages/?unit=${unitId}`)
            .then((d: unknown) => {
                if (cancelled) return
                const list = Array.isArray(d) ? d : ((d as { results?: UnitPackageRow[] })?.results ?? [])
                setRows(list as UnitPackageRow[])
            })
            .catch(() => { if (!cancelled) setRows([]) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [unitId])
    if (loading) return <div className="flex items-center justify-center py-8"><Loader2 size={16} className="animate-spin text-app-muted-foreground" /></div>
    if (rows.length === 0) return (
        <div className="flex flex-col items-center justify-center py-10 text-center">
            <Box size={22} className="text-app-muted-foreground mb-2 opacity-40" />
            <p className="font-bold text-app-muted-foreground" style={{ fontSize: 'var(--tp-md)' }}>No package templates yet</p>
            <p className="text-app-muted-foreground mt-1 max-w-[260px]" style={{ fontSize: 'var(--tp-xs)' }}>
                Define standard pack sizes for this unit (e.g. Pack of 6) so products can adopt them.
            </p>
        </div>
    )
    return (
        <div className="rounded-2xl overflow-hidden divide-y" style={{ border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
            {rows.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-shrink-0 rounded-lg flex items-center justify-center"
                         style={{ width: 32, height: 32, background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                        <Box size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-app-foreground truncate" style={{ fontSize: 'var(--tp-md)' }}>{r.name || `Template ${r.id}`}</div>
                        <div className="flex items-center gap-2 text-app-muted-foreground mt-0.5" style={{ fontSize: 'var(--tp-xxs)' }}>
                            <span className="font-mono">×{r.ratio}</span>
                            {r.code && <span className="font-mono">{r.code}</span>}
                            {r.is_default && (
                                <span className="font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5"
                                    style={{ background: 'color-mix(in srgb, var(--app-success) 12%, transparent)', color: 'var(--app-success)' }}>
                                    Default
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}


/* ─── Audit tab body ─── */
type MobileAuditEntry = {
    id: number
    action: string
    timestamp: string
    username?: string
    field_changes?: { field_name: string; old_value: string | null; new_value: string | null }[]
}
function timeAgoMobile(ts: string): string {
    const ms = Date.now() - new Date(ts).getTime()
    if (Number.isNaN(ms)) return ts
    const m = Math.floor(ms / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 30) return `${d}d ago`
    return new Date(ts).toLocaleDateString()
}
function MobileUnitAuditPanel({ unitId }: { unitId: number }) {
    const [rows, setRows] = useState<MobileAuditEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)
        erpFetch(`inventory/audit-trail/?resource_type=unit&resource_id=${unitId}&limit=80`)
            .then((d: unknown) => {
                if (cancelled) return
                const list = Array.isArray(d) ? d : ((d as { results?: MobileAuditEntry[] })?.results ?? [])
                setRows(list as MobileAuditEntry[])
            })
            .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [unitId])
    if (loading) return <div className="flex items-center justify-center py-8"><Loader2 size={16} className="animate-spin text-app-muted-foreground" /></div>
    if (error) return <div className="text-app-muted-foreground py-4 text-center" style={{ fontSize: 'var(--tp-sm)' }}>Audit log unavailable.</div>
    if (rows.length === 0) return (
        <div className="flex flex-col items-center justify-center py-10 text-center">
            <History size={20} className="text-app-muted-foreground mb-2 opacity-40" />
            <p className="font-bold text-app-muted-foreground" style={{ fontSize: 'var(--tp-md)' }}>No history yet</p>
        </div>
    )
    return (
        <div className="space-y-2">
            <p className="font-bold uppercase tracking-wide text-app-muted-foreground" style={{ fontSize: 'var(--tp-xxs)' }}>
                {rows.length} event{rows.length === 1 ? '' : 's'}
            </p>
            {rows.map(e => {
                const tail = (e.action.split('.').pop() || '').toLowerCase()
                const tone =
                    tail === 'create' ? { bg: 'var(--app-success)', label: 'create' }
                    : tail === 'delete' ? { bg: 'var(--app-error)', label: 'delete' }
                    : { bg: 'var(--app-info, #3b82f6)', label: tail || e.action }
                return (
                    <div key={e.id} className="rounded-2xl p-2.5 space-y-1.5"
                         style={{ background: 'var(--app-bg)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold uppercase tracking-widest rounded-full px-2 py-0.5"
                                style={{ fontSize: 'var(--tp-xxs)', background: `color-mix(in srgb, ${tone.bg} 14%, transparent)`, color: tone.bg }}>
                                {tone.label}
                            </span>
                            <span className="flex items-center gap-1 text-app-muted-foreground" style={{ fontSize: 'var(--tp-xxs)' }}>
                                <UserIcon size={10} /><span className="truncate max-w-[100px]">{e.username || 'system'}</span>
                            </span>
                            <span className="text-app-muted-foreground" style={{ fontSize: 'var(--tp-xxs)' }}>
                                {timeAgoMobile(e.timestamp)}
                            </span>
                        </div>
                        {e.field_changes && e.field_changes.length > 0 && (
                            <div className="space-y-0.5">
                                {e.field_changes.map((fc, i) => (
                                    <div key={i} className="flex items-center gap-1 flex-wrap" style={{ fontSize: 'var(--tp-xs)' }}>
                                        <span className="font-mono font-bold text-app-foreground">{fc.field_name}</span>
                                        <span className="font-mono px-1 rounded text-app-muted-foreground" style={{ background: 'color-mix(in srgb, var(--app-error) 6%, transparent)', textDecoration: 'line-through' }}>
                                            {fc.old_value ?? '∅'}
                                        </span>
                                        <ChevronRight size={9} className="opacity-50" />
                                        <span className="font-mono px-1 rounded text-app-foreground" style={{ background: 'color-mix(in srgb, var(--app-success) 6%, transparent)' }}>
                                            {fc.new_value ?? '∅'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
