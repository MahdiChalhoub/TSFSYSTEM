'use client'

import { useState, useMemo, useCallback, useRef, useTransition } from 'react'
import {
    Plus, Ruler, Layers, Package, GitBranch,
    Scale, ArrowRightLeft, Wrench,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteUnit } from '@/app/actions/inventory/units'
import { UnitFormModal } from '@/components/admin/UnitFormModal'
import { UnitCalculator } from '@/components/admin/UnitCalculator'
import { BalanceBarcodeConfigModal } from '@/components/admin/BalanceBarcodeConfigModal'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import { PageTour } from '@/components/ui/PageTour'
import '@/lib/tours/definitions/inventory-units'
import { DeleteConflictDialog } from '@/components/ui/DeleteConflictDialog'
import { erpFetch } from '@/lib/erp-api'

import { UnitRow, type UnitNode } from './components/UnitRow'
import { UnitDetailPanel } from './components/UnitDetailPanel'
import { buildUnitsDataTools } from './_lib/dataTools'

type DeleteUnitResult = {
    success: boolean
    message?: string
    conflict?: unknown
    actionHint?: string
}

type DeleteConflictState = { conflict: unknown; source: UnitNode }

type RenderPropsRef = {
    setExpandAll?: (v: boolean) => void
    setExpandKey?: (fn: (k: number) => number) => void
    setSidebarNode?: (n: UnitNode | null) => void
    setSidebarTab?: (tab: string) => void
}

/* ═══════════════════════════════════════════════════════════
 *  UnitsClient — thin consumer; TreeMasterPage owns search,
 *  KPI filtering, tree build, and empty-state. This file only
 *  supplies data + row + modals + delete-conflict flow.
 * ═══════════════════════════════════════════════════════════ */
export default function UnitsClient({ initialUnits, currentUser }: { initialUnits: UnitNode[]; currentUser?: { is_staff?: boolean; is_superuser?: boolean } | null }) {
    const canDeleteBaseUnit = !!(currentUser?.is_staff || currentUser?.is_superuser)
    const router = useRouter()
    const [, startTransition] = useTransition()
    const data = initialUnits
    const dataAsRecords = data as unknown as Array<Record<string, unknown>>
    const asUnit = (item: Record<string, unknown>) => item as unknown as UnitNode
    const [showCalc, setShowCalc] = useState(false)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [showBarcodeConfig, setShowBarcodeConfig] = useState(false)
    const [editingUnit, setEditingUnit] = useState<(UnitNode & { _parentId?: number }) | null>(null)
    const [formKey, setFormKey] = useState(0)
    const [deleteTarget, setDeleteTarget] = useState<UnitNode | null>(null)
    // Bulk-delete confirmation. The `clear` callback wipes the toolbar
    // selection after a run; we keep it on the request so the dialog can
    // call it without re-deriving from current state.
    const [bulkDeleteRequest, setBulkDeleteRequest] = useState<{ ids: number[]; clear: () => void } | null>(null)
    const [bulkDeleting, setBulkDeleting] = useState(false)
    const handleBulkDelete = async () => {
        if (!bulkDeleteRequest) return
        const { ids, clear } = bulkDeleteRequest
        setBulkDeleting(true)
        let ok = 0, fail = 0
        for (const id of ids) {
            const res = await deleteUnit(id) as DeleteUnitResult
            if (res?.success) ok++; else fail++
        }
        setBulkDeleting(false)
        setBulkDeleteRequest(null)
        if (ok) toast.success(`Deleted ${ok} unit${ok === 1 ? '' : 's'}`)
        if (fail) toast.error(`${fail} unit${fail === 1 ? '' : 's'} failed — usually products still reference them`)
        clear()
        router.refresh()
    }
    const [deleteConflict, setDeleteConflict] = useState<DeleteConflictState | null>(null)

    const openForm = useCallback((parentId?: number) => {
        setEditingUnit(parentId ? ({ _parentId: parentId } as UnitNode & { _parentId: number }) : null)
        setFormKey(k => k + 1)
        setIsFormOpen(true)
    }, [])
    const openEditForm = useCallback((u: UnitNode) => { setEditingUnit(u); setFormKey(k => k + 1); setIsFormOpen(true) }, [])

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        const source = deleteTarget
        setDeleteTarget(null)
        startTransition(async () => {
            const result = await deleteUnit(source.id) as DeleteUnitResult
            if (result?.success) { toast.success(`"${source.name}" deleted`); router.refresh(); return }
            if (result?.conflict) { setDeleteConflict({ conflict: result.conflict, source }); return }
            const msg = result?.message || 'Failed to delete'
            const hint = result?.actionHint
            if (hint) toast.error(msg, { description: hint, duration: 8000 })
            else toast.error(msg, { duration: 6000 })
        })
    }

    const handleMigrateAndDelete = async (targetId: number) => {
        const source = deleteConflict?.source
        if (!source) return
        try {
            const moveRes = await erpFetch('/units/move_products/', {
                method: 'POST',
                body: JSON.stringify({ source_unit_id: source.id, target_unit_id: targetId }),
            }) as { success?: boolean; message?: string } | null
            if (moveRes && moveRes.success === false) { toast.error(moveRes.message || 'Migration failed — delete aborted'); return }
            const delRes = await deleteUnit(source.id, { force: true }) as DeleteUnitResult
            if (delRes?.success) { toast.success(`Products migrated and "${source.name}" deleted`); setDeleteConflict(null); router.refresh() }
            else { toast.error(delRes?.message || 'Delete failed after migration') }
        } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Migration failed') }
    }

    const handleForceDeleteUnit = async () => {
        const source = deleteConflict?.source
        if (!source) return
        const res = await deleteUnit(source.id, { force: true }) as DeleteUnitResult
        if (res?.success) { toast.success(`"${source.name}" force-deleted`); setDeleteConflict(null); router.refresh() }
        else { toast.error(res?.message || 'Delete failed') }
    }

    const unitMigrationTargets = useMemo(() => {
        const sourceId = deleteConflict?.source?.id
        return data.filter((u) => u.id !== sourceId).map((u) => ({ id: u.id, name: u.name, code: u.code }))
    }, [data, deleteConflict])

    const renderPropsRef = useRef<RenderPropsRef | null>(null)
    const tourStepActions = useMemo(() => ({
        5: () => { renderPropsRef.current?.setExpandAll?.(true); renderPropsRef.current?.setExpandKey?.((k: number) => k + 1) },
        6: () => {
            const firstBase = data.find((u) => !u.base_unit)
            if (firstBase) { renderPropsRef.current?.setSidebarNode?.(firstBase); renderPropsRef.current?.setSidebarTab?.('overview') }
        },
        8: () => { renderPropsRef.current?.setSidebarTab?.('products') },
        9: () => { renderPropsRef.current?.setSidebarTab?.('packages') },
        10: () => { renderPropsRef.current?.setSidebarTab?.('calculator') },
        11: () => { renderPropsRef.current?.setSidebarNode?.(null) },
    }), [data])

    return (
        <TreeMasterPage
            config={{
                title: 'Units of Measure',
                subtitle: (_, all) => `${all.length} Units · Hierarchical Conversions`,
                icon: <Ruler size={20} />,
                iconColor: 'var(--app-info)',
                tourId: 'inventory-units',
                searchPlaceholder: 'Search by name, code, or type...',
                primaryAction: { label: 'New Unit', icon: <Plus size={14} />, onClick: () => openForm() },
                dataTools: buildUnitsDataTools(data),
                secondaryActions: [
                    { label: 'Calculator', icon: <ArrowRightLeft size={13} />, onClick: () => setShowCalc(p => !p), active: showCalc, activeColor: 'var(--app-info)', dataTour: 'unit-calc-btn' },
                    { label: 'Variable Barcode', icon: <Scale size={13} />, onClick: () => setShowBarcodeConfig(true), dataTour: 'unit-barcode-btn' },
                    { label: 'Cleanup', icon: <Wrench size={13} />, href: '/inventory/maintenance?tab=unit' },
                ],
                columnHeaders: [
                    { label: 'Unit', width: 'auto', sortKey: 'name' },
                    {
                        label: 'Sub', width: '40px', hideOnMobile: true,
                        sortKey: 'sub_count',
                        sortAccessor: (u: any) => (data as any[]).filter(x => x.base_unit === u.id).length,
                    },
                    { label: 'Conv.', width: '56px', color: 'var(--app-info)', hideOnMobile: true, sortKey: 'conversion_factor' },
                    { label: 'Pkgs', width: '56px', color: 'var(--app-primary)', hideOnMobile: true, sortKey: 'packaging_count' },
                    { label: 'Products', width: '48px', color: 'var(--app-success)', hideOnMobile: true, sortKey: 'product_count' },
                ],

                // ── Template owns filtering (parent link for Units is `base_unit`) ──
                data: dataAsRecords,
                searchFields: ['name', 'code', 'short_name', 'type'],
                treeParentKey: 'base_unit',
                selectable: true,
                onBulkDelete: (ids, clear) => {
                    // Stash the selection so the confirmation dialog can act
                    // on the same set even if the user changes selection while
                    // the modal is open. `clear` is captured so the dialog can
                    // wipe the toolbar after a successful run.
                    setBulkDeleteRequest({ ids, clear })
                },
                kpiPredicates: {
                    base: (u) => !asUnit(u).base_unit,
                    derived: (u) => !!asUnit(u).base_unit,
                    products: (u) => (asUnit(u).product_count || 0) > 0,
                    scale: (u) => !!asUnit(u).needs_balance,
                },

                kpis: [
                    {
                        label: 'Total', icon: <Layers size={12} />, color: 'var(--app-primary)',
                        filterKey: 'all', hint: 'Show all units (clear filters)',
                        value: (_, all) => all.length,
                    },
                    {
                        label: 'Base', icon: <Ruler size={12} />, color: 'var(--app-info)',
                        filterKey: 'base', hint: 'Only base units (no parent)',
                        value: (filtered) => filtered.filter((u) => !asUnit(u).base_unit).length,
                    },
                    {
                        label: 'Derived', icon: <GitBranch size={12} />, color: 'var(--app-info)',
                        filterKey: 'derived', hint: 'Only derived units (with parent)',
                        value: (filtered) => filtered.filter((u) => !!asUnit(u).base_unit).length,
                    },
                    {
                        label: 'Products', icon: <Package size={12} />, color: 'var(--app-success)',
                        filterKey: 'products', hint: 'Only units with products',
                        value: (filtered) => filtered.reduce((s: number, u) => s + (asUnit(u).product_count || 0), 0),
                    },
                    {
                        label: 'Scale', icon: <Scale size={12} />, color: 'var(--app-warning)',
                        filterKey: 'scale', hint: 'Only balance/scale units',
                        value: (filtered) => filtered.filter((u) => asUnit(u).needs_balance).length,
                    },
                ],
                emptyState: {
                    icon: <Ruler size={36} />,
                    title: (hasSearch) => hasSearch ? 'No matching units' : 'No units defined yet',
                    subtitle: (hasSearch) => hasSearch
                        ? 'Try a different search term.'
                        : 'Create a base unit like "Piece" or "KG" to get started.',
                    actionLabel: 'Create First Unit',
                },
                footerLeft: (_, all) => (
                    <>
                        <span>{all.length} defined units</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{all.filter((u) => !asUnit(u).base_unit).length} base</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{all.filter((u) => asUnit(u).base_unit).length} derived</span>
                    </>
                ),
            }}
            modals={<>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- UnitFormModal accepts onSuccess at runtime; its type omits it. */}
                <UnitFormModal
                    key={formKey}
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    {...({ onSuccess: () => { setIsFormOpen(false); router.refresh() }, potentialParents: data } as any)}
                />
                <BalanceBarcodeConfigModal isOpen={showBarcodeConfig} onClose={() => setShowBarcodeConfig(false)} />
                <PageTour tourId="inventory-units" stepActions={tourStepActions} renderButton={false} />
                <DeleteConflictDialog
                    conflict={(deleteConflict?.conflict ?? null) as React.ComponentProps<typeof DeleteConflictDialog>['conflict']}
                    sourceName={deleteConflict?.source?.name || ''}
                    entityName="unit"
                    targets={unitMigrationTargets}
                    onMigrate={handleMigrateAndDelete}
                    onForceDelete={handleForceDeleteUnit}
                    onCancel={() => setDeleteConflict(null)}
                />
                <ConfirmDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }} onConfirm={handleConfirmDelete}
                    title={`Delete "${deleteTarget?.name}"?`} description="This will permanently remove this unit. Make sure no products are using it." confirmText="Delete" variant="danger" />
                <ConfirmDialog
                    open={bulkDeleteRequest !== null}
                    onOpenChange={(open) => { if (!open && !bulkDeleting) setBulkDeleteRequest(null) }}
                    onConfirm={handleBulkDelete}
                    title={`Delete ${bulkDeleteRequest?.ids.length ?? 0} unit${(bulkDeleteRequest?.ids.length ?? 0) === 1 ? '' : 's'}?`}
                    description="Each unit is checked individually — units with linked products are kept (and reported back) so you can fix them and retry. Base units require staff to delete."
                    confirmText={bulkDeleting ? 'Deleting…' : 'Delete'}
                    variant="danger" />
            </>}
            aboveTree={showCalc ? (
                <div className="animate-in slide-in-from-top-2 duration-200 px-4 pt-3 pb-2"
                    style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <UnitCalculator units={data as unknown as React.ComponentProps<typeof UnitCalculator>['units']} variant="embedded" />
                </div>
            ) : undefined}
            detailPanel={(node, { tab, onClose, onPin }) => (
                <UnitDetailPanel node={asUnit(node)} onEdit={openEditForm} onAdd={openForm} onDelete={(n: UnitNode) => setDeleteTarget(n)} allUnits={data} initialTab={tab} onClose={onClose} onPin={onPin} />
            )}
        >
            {(renderProps) => {
                const { tree, expandKey, expandAll, searchQuery, isSelected, openNode, selectedIds, toggleSelect } = renderProps
                renderPropsRef.current = renderProps as unknown as RenderPropsRef

                return tree.map((rawNode) => {
                    const node = asUnit(rawNode)
                    return (
                    <div key={`${node.id}-${expandKey}`}
                        className={`rounded-xl transition-all duration-300 ${isSelected(rawNode) ? 'ring-2 ring-app-primary/40 bg-app-primary/[0.03] shadow-sm' : ''}`}>
                        <UnitRow
                            node={node}
                            level={0}
                            onEdit={openEditForm}
                            onAdd={openForm}
                            onDelete={(n: UnitNode) => setDeleteTarget(n)}
                            onViewProducts={(n: UnitNode) => openNode(n as unknown as Record<string, unknown>, 'products')}
                            onSelect={(n: UnitNode) => openNode(n as unknown as Record<string, unknown>, 'overview')}
                            searchQuery={searchQuery}
                            forceExpanded={expandAll}
                            allUnits={data}
                            selectable
                            isCheckedFn={(id: number) => selectedIds.has(id)}
                            onToggleCheck={toggleSelect}
                            canDeleteBaseUnit={canDeleteBaseUnit}
                        />
                    </div>
                    )
                })
            }}
        </TreeMasterPage>
    )
}
