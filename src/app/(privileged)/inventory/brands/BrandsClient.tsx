// @ts-nocheck
'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import {
    Award, Plus, Pencil, Trash2, Layers, Package, Globe, FolderTree,
    X, Bookmark, ExternalLink, Image as ImageIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { BrandFormModal } from '@/components/admin/BrandFormModal'
import { erpFetch } from '@/lib/erp-api'

type Brand = {
    id: number
    name: string
    short_name?: string | null
    logo?: string | null
    countries?: Array<{ id: number; name: string; code?: string }>
    categories?: Array<{ id: number; name: string; code?: string }>
    product_count?: number
    created_at?: string
}

type Props = {
    brands: Brand[]
    countries: Array<Record<string, any>>
    categories: Array<Record<string, any>>
}

/* ═══════════════════════════════════════════════════════════
 *  BrandsClient — flat TreeMasterPage consumer. Brands have no
 *  hierarchy; every row is a root. Template owns search, KPI
 *  filtering, and empty state.
 * ═══════════════════════════════════════════════════════════ */
export function BrandsClient({ brands, countries, categories }: Props) {
    const router = useRouter()
    const [, startTransition] = useTransition()
    const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null)

    // Every brand is a root — give them parent=null so buildTree returns a flat list.
    const data = useMemo(() => brands.map(b => ({ ...b, parent: null })), [brands])

    const openNew = useCallback(() => { setEditingBrand(null); setModalOpen(true) }, [])
    const openEdit = useCallback((b: Brand) => { setEditingBrand(b); setModalOpen(true) }, [])
    const closeModal = useCallback(() => { setModalOpen(false); setEditingBrand(null) }, [])


    const handleConfirmDelete = () => {
        const t = deleteTarget
        if (!t) return
        setDeleteTarget(null)
        startTransition(async () => {
            try {
                await erpFetch(`brands/${t.id}/`, { method: 'DELETE' })
                toast.success(`"${t.name}" deleted`)
                router.refresh()
            } catch (e: any) {
                toast.error(e?.message || 'Failed to delete brand')
            }
        })
    }

    return (
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
                        { key: 'short_name', label: 'Short Name', format: (b: Brand) => b.short_name || '' },
                        { key: 'countries', label: 'Countries', format: (b: Brand) => (b.countries || []).map(c => c.code || c.name).join(' | ') },
                        { key: 'categories', label: 'Categories', format: (b: Brand) => (b.categories || []).map(c => c.code || c.name).join(' | ') },
                        { key: 'product_count', label: 'Products', format: (b: Brand) => b.product_count || 0 },
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
                            { key: 'country_count', label: 'Country #', align: 'right', defaultOn: false, width: '90px' },
                            { key: 'categories', label: 'Categories', defaultOn: false },
                            { key: 'cat_count', label: 'Cat #', align: 'right', defaultOn: true, width: '70px' },
                            { key: 'products', label: 'Products', align: 'right', defaultOn: true, width: '80px' },
                        ],
                        rowMapper: (b: Brand) => ({
                            name: b.name,
                            short: b.short_name || '',
                            countries: (b.countries || []).map(c => c.code || c.name).join(', '),
                            country_count: (b.countries || []).length,
                            categories: (b.categories || []).map(c => c.code || c.name).join(', '),
                            cat_count: (b.categories || []).length,
                            products: b.product_count || 0,
                        }),
                    },
                    import: {
                        entity: 'brand',
                        endpoint: 'brands/',
                        columns: [
                            { name: 'name', required: true, desc: 'Brand name — unique per tenant', example: 'Nestle' },
                            { name: 'short_name', required: false, desc: 'Short abbreviation', example: 'NES' },
                        ],
                        sampleCsv: 'name,short_name\nNestle,NES\nCoca Cola,COKE\nPepsi,PEP',
                        previewColumns: [
                            { key: 'name', label: 'Name' },
                            { key: 'short_name', label: 'Short', mono: true },
                        ],
                        buildPayload: (row: Record<string, string>) => ({
                            name: row.name,
                            short_name: row.short_name || null,
                        }),
                        tip: <><strong>Note:</strong> Countries and categories can't be set from CSV — link them per-brand in the edit dialog after import.</>,
                    },
                },
                secondaryActions: [
                    { label: 'Reorganize', icon: <FolderTree size={13} />, href: '/inventory/maintenance?tab=brand' },
                ],
                columnHeaders: [
                    { label: 'Brand', width: 'auto' },
                    { label: 'Cats', width: '48px', color: 'var(--app-info)', hideOnMobile: true },
                    { label: 'Countries', width: '72px', color: 'var(--app-warning)', hideOnMobile: true },
                    { label: 'Products', width: '56px', color: 'var(--app-success)', hideOnMobile: true },
                ],

                // ── Template owns filtering ──
                data,
                searchFields: ['name', 'short_name'],
                selectable: true,
                onBulkDelete: async (ids, clear) => {
                    if (!confirm(`Delete ${ids.length} brand(s)? Products referencing them will be unlinked.`)) return
                    let ok = 0, fail = 0
                    for (const id of ids) {
                        try { await erpFetch(`brands/${id}/`, { method: 'DELETE' }); ok++ }
                        catch { fail++ }
                    }
                    if (ok) toast.success(`Deleted ${ok} brand(s)`)
                    if (fail) toast.error(`${fail} brand(s) failed to delete`)
                    clear(); router.refresh()
                },
                kpiPredicates: {
                    withCategory: (b) => (b.categories?.length || 0) > 0,
                    orphan: (b) => (b.categories?.length || 0) === 0,
                    withCountry: (b) => (b.countries?.length || 0) > 0,
                    products: (b) => (b.product_count || 0) > 0,
                    logoless: (b) => !b.logo,
                },

                kpis: [
                    {
                        label: 'Total', icon: <Layers size={11} />, color: 'var(--app-primary)',
                        filterKey: 'all', hint: 'Show all brands (clear filters)',
                        value: (_, all) => all.length,
                    },
                    {
                        label: 'Categorized', icon: <FolderTree size={11} />, color: 'var(--app-info)',
                        filterKey: 'withCategory', hint: 'Only brands linked to categories',
                        value: (filtered) => filtered.filter((b: Brand) => (b.categories?.length || 0) > 0).length,
                    },
                    {
                        label: 'Orphans', icon: <X size={11} />, color: 'var(--app-error)',
                        filterKey: 'orphan', hint: 'Brands with no category link',
                        value: (filtered) => filtered.filter((b: Brand) => (b.categories?.length || 0) === 0).length,
                    },
                    {
                        label: 'Countries', icon: <Globe size={11} />, color: 'var(--app-warning)',
                        filterKey: 'withCountry', hint: 'Brands with country assignment',
                        value: (filtered) => filtered.filter((b: Brand) => (b.countries?.length || 0) > 0).length,
                    },
                    {
                        label: 'Products', icon: <Package size={11} />, color: 'var(--app-success)',
                        filterKey: 'products', hint: 'Brands with at least one product',
                        value: (filtered) => filtered.reduce((s: number, b: Brand) => s + (b.product_count || 0), 0),
                    },
                    {
                        label: 'Logoless', icon: <ImageIcon size={11} />, color: 'var(--app-muted-foreground)',
                        filterKey: 'logoless', hint: 'Brands missing a logo',
                        value: (filtered) => filtered.filter((b: Brand) => !b.logo).length,
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
                footerLeft: (filtered, all) => (
                    <div className="flex items-center gap-3 flex-wrap">
                        <span>{all.length} total brands</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{all.reduce((s: number, b: Brand) => s + (b.product_count || 0), 0).toLocaleString()} linked products</span>
                        {filtered.length < all.length && (
                            <>
                                <span style={{ color: 'var(--app-border)' }}>·</span>
                                <span style={{ color: 'var(--app-info)' }}>{filtered.length} showing</span>
                            </>
                        )}
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
                    />
                    <ConfirmDialog
                        open={deleteTarget !== null}
                        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
                        onConfirm={handleConfirmDelete}
                        title={`Delete "${deleteTarget?.name}"?`}
                        description="This permanently removes the brand. Products referencing it will be unlinked."
                        confirmText="Delete"
                        variant="danger"
                    />
                </>
            }
            detailPanel={(node, { onClose, onPin }) => (
                <BrandDetailPanel
                    brand={node}
                    onEdit={openEdit}
                    onDelete={(b) => setDeleteTarget(b)}
                    onClose={onClose}
                    onPin={onPin ? () => onPin(node) : undefined}
                />
            )}
        >
            {({ tree, expandKey, isSelected, openNode, selectedIds, toggleSelect }) => (
                tree.map((node: Brand) => (
                    <div key={`${node.id}-${expandKey}`}
                        className={`rounded-xl transition-all duration-300 ${isSelected(node) ? 'ring-2 ring-app-primary/40 bg-app-primary/[0.03] shadow-sm' : ''}`}>
                        <BrandRow
                            brand={node}
                            onEdit={openEdit}
                            onDelete={(b) => setDeleteTarget(b)}
                            onSelect={(b) => openNode(b, 'overview')}
                            selectable
                            isChecked={selectedIds.has(node.id)}
                            onToggleCheck={() => toggleSelect(node.id)}
                        />
                    </div>
                ))
            )}
        </TreeMasterPage>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  BRAND ROW
 * ═══════════════════════════════════════════════════════════ */
function BrandRow({ brand, onEdit, onDelete, onSelect, selectable, isChecked, onToggleCheck }: {
    brand: Brand
    onEdit: (b: Brand) => void
    onDelete: (b: Brand) => void
    onSelect: (b: Brand) => void
    selectable?: boolean
    isChecked?: boolean
    onToggleCheck?: () => void
}) {
    const cats = brand.categories?.length || 0
    const countries = brand.countries?.length || 0
    const products = brand.product_count || 0
    const firstCountry = brand.countries?.[0]

    return (
        <div
            className="group flex items-center gap-2 py-2.5 hover:bg-app-surface-hover transition-colors cursor-pointer relative"
            onClick={() => onSelect(brand)}
            onDoubleClick={() => onSelect(brand)}
            style={{
                paddingLeft: 12, paddingRight: 12,
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
            }}>

            <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full"
                style={{ background: 'var(--app-primary)' }} />

            {/* Checkbox (selectable) + chevron alignment slot */}
            {selectable && (
                <button type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleCheck?.() }}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${isChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    style={{
                        borderColor: isChecked ? 'var(--app-primary)' : 'var(--app-border)',
                        background: isChecked ? 'var(--app-primary)' : 'transparent',
                    }}
                    aria-checked={isChecked}
                    role="checkbox"
                    aria-label={`Select ${brand.name}`}>
                    {isChecked && <span className="text-white text-[10px] font-bold">✓</span>}
                </button>
            )}
            <div className="w-5 flex-shrink-0" />

            {/* Logo or icon */}
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{
                    background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                    color: 'var(--app-primary)',
                }}>
                {brand.logo
                    ? <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover" />
                    : <Award size={13} strokeWidth={2} />}
            </div>

            {/* Name + short + countries */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="truncate text-tp-lg font-bold text-app-foreground">{brand.name}</span>
                    {brand.short_name && (
                        <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full flex-shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                            {brand.short_name}
                        </span>
                    )}
                </div>
                {(countries > 0 || cats > 0) && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {firstCountry && (
                            <span className="text-tp-xxs font-medium text-app-muted-foreground flex items-center gap-0.5">
                                <Globe size={9} /> {firstCountry.name}{countries > 1 ? ` +${countries - 1}` : ''}
                            </span>
                        )}
                        {cats > 0 && (
                            <span className="text-tp-xxs font-medium text-app-muted-foreground">
                                · {cats} categor{cats === 1 ? 'y' : 'ies'}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Stat columns */}
            <div className="hidden sm:flex w-12 flex-shrink-0 justify-center">
                <span className="text-tp-xs font-semibold tabular-nums"
                    style={{ color: cats > 0 ? 'var(--app-info)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                    {cats || '–'}
                </span>
            </div>
            <div className="hidden sm:flex w-[72px] flex-shrink-0 justify-center">
                <span className="text-tp-xs font-semibold tabular-nums"
                    style={{ color: countries > 0 ? 'var(--app-warning)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                    {countries || '–'}
                </span>
            </div>
            <div className="hidden sm:flex w-14 flex-shrink-0 justify-center">
                <span className="text-tp-xs font-semibold tabular-nums"
                    style={{ color: products > 0 ? 'var(--app-success)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                    {products || '–'}
                </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <Link href={`/inventory/brands/${brand.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Open brand page">
                    <ExternalLink size={12} />
                </Link>
                <button onClick={(e) => { e.stopPropagation(); onEdit(brand) }}
                    className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
                    <Pencil size={12} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(brand) }}
                    className="p-1.5 hover:bg-app-border/40 rounded-lg transition-colors"
                    style={{ color: 'var(--app-muted-foreground)' }} title="Delete">
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  DETAIL PANEL
 * ═══════════════════════════════════════════════════════════ */
function BrandDetailPanel({
    brand, onEdit, onDelete, onClose, onPin,
}: {
    brand: Brand
    onEdit: (b: Brand) => void
    onDelete: (b: Brand) => void
    onClose: () => void
    onPin?: () => void
}) {
    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--app-surface)' }}>
            <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
                style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)', color: 'var(--app-primary)' }}>
                        {brand.logo ? <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover" /> : <Award size={16} />}
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-bold tracking-tight truncate">{brand.name}</h2>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {brand.short_name && (
                                <span className="font-mono text-tp-xs font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                    {brand.short_name}
                                </span>
                            )}
                            {brand.product_count != null && (
                                <span className="text-tp-xxs font-bold uppercase tracking-wide"
                                    style={{ color: 'var(--app-success)' }}>
                                    {brand.product_count} product{brand.product_count !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {onPin && <button onClick={onPin} className="p-1.5 hover:bg-app-border/50 rounded-lg" title="Pin"><Bookmark size={13} /></button>}
                    <button onClick={() => onEdit(brand)} className="p-1.5 hover:bg-app-border/50 rounded-lg" title="Edit"><Pencil size={13} /></button>
                    <button onClick={() => onDelete(brand)} className="p-1.5 hover:bg-app-border/50 rounded-lg" title="Delete"><Trash2 size={13} style={{ color: 'var(--app-error)' }} /></button>
                    {onClose && <button onClick={onClose} className="p-1.5 hover:bg-app-border/50 rounded-lg ml-1" title="Close"><X size={14} /></button>}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                <Link href={`/inventory/brands/${brand.id}`}
                    className="flex items-center justify-between px-3 py-2 rounded-xl transition-colors"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                    <span className="text-tp-sm font-bold text-app-primary">Open full brand page</span>
                    <ExternalLink size={13} style={{ color: 'var(--app-primary)' }} />
                </Link>

                <SectionCard title="Countries" icon={<Globe size={12} />} color="var(--app-warning)"
                    count={brand.countries?.length || 0}>
                    {brand.countries?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                            {brand.countries.map(c => (
                                <span key={c.id} className="text-tp-xxs font-bold px-2 py-1 rounded-full"
                                    style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}>
                                    {c.name}
                                </span>
                            ))}
                        </div>
                    ) : <p className="text-tp-sm text-app-muted-foreground">No country assigned.</p>}
                </SectionCard>

                <SectionCard title="Categories" icon={<FolderTree size={12} />} color="var(--app-info)"
                    count={brand.categories?.length || 0}>
                    {brand.categories?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                            {brand.categories.map(c => (
                                <span key={c.id} className="text-tp-xxs font-bold px-2 py-1 rounded-full"
                                    style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                                    {c.name}
                                </span>
                            ))}
                        </div>
                    ) : <p className="text-tp-sm text-app-muted-foreground">No category links.</p>}
                </SectionCard>
            </div>
        </div>
    )
}

function SectionCard({ title, icon, color, count, children }: any) {
    return (
        <div className="rounded-xl p-3"
            style={{ background: 'color-mix(in srgb, var(--app-border) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-tp-xxs font-bold uppercase tracking-wider" style={{ color }}>
                    {icon} {title}
                </div>
                <span className="text-tp-xxs font-bold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                    {count}
                </span>
            </div>
            {children}
        </div>
    )
}
