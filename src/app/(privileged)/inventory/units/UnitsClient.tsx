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
export default function UnitsClient({ initialUnits }: { initialUnits: UnitNode[] }) {
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
                dataTools: {
                    title: 'Unit Data',
                    exportFilename: 'units',
                    exportColumns: [
                        { key: 'name', label: 'Name' },
                        { key: 'code', label: 'Code' },
                        { key: 'short_name', label: 'Short Name', format: (item) => asUnit(item).short_name || '' },
                        { key: 'type', label: 'Type' },
                        { key: 'conversion_factor', label: 'Conversion', format: (item) => asUnit(item).conversion_factor ?? 1 },
                        { key: 'base_unit_code', label: 'Base Unit', format: (item) => {
                            const u = asUnit(item)
                            const base = u.base_unit ? data.find((x) => x.id === u.base_unit) : null
                            return base ? (base.code || base.name || '') : ''
                        }},
                        { key: 'allow_fraction', label: 'Allow Fraction', format: (item) => (item as { allow_fraction?: boolean }).allow_fraction ? 'true' : 'false' },
                        { key: 'needs_balance', label: 'Needs Balance', format: (item) => asUnit(item).needs_balance ? 'true' : 'false' },
                        { key: 'product_count', label: 'Products', format: (item) => asUnit(item).product_count || 0 },
                    ],
                    print: {
                        title: 'Units of Measure',
                        subtitle: 'Conversion Tree',
                        prefKey: 'print.units',
                        sortBy: 'code',
                        columns: [
                            { key: 'name', label: 'Name', defaultOn: true },
                            { key: 'code', label: 'Code', mono: true, defaultOn: true, width: '90px' },
                            { key: 'short', label: 'Short', mono: true, defaultOn: true, width: '80px' },
                            { key: 'type', label: 'Type', defaultOn: true, width: '80px' },
                            { key: 'conv', label: 'Conv.', mono: true, align: 'right', defaultOn: true, width: '80px' },
                            { key: 'base', label: 'Base Unit', mono: true, defaultOn: true, width: '90px' },
                            { key: 'products', label: 'Products', align: 'right', defaultOn: true, width: '80px' },
                        ],
                        rowMapper: (item) => {
                            const u = asUnit(item)
                            return {
                                name: u.name,
                                code: u.code || '',
                                short: u.short_name || '',
                                type: u.type || '',
                                conv: u.conversion_factor ?? 1,
                                base: (() => {
                                    const base = u.base_unit ? data.find((x) => x.id === u.base_unit) : null
                                    return base ? (base.code || base.name || '') : ''
                                })(),
                                products: u.product_count || 0,
                            }
                        },
                    },
                    import: {
                        entity: 'unit',
                        endpoint: 'units/',
                        columns: [
                            { name: 'name',              required: true,  desc: 'Display name',                                            example: 'Kilogram' },
                            { name: 'code',              required: true,  desc: 'Unique unit code',                                        example: 'KG' },
                            { name: 'short_name',        required: false, desc: 'Short label (e.g. on labels)',                            example: 'kg' },
                            { name: 'type',              required: false, desc: 'COUNT / WEIGHT / VOLUME / LENGTH / AREA / TIME / OTHER',  example: 'WEIGHT' },
                            { name: 'conversion_factor', required: false, desc: 'How many base units this is worth (default 1)',           example: '1' },
                            { name: 'base_unit_code',    required: false, desc: 'Code of the base unit this derives from (leave blank for base)', example: 'G' },
                            { name: 'allow_fraction',    required: false, desc: 'true / false — allow decimal qtys (default true)',        example: 'true' },
                            { name: 'needs_balance',     required: false, desc: 'true / false — uses scale at POS (default false)',         example: 'false' },
                        ],
                        sampleCsv:
                            'name,code,short_name,type,conversion_factor,base_unit_code,allow_fraction,needs_balance\n' +
                            'Gram,G,g,WEIGHT,1,,true,false\n' +
                            'Kilogram,KG,kg,WEIGHT,1000,G,true,true\n' +
                            'Piece,PC,pc,COUNT,1,,false,false',
                        previewColumns: [
                            { key: 'name',        label: 'Name' },
                            { key: 'code',        label: 'Code', mono: true },
                            { key: 'type',        label: 'Type', mono: true },
                            { key: 'conversion_factor', label: 'Conv.', mono: true },
                            { key: 'base_unit_code',    label: 'Base', mono: true },
                        ],
                        buildPayload: (row: Record<string, string>) => {
                            const baseCode = (row.base_unit_code || '').trim()
                            const baseUnit = baseCode
                                ? (data.find((u) => (u.code || '').toLowerCase() === baseCode.toLowerCase())?.id ?? null)
                                : null
                            const truthy = (v: string | undefined, def: boolean) => {
                                if (v == null || v === '') return def
                                return /^(true|1|yes|y)$/i.test(v.trim())
                            }
                            return {
                                name: row.name,
                                code: row.code,
                                short_name: row.short_name || null,
                                type: (row.type || 'COUNT').toUpperCase(),
                                conversion_factor: row.conversion_factor ? Number(row.conversion_factor) : 1,
                                base_unit: baseUnit,
                                allow_fraction: truthy(row.allow_fraction, true),
                                needs_balance: truthy(row.needs_balance, false),
                            }
                        },
                        tip: <><strong>Tip:</strong> Import base units first (leave <code>base_unit_code</code> blank), then derived units referencing them by code.</>,
                    },
                },
                secondaryActions: [
                    { label: 'Calculator', icon: <ArrowRightLeft size={13} />, onClick: () => setShowCalc(p => !p), active: showCalc, activeColor: 'var(--app-info)' },
                    { label: 'Variable Barcode', icon: <Scale size={13} />, onClick: () => setShowBarcodeConfig(true) },
                    { label: 'Cleanup', icon: <Wrench size={13} />, href: '/inventory/maintenance?tab=unit' },
                ],
                columnHeaders: [
                    { label: 'Unit', width: 'auto' },
                    { label: 'Sub', width: '40px', hideOnMobile: true },
                    { label: 'Conv.', width: '56px', color: 'var(--app-info)', hideOnMobile: true },
                    { label: 'Pkgs', width: '56px', color: 'var(--app-primary)', hideOnMobile: true },
                    { label: 'Products', width: '48px', color: 'var(--app-success)', hideOnMobile: true },
                ],

                // ── Template owns filtering (parent link for Units is `base_unit`) ──
                data: dataAsRecords,
                searchFields: ['name', 'code', 'short_name', 'type'],
                treeParentKey: 'base_unit',
                selectable: true,
                onBulkDelete: async (ids, clear) => {
                    if (!confirm(`Delete ${ids.length} unit(s)? This cannot be undone.`)) return
                    let ok = 0, fail = 0
                    for (const id of ids) {
                        const res = await deleteUnit(id) as DeleteUnitResult
                        if (res?.success) ok++; else fail++
                    }
                    if (ok) toast.success(`Deleted ${ok} unit(s)`)
                    if (fail) toast.error(`${fail} unit(s) failed to delete`)
                    clear(); router.refresh()
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
                        />
                    </div>
                    )
                })
            }}
        </TreeMasterPage>
    )
}
