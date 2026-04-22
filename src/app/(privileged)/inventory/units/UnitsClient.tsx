// @ts-nocheck
'use client'

import { useState, useMemo, useCallback, useRef, useTransition } from 'react'
import {
    Plus, Ruler, Search, Layers, Package, GitBranch,
    Scale, ArrowRightLeft, Wrench
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteUnit } from '@/app/actions/inventory/units'
import { buildTree } from '@/lib/utils/tree'
import { UnitFormModal } from '@/components/admin/UnitFormModal'
import { UnitCalculator } from '@/components/admin/UnitCalculator'
import { BalanceBarcodeConfigModal } from '@/components/admin/BalanceBarcodeConfigModal'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import { PageTour } from '@/components/ui/PageTour'
import '@/lib/tours/definitions/inventory-units'
import { DeleteConflictDialog } from '@/components/ui/DeleteConflictDialog'
import { erpFetch } from '@/lib/erp-api'

import { UnitRow } from './components/UnitRow'
import { UnitDetailPanel } from './components/UnitDetailPanel'

/* ═══════════════════════════════════════════════════════════
 *  MAIN PAGE — using TreeMasterPage template
 * ═══════════════════════════════════════════════════════════ */
export default function UnitsClient({ initialUnits }: { initialUnits: any[] }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const data = initialUnits
    const [showCalc, setShowCalc] = useState(false)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [showBarcodeConfig, setShowBarcodeConfig] = useState(false)
    const [editingUnit, setEditingUnit] = useState<any>(null)
    const [formKey, setFormKey] = useState(0)
    const [deleteTarget, setDeleteTarget] = useState<any>(null)
    const [deleteConflict, setDeleteConflict] = useState<any>(null)

    const openForm = useCallback((parentId?: number) => { setEditingUnit(parentId ? { _parentId: parentId } : null); setFormKey(k => k + 1); setIsFormOpen(true) }, [])
    const openEditForm = useCallback((u: any) => { setEditingUnit(u); setFormKey(k => k + 1); setIsFormOpen(true) }, [])

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        const source = deleteTarget
        setDeleteTarget(null)
        startTransition(async () => {
            const result = await deleteUnit(source.id)
            if (result?.success) { toast.success(`"${source.name}" deleted`); router.refresh(); return }
            if ((result as any)?.conflict) {
                setDeleteConflict({ conflict: (result as any).conflict, source })
                return
            }
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
            const moveRes = await erpFetch('/units/move_products/', {
                method: 'POST',
                body: JSON.stringify({ source_unit_id: source.id, target_unit_id: targetId }),
            })
            if (moveRes && moveRes.success === false) {
                toast.error(moveRes.message || 'Migration failed — delete aborted'); return
            }
            const delRes = await deleteUnit(source.id, { force: true })
            if (delRes?.success) {
                toast.success(`Products migrated and "${source.name}" deleted`)
                setDeleteConflict(null); router.refresh()
            } else {
                toast.error(delRes?.message || 'Delete failed after migration')
            }
        } catch (e: any) {
            toast.error(e?.message || 'Migration failed')
        }
    }

    const handleForceDeleteUnit = async () => {
        const source = deleteConflict?.source
        if (!source) return
        const res = await deleteUnit(source.id, { force: true })
        if (res?.success) {
            toast.success(`"${source.name}" force-deleted`)
            setDeleteConflict(null); router.refresh()
        } else {
            toast.error(res?.message || 'Delete failed')
        }
    }

    const unitMigrationTargets = useMemo(() => {
        const sourceId = deleteConflict?.source?.id
        return data
            .filter((u: any) => u.id !== sourceId)
            .map((u: any) => ({ id: u.id, name: u.name, code: u.code }))
    }, [data, deleteConflict])

    // Search + KPI filter state
    const [filterQuery, setFilterQuery] = useState('')
    const [kpiFilter, setKpiFilter] = useState<string | null>(null)

    const matches = useCallback((u: any, q: string) => {
        const needle = q.trim().toLowerCase()
        if (!needle) return true
        return (u.name || '').toLowerCase().includes(needle)
            || (u.code || '').toLowerCase().includes(needle)
            || (u.short_name || '').toLowerCase().includes(needle)
            || (u.type || '').toLowerCase().includes(needle)
    }, [])

    const kpiPredicate = useCallback((u: any): boolean => {
        if (!kpiFilter) return true
        if (kpiFilter === 'base') return !u.base_unit
        if (kpiFilter === 'derived') return !!u.base_unit
        if (kpiFilter === 'products') return (u.product_count || 0) > 0
        if (kpiFilter === 'scale') return !!u.needs_balance
        return true
    }, [kpiFilter])

    const filteredData = useMemo(
        () => data.filter((u: any) => matches(u, filterQuery) && kpiPredicate(u)),
        [data, filterQuery, matches, kpiPredicate]
    )

    const stats = useMemo(() => {
        const source = filteredData
        const baseCount = source.filter((u: any) => !u.base_unit).length
        const derivedCount = source.filter((u: any) => u.base_unit).length
        const totalProducts = source.reduce((s: number, u: any) => s + (u.product_count || 0), 0)
        const scaleUnits = source.filter((u: any) => u.needs_balance).length
        return {
            total: data.length,
            showing: source.length,
            base: baseCount,
            derived: derivedCount,
            totalProducts,
            scaleUnits,
            isFiltered: filterQuery.trim().length > 0 || kpiFilter !== null,
        }
    }, [data, filteredData, filterQuery, kpiFilter])

    // Tour step actions
    const renderPropsRef = useRef<any>(null)
    const tourStepActions = useMemo(() => ({
        5: () => { renderPropsRef.current?.setExpandAll(true); renderPropsRef.current?.setExpandKey((k: number) => k + 1) },
        6: () => {
            const firstBase = data.find((u: any) => !u.base_unit)
            if (firstBase) { renderPropsRef.current?.setSidebarNode(firstBase); renderPropsRef.current?.setSidebarTab('overview') }
        },
        8: () => { renderPropsRef.current?.setSidebarTab('products') },
        9: () => { renderPropsRef.current?.setSidebarTab('packages') },
        10: () => { renderPropsRef.current?.setSidebarTab('calculator') },
        11: () => { renderPropsRef.current?.setSidebarNode(null) },
    }), [data])

    return (
        <TreeMasterPage
            config={{
                title: 'Units & Packaging',
                subtitle: `${stats.total} Units · Hierarchical Conversions`,
                icon: <Ruler size={20} />,
                iconColor: 'var(--app-info)',
                tourId: 'inventory-units',
                onSearchChange: setFilterQuery,
                onKpiFilterChange: (key) => {
                    if (key === 'all') { setKpiFilter(null); setFilterQuery(''); return }
                    setKpiFilter(key)
                },
                kpis: [
                    {
                        label: 'Total', value: stats.total, icon: <Layers size={12} />, color: 'var(--app-primary)',
                        filterKey: 'all', active: kpiFilter === null && filterQuery.trim().length === 0,
                        hint: 'Show all units (clear filters)',
                    },
                    { label: 'Base', value: stats.base, icon: <Ruler size={12} />, color: 'var(--app-info)', filterKey: 'base', active: kpiFilter === 'base', hint: 'Show only base units' },
                    { label: 'Derived', value: stats.derived, icon: <GitBranch size={12} />, color: '#8b5cf6', filterKey: 'derived', active: kpiFilter === 'derived', hint: 'Show only derived units' },
                    { label: 'Products', value: stats.totalProducts, icon: <Package size={12} />, color: 'var(--app-success)', filterKey: 'products', active: kpiFilter === 'products', hint: 'Show only units with products' },
                    { label: 'Scale', value: stats.scaleUnits, icon: <Scale size={12} />, color: 'var(--app-warning)', filterKey: 'scale', active: kpiFilter === 'scale', hint: 'Show only balance-connected units' },
                    {
                        label: stats.isFiltered ? 'Showing' : 'All',
                        value: stats.isFiltered ? `${stats.showing}/${stats.total}` : stats.total,
                        icon: <Search size={12} />,
                        color: stats.isFiltered ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                    },
                ],
                searchPlaceholder: 'Search by name, code, or type...',
                primaryAction: { label: 'New Unit', icon: <Plus size={14} />, onClick: () => openForm() },
                secondaryActions: [
                    { label: 'Calculator', icon: <ArrowRightLeft size={13} />, onClick: () => setShowCalc(p => !p), active: showCalc, activeColor: 'var(--app-info)' },
                    { label: 'Barcode', icon: <Scale size={13} />, onClick: () => setShowBarcodeConfig(true) },
                    { label: 'Cleanup', icon: <Wrench size={13} />, href: '/inventory/maintenance?tab=unit' },
                ],
                columnHeaders: [
                    { label: 'Unit', width: 'auto' },
                    { label: 'Sub', width: '40px', hideOnMobile: true },
                    { label: 'Conv.', width: '56px', color: '#8b5cf6', hideOnMobile: true },
                    { label: 'Products', width: '48px', color: 'var(--app-success)', hideOnMobile: true },
                ],
                footerLeft: (<><span>{stats.total} defined units</span><span style={{ color: 'var(--app-border)' }}>·</span><span>{stats.base} base</span><span style={{ color: 'var(--app-border)' }}>·</span><span>{stats.derived} derived</span></>),
            }}
            modals={<>
                <UnitFormModal key={formKey} isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSuccess={() => { setIsFormOpen(false); router.refresh() }} potentialParents={data} />
                <BalanceBarcodeConfigModal isOpen={showBarcodeConfig} onClose={() => setShowBarcodeConfig(false)} />
                <PageTour tourId="inventory-units" stepActions={tourStepActions} renderButton={false} />
                <DeleteConflictDialog
                    conflict={deleteConflict?.conflict || null}
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
                    <UnitCalculator units={data} variant="embedded" />
                </div>
            ) : undefined}
            detailPanel={(node, { tab, onClose, onPin }) => (
                <UnitDetailPanel node={node} onEdit={openEditForm} onAdd={openForm} onDelete={(n: any) => setDeleteTarget(n)} allUnits={data} initialTab={tab} onClose={onClose} onPin={onPin} />
            )}
        >
            {(renderProps) => {
                const { searchQuery, expandAll, expandKey, splitPanel, pinnedSidebar, selectedNode, setSelectedNode, sidebarNode, setSidebarNode, setSidebarTab, setPanelTab } = renderProps
                renderPropsRef.current = renderProps
                let filtered = data
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase()
                    filtered = filtered.filter((u: any) => u.name?.toLowerCase().includes(q) || u.code?.toLowerCase().includes(q) || u.short_name?.toLowerCase().includes(q) || u.type?.toLowerCase().includes(q))
                }
                filtered = filtered.filter(kpiPredicate)
                const tree = buildTree(filtered, 'base_unit')
                return tree.length > 0 ? (
                    tree.map((node: any) => (
                        <div key={`${node.id}-${expandKey}`} className={`rounded-xl transition-all duration-300 ${((splitPanel || pinnedSidebar) ? selectedNode?.id === node.id : sidebarNode?.id === node.id) ? 'ring-2 ring-app-primary/40 bg-app-primary/[0.03] shadow-sm' : ''}`}>
                            <UnitRow node={node} level={0} onEdit={openEditForm} onAdd={openForm} onDelete={(n: any) => setDeleteTarget(n)}
                                onViewProducts={(n: any) => { if (splitPanel || pinnedSidebar) { setSelectedNode(n); setPanelTab('products') } else { setSidebarNode(n); setSidebarTab('products') } }}
                                onSelect={(n: any) => { if (splitPanel || pinnedSidebar) { setSelectedNode(n) } else { setSidebarNode(n); setSidebarTab('overview') } }}
                                searchQuery={searchQuery} forceExpanded={expandAll} allUnits={data} />
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                        <Ruler size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                        <p className="text-tp-md font-semibold text-app-muted-foreground mb-1">{searchQuery ? 'No matching units' : 'No units defined yet'}</p>
                        <p className="text-tp-sm text-app-muted-foreground mb-5 max-w-xs">{searchQuery ? 'Try a different search term.' : 'Create a base unit like "Piece" or "KG" to get started.'}</p>
                        {!searchQuery && <button onClick={() => openForm()} className="px-4 py-2 rounded-xl bg-app-primary text-white text-tp-md font-semibold hover:brightness-110 transition-all"><Plus size={16} className="inline mr-1.5" />Create First Unit</button>}
                    </div>
                )
            }}
        </TreeMasterPage>
    )
}
