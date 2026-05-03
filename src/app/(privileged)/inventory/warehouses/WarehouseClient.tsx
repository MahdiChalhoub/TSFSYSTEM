'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
    Plus, Building2, Store, Warehouse as WarehouseIcon, Cloud,
    Layers, GitBranch, Package,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteWarehouse } from '@/app/actions/inventory/warehouses'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'

import WarehouseModal from './form'
import { WarehouseRow, type WarehouseNode } from './components/WarehouseRow'
import { WarehouseDetailPanel } from './components/WarehouseDetailPanel'

type DeleteResult = { success: boolean; message?: string; deactivated?: boolean; blockers?: string[] }

/* ═══════════════════════════════════════════════════════════
 *  WarehouseClient — thin TreeMasterPage consumer.
 *  Shared template owns: search, KPI filter, tree build,
 *  split / pinned / drawer panels, keyboard shortcuts,
 *  focus mode, empty state, compact mode, responsive columns.
 *  This file supplies: data, row, detail panel, form, delete.
 * ═══════════════════════════════════════════════════════════ */

export function WarehouseClient({
    initialWarehouses,
    countries = [],
    defaultCountryId = null,
}: {
    initialWarehouses: WarehouseNode[]
    countries?: { id: number; name: string; iso2: string }[]
    defaultCountryId?: number | null
}) {
    const router = useRouter()
    const [, startTransition] = useTransition()
    const data = initialWarehouses
    const dataAsRecords = data as unknown as Array<Record<string, unknown>>
    const asWarehouse = (item: Record<string, unknown>) => item as unknown as WarehouseNode

    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingWarehouse, setEditingWarehouse] = useState<WarehouseNode | null>(null)
    const [defaultParent, setDefaultParent] = useState<number | null>(null)
    const [formKey, setFormKey] = useState(0)
    const [deleteTarget, setDeleteTarget] = useState<WarehouseNode | null>(null)

    const openForm = useCallback((parentId?: number) => {
        setEditingWarehouse(null)
        setDefaultParent(parentId ?? null)
        setFormKey(k => k + 1)
        setIsFormOpen(true)
    }, [])

    const openEditForm = useCallback((w: WarehouseNode) => {
        setEditingWarehouse(w)
        setDefaultParent(null)
        setFormKey(k => k + 1)
        setIsFormOpen(true)
    }, [])

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        const target = deleteTarget
        setDeleteTarget(null)
        startTransition(async () => {
            try {
                const result = await deleteWarehouse(target.id) as DeleteResult
                if (!result.success) {
                    toast.error(result.message || 'Failed to remove location')
                } else if (result.deactivated) {
                    toast.warning(result.message || `"${target.name}" deactivated`, {
                        description: result.blockers?.join(', '),
                        duration: 6000,
                    })
                } else {
                    toast.success('Location permanently removed')
                }
                router.refresh()
            } catch {
                toast.error('Failed to remove location')
            }
        })
    }

    // Parent options for the form — only branches can parent children.
    const parentOptions = useMemo(
        () => data
            .filter((w) => w.location_type === 'BRANCH')
            .map((w) => {
                const ext = w as WarehouseNode & { country?: number | null; country_name?: string }
                return { id: w.id, name: w.name, country: ext.country ?? null, country_name: ext.country_name }
            }),
        [data],
    )

    return (
        <TreeMasterPage
            config={{
                title: 'Locations',
                subtitle: (_filtered, all) =>
                    `${all.length} locations · ${all.filter((w) => asWarehouse(w).location_type === 'BRANCH').length} branches · ${all.filter((w) => asWarehouse(w).can_sell).length} retail`,
                icon: <GitBranch size={20} />,
                iconColor: 'var(--app-primary)',
                searchPlaceholder: 'Search by name, code, or city...',
                primaryAction: { label: 'New Location', icon: <Plus size={14} />, onClick: () => openForm() },

                // Template owns filtering + tree build.
                data: dataAsRecords,
                searchFields: ['name', 'code', 'city', 'country_name', 'reference_code'],
                treeParentKey: 'parent',
                kpiPredicates: {
                    branch:    (w) => asWarehouse(w).location_type === 'BRANCH',
                    store:     (w) => asWarehouse(w).location_type === 'STORE',
                    warehouse: (w) => asWarehouse(w).location_type === 'WAREHOUSE',
                    virtual:   (w) => asWarehouse(w).location_type === 'VIRTUAL',
                    retail:    (w) => !!asWarehouse(w).can_sell,
                },

                kpis: [
                    {
                        label: 'Total', icon: <Layers size={12} />, color: 'var(--app-primary)',
                        filterKey: 'all', hint: 'Show everything',
                        value: (_, all) => all.length,
                    },
                    {
                        label: 'Branches', icon: <Building2 size={12} />, color: 'var(--app-success)',
                        filterKey: 'branch', hint: 'Only branch/site locations',
                        value: (f) => f.filter((w) => asWarehouse(w).location_type === 'BRANCH').length,
                    },
                    {
                        label: 'Stores', icon: <Store size={12} />, color: 'var(--app-info)',
                        filterKey: 'store', hint: 'Only retail stores',
                        value: (f) => f.filter((w) => asWarehouse(w).location_type === 'STORE').length,
                    },
                    {
                        label: 'Warehouses', icon: <WarehouseIcon size={12} />, color: 'var(--app-warning)',
                        filterKey: 'warehouse', hint: 'Only pure-storage warehouses',
                        value: (f) => f.filter((w) => asWarehouse(w).location_type === 'WAREHOUSE').length,
                    },
                    {
                        label: 'Virtual', icon: <Cloud size={12} />, color: 'var(--app-primary)',
                        filterKey: 'virtual', hint: 'Only virtual / transit locations',
                        value: (f) => f.filter((w) => asWarehouse(w).location_type === 'VIRTUAL').length,
                    },
                    {
                        label: 'Retail', icon: <Package size={12} />, color: 'var(--app-success)',
                        filterKey: 'retail', hint: 'Only POS-enabled locations',
                        value: (f) => f.filter((w) => !!asWarehouse(w).can_sell).length,
                    },
                ],
                columnHeaders: [
                    { label: 'Location', width: 'auto', sortKey: 'name' },
                    {
                        label: 'Sub', width: '40px', hideOnMobile: true,
                        sortKey: 'sub_count',
                        sortAccessor: (w: any) => (data as any[]).filter(x => x.parent === w.id).length,
                    },
                    { label: 'Country', width: '64px', hideOnMobile: true, sortKey: 'country' },
                    { label: 'SKUs', width: '48px', color: 'var(--app-primary)', hideOnMobile: true, sortKey: 'sku_count' },
                ],
                emptyState: {
                    icon: <GitBranch size={36} />,
                    title: (hasSearch) => hasSearch ? 'No matching locations' : 'No locations defined yet',
                    subtitle: (hasSearch) => hasSearch
                        ? 'Try a different search term.'
                        : 'Create a branch, then add stores / warehouses under it.',
                    actionLabel: 'Create First Location',
                },
                footerLeft: (_, all) => (
                    <>
                        <span>{all.length} locations</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{all.filter((w) => asWarehouse(w).location_type === 'BRANCH').length} branches</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{all.filter((w) => asWarehouse(w).can_sell).length} retail</span>
                    </>
                ),
            }}
            modals={<>
                {isFormOpen && (
                    <WarehouseModal
                        key={formKey}
                        warehouse={editingWarehouse}
                        parentOptions={parentOptions}
                        defaultParent={defaultParent}
                        countries={countries}
                        defaultCountryId={defaultCountryId}
                        onClose={() => setIsFormOpen(false)}
                        onSaved={() => { setIsFormOpen(false); router.refresh() }}
                    />
                )}
                <ConfirmDialog
                    open={deleteTarget !== null}
                    onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                    onConfirm={handleConfirmDelete}
                    title={`Delete "${deleteTarget?.name}"?`}
                    description="Children and inventory will block hard delete — the row will be deactivated instead if needed."
                    confirmText="Delete"
                    variant="danger"
                />
            </>}
            detailPanel={(node, { tab, onClose, onPin }) => (
                <WarehouseDetailPanel
                    node={node}
                    initialTab={tab}
                    onClose={onClose}
                    onPin={onPin}
                    onEdit={openEditForm}
                    onDelete={setDeleteTarget}
                    allLocations={data}
                />
            )}
        >
            {(renderProps) => {
                const { tree, expandKey, expandAll, searchQuery, isSelected, openNode } = renderProps
                return tree.map((node) => {
                    const w = asWarehouse(node)
                    return (
                    <div key={`${w.id}-${expandKey}`}
                        className={`rounded-xl transition-all duration-300 ${isSelected(node) ? 'ring-2 ring-app-primary/40 bg-app-primary/[0.03] shadow-sm' : ''}`}>
                        <WarehouseRow
                            node={w}
                            level={0}
                            onEdit={openEditForm}
                            onAdd={openForm}
                            onDelete={(n) => setDeleteTarget(n)}
                            onSelect={(n) => openNode(n as unknown as Record<string, unknown>, 'inventory')}
                            searchQuery={searchQuery}
                            forceExpanded={expandAll}
                        />
                    </div>
                    )
                })
            }}
        </TreeMasterPage>
    )
}
