'use client'

import { useState, useMemo, useCallback, useTransition, useRef, useEffect } from 'react'
import { prefetchNextCode } from '@/lib/sequences-client'
import { getCatalogueLanguages } from '@/lib/catalogue-languages'
import {
    Award, Plus, Layers, Package, Globe, FolderTree, X, Search, Pencil, Image as ImageIcon
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DeleteConflictDialog } from '@/components/ui/DeleteConflictDialog'
import { BrandFormModal } from '@/components/admin/BrandFormModal'
import { erpFetch } from '@/lib/erp-api'

// Import extracted components
import type { Brand, BrandPanelTab } from './components/types'
import { BrandRow } from './components/BrandRow'
import { BrandDetailPanel } from './components/BrandDetailPanel'
import { BulkActionBar } from './components/BulkActionBar'
import { BulkDialog } from './components/BulkDialog'

type Props = {
    brands: Brand[]
    countries: Array<Record<string, unknown>>
    categories: Array<Record<string, unknown>>
    attributes: Array<Record<string, unknown>>
}

/* ═══════════════════════════════════════════════════════════
 *  BrandsClient — flat TreeMasterPage consumer.
 *  Achieves parity with Categories module using extracted
 *  components and advanced bulk/conflict handling.
 * ═══════════════════════════════════════════════════════════ */
export function BrandsClient({ brands, countries, categories, attributes }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    
    // UI State
    const [modalOpen, setModalOpen] = useState(false)
    const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null)
    const [deleteConflict, setDeleteConflict] = useState<any>(null)
    const [bulkDialog, setBulkDialog] = useState<null | 'move' | 'delete'>(null)
    
    // Selection Ref for bulk actions
    const selectionRef = useRef<{ selectedIds: Set<number>; clearSelection: () => void }>({
        selectedIds: new Set(),
        clearSelection: () => {}
    })

    // Warm up the BRAND sequence + catalogue-languages caches on page
    // mount so the New / Edit dialog opens with the suggested reference
    // code AND the language tabs already painted on its first frame.
    // Mirrors what CategoriesClient does for the CATEGORY sequence.
    useEffect(() => {
        prefetchNextCode('BRAND')
        getCatalogueLanguages()
    }, [])

    // Data preparation — Brands are flat, so parent is always null
    const data = useMemo(() => brands.map(b => ({ ...b, parent: null })), [brands])
    const dataAsRecords = data as unknown as Array<Record<string, unknown>>
    const asBrand = (item: Record<string, unknown>) => item as unknown as Brand

    // Modals handlers
    const openNew = useCallback(() => { setEditingBrand(null); setModalOpen(true) }, [])
    const openEdit = useCallback((b: Brand) => { setEditingBrand(b); setModalOpen(true) }, [])
    const closeModal = useCallback(() => { setModalOpen(false); setEditingBrand(null) }, [])

    // Delete handling
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        const source = deleteTarget
        setDeleteTarget(null)
        startTransition(async () => {
            try {
                await erpFetch(`inventory/brands/${source.id}/`, { method: 'DELETE' })
                toast.success(`"${source.name}" deleted`)
                router.refresh()
            } catch (e: any) {
                if (e.status === 409 && e.data) {
                    setDeleteConflict({ conflict: e.data, source })
                } else {
                    toast.error(e.message || 'Failed to delete brand')
                }
            }
        })
    }

    const handleMigrateAndDelete = async (targetId: number) => {
        const source = deleteConflict?.source
        if (!source) return
        try {
            // Reassign products
            await erpFetch('inventory/brands/move_products/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_brand_id: source.id, target_brand_id: targetId }),
            })
            // Delete source
            await erpFetch(`inventory/brands/${source.id}/`, { method: 'DELETE' })
            toast.success(`Products migrated and "${source.name}" deleted`)
            setDeleteConflict(null)
            router.refresh()
        } catch (e: any) {
            toast.error(e.message || 'Migration failed')
        }
    }

    const handleForceDelete = async () => {
        const source = deleteConflict?.source
        if (!source) return
        try {
            await erpFetch(`inventory/brands/${source.id}/`, { method: 'DELETE' })
            toast.success(`"${source.name}" deleted (products unlinked)`)
            setDeleteConflict(null)
            router.refresh()
        } catch (e: any) {
            toast.error(e.message || 'Force delete failed')
        }
    }

    const migrationTargets = useMemo(() => {
        const sourceId = deleteConflict?.source?.id
        return brands.filter(b => b.id !== sourceId).map(b => ({ id: b.id, name: b.name }))
    }, [brands, deleteConflict])

    return (
        <>
            <TreeMasterPage
                config={{
                    title: 'Brands',
                    subtitle: (_, all) => `${all.length} manufacturers · taxonomy`,
                    icon: <Award size={20} />,
                    iconColor: 'var(--app-primary)',
                    searchPlaceholder: 'Search brands by name, short name… (Ctrl+K)',
                    primaryAction: { label: 'New Brand', icon: <Plus size={14} />, onClick: openNew },
                    dataTools: {
                        title: 'Brand Data',
                        exportFilename: 'brands',
                        exportColumns: [
                            { key: 'name', label: 'Name' },
                            { key: 'short_name', label: 'Short Name', format: (item) => asBrand(item).short_name || '' },
                            { key: 'countries', label: 'Countries', format: (item) => (asBrand(item).countries || []).map(c => c.name).join(' | ') },
                            { key: 'categories', label: 'Categories', format: (item) => (asBrand(item).categories || []).map(c => c.name).join(' | ') },
                            { key: 'product_count', label: 'Products', format: (item) => asBrand(item).product_count || 0 },
                        ],
                        print: {
                            title: 'Brands',
                            subtitle: 'Manufacturer Taxonomy',
                            prefKey: 'print.brands',
                            sortBy: 'name',
                            columns: [
                                { key: 'name', label: 'Name', defaultOn: true },
                                { key: 'short', label: 'Short Name', mono: true, defaultOn: true, width: '110px' },
                                { key: 'countries', label: 'Countries', defaultOn: true },
                                { key: 'cat_count', label: 'Cat #', align: 'right', defaultOn: true, width: '70px' },
                                { key: 'products', label: 'Products', align: 'right', defaultOn: true, width: '80px' },
                            ],
                            rowMapper: (item) => {
                                const b = asBrand(item)
                                return {
                                    name: b.name,
                                    short: b.short_name || '',
                                    countries: (b.countries || []).map(c => c.name).join(', '),
                                    cat_count: (b.categories || []).length,
                                    products: b.product_count || 0,
                                }
                            },
                        },
                        import: {
                            entity: 'brand',
                            endpoint: 'inventory/brands/',
                            columns: [
                                { name: 'name', required: true, desc: 'Brand name — unique per tenant', example: 'Nestle' },
                                { name: 'short_name', required: false, desc: 'Short abbreviation', example: 'NES' },
                                { name: 'reference_code', required: false, desc: 'Internal code', example: 'BRD-001' },
                            ],
                            sampleCsv: 'name,short_name,reference_code\nNestle,NES,BRD-101\nCoca Cola,COKE,BRD-102',
                            previewColumns: [
                                { key: 'name', label: 'Name' },
                                { key: 'short_name', label: 'Short', mono: true },
                            ],
                            buildPayload: (row: Record<string, string>) => ({
                                name: row.name,
                                short_name: row.short_name || null,
                                reference_code: row.reference_code || null,
                            }),
                            tip: <><strong>Note:</strong> Countries and categories are linked per-brand in the edit dialog after import.</>,
                        },
                    },
                    secondaryActions: [
                        { label: 'Reorganize', icon: <FolderTree size={13} />, href: '/inventory/maintenance?tab=brand' },
                    ],
                    // Header columns mirror the four chips on each row, in
                    // the same order and with widths sized to the chip
                    // tablets so the row reads as a structured grid: chip
                    // sits under its label, label sits over its chip.
                    columnHeaders: [
                        { label: 'Brand', width: 'auto', sortKey: 'name' },
                        { label: 'Products',   width: '95px',  color: 'var(--app-success)', hideOnMobile: true, sortKey: 'product_count' },
                        { label: 'Categories', width: '105px', color: 'var(--app-info)',    hideOnMobile: true, sortKey: 'category_count' },
                        { label: 'Countries',  width: '100px', color: 'var(--app-warning)', hideOnMobile: true, sortKey: 'country_count' },
                        { label: 'Attrs',      width: '75px',  color: 'var(--app-success)', hideOnMobile: true, sortKey: 'attribute_count' },
                    ],
                    data: dataAsRecords,
                    searchFields: ['name', 'short_name', 'reference_code'],
                    selectable: true,
                    onRefresh: () => router.refresh(),
                    kpiPredicates: {
                        withCategory: (item) => (asBrand(item).categories?.length || 0) > 0,
                        orphan: (item) => (asBrand(item).categories?.length || 0) === 0,
                        withCountry: (item) => (asBrand(item).countries?.length || 0) > 0,
                        products: (item) => (asBrand(item).product_count || 0) > 0,
                        logoless: (item) => !asBrand(item).logo,
                    },
                    kpis: [
                        {
                            label: 'Total', icon: <Layers size={11} />, color: 'var(--app-primary)',
                            filterKey: 'all', hint: 'Show all brands',
                            value: (_, all) => all.length,
                        },
                        {
                            label: 'Categorized', icon: <FolderTree size={11} />, color: 'var(--app-info)',
                            filterKey: 'withCategory', hint: 'Brands linked to categories',
                            value: (filtered) => filtered.filter((item) => (asBrand(item).categories?.length || 0) > 0).length,
                        },
                        {
                            label: 'Orphans', icon: <X size={11} />, color: 'var(--app-error)',
                            filterKey: 'orphan', hint: 'Brands with no category link',
                            value: (filtered) => filtered.filter((item) => (asBrand(item).categories?.length || 0) === 0).length,
                        },
                        {
                            label: 'Countries', icon: <Globe size={11} />, color: 'var(--app-warning)',
                            filterKey: 'withCountry', hint: 'Brands with country assignment',
                            value: (filtered) => filtered.filter((item) => (asBrand(item).countries?.length || 0) > 0).length,
                        },
                        {
                            label: 'Products', icon: <Package size={11} />, color: 'var(--app-success)',
                            filterKey: 'products', hint: 'Brands with products',
                            value: (filtered) => filtered.reduce((s: number, item) => s + (asBrand(item).product_count || 0), 0),
                        },
                        {
                            label: 'Logoless', icon: <ImageIcon size={11} />, color: 'var(--app-muted-foreground)',
                            filterKey: 'logoless', hint: 'Brands missing a logo',
                            value: (filtered) => filtered.filter((item) => !asBrand(item).logo).length,
                        },
                        {
                            label: 'Showing', icon: <Search size={11} />, color: 'var(--app-muted-foreground)',
                            value: (filtered, all) => filtered.length < all.length ? `${filtered.length}/${all.length}` : all.length,
                        },
                    ],
                    emptyState: {
                        icon: <Award size={36} />,
                        title: (hasSearch) => hasSearch ? 'No matching brands' : 'No brands yet',
                        subtitle: (hasSearch) => hasSearch
                            ? 'Try a different search term or clear filters.'
                            : 'Create the first brand to start organizing manufacturers.',
                        actionLabel: 'Create First Brand',
                    },
                    footerLeft: (_, all) => (
                        <div className="flex items-center gap-3 flex-wrap">
                            <span>{all.length} total brands</span>
                            <span style={{ color: 'var(--app-border)' }}>·</span>
                            <span>{all.reduce((s: number, item) => s + (asBrand(item).product_count || 0), 0).toLocaleString()} products</span>
                        </div>
                    ),
                }}
                modals={
                    <>
                        <BrandFormModal
                            isOpen={modalOpen}
                            onClose={closeModal}
                            brand={editingBrand || undefined}
                            countries={countries}
                            categories={categories}
                            attributes={attributes}
                        />
                        <ConfirmDialog
                            open={deleteTarget !== null}
                            onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
                            onConfirm={handleConfirmDelete}
                            title={`Delete "${deleteTarget?.name}"?`}
                            description="This permanently removes the brand. If products reference it, you'll be guided to migrate them."
                            confirmText="Delete"
                            variant="danger"
                        />
                        <DeleteConflictDialog
                            conflict={deleteConflict?.conflict || null}
                            sourceName={deleteConflict?.source?.name || ''}
                            entityName="brand"
                            targets={migrationTargets}
                            onMigrate={handleMigrateAndDelete}
                            onForceDelete={handleForceDelete}
                            onCancel={() => setDeleteConflict(null)}
                        />
                    </>
                }
                detailPanel={(node, { tab, onClose, onPin }) => (
                    <BrandDetailPanel
                        brand={node}
                        onEdit={openEdit}
                        onDelete={(b) => setDeleteTarget(b)}
                        initialTab={tab as BrandPanelTab}
                        onClose={onClose}
                        onPin={onPin ? (n) => onPin(n) : undefined}
                    />
                )}
                bulkActions={({ count, clearSelection: clear }) => (
                    <BulkActionBar
                        count={count}
                        onMove={() => setBulkDialog('move')}
                        onDelete={() => setBulkDialog('delete')}
                        onClear={clear}
                    />
                )}
            >
                {(renderProps) => {
                    const { tree, isSelected, openNode, isCompact, selectedIds, toggleSelect, searchQuery, expandAll } = renderProps
                    selectionRef.current = { selectedIds, clearSelection: renderProps.clearSelection }

                    return tree.map((node: Brand) => (
                        <div key={node.id}
                            className={`rounded-xl transition-all duration-200 ${isSelected(node) ? 'ring-2 ring-app-primary/40 bg-app-primary/[0.03] shadow-sm' : ''}`}>
                            <BrandRow
                                brand={node}
                                onEdit={openEdit}
                                onDelete={setDeleteTarget}
                                onSelect={(b, tab) => openNode(b, tab || 'overview')}
                                compact={isCompact}
                                selectable
                                isChecked={selectedIds.has(node.id)}
                                onToggleCheck={() => toggleSelect(node.id)}
                                searchQuery={searchQuery}
                                forceExpanded={expandAll}
                            />
                        </div>
                    ))
                }}
            </TreeMasterPage>

            {/* Bulk Dialog Surface */}
            {bulkDialog && (
                <BulkDialog
                    mode={bulkDialog}
                    selectedIds={Array.from(selectionRef.current.selectedIds)}
                    allBrands={brands}
                    busy={isPending}
                    onClose={() => setBulkDialog(null)}
                    onDone={() => { 
                        setBulkDialog(null); 
                        selectionRef.current.clearSelection(); 
                        router.refresh() 
                    }}
                />
            )}
        </>
    )
}
