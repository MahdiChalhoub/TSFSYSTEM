'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileBrandsClient — mobile-native Brands list.
 *  Cards with logo/initials + name + countries + categories +
 *  product count. Tap → detail sheet. Long-press → actions.
 * ═══════════════════════════════════════════════════════════ */

import { useState, useMemo, useCallback, useTransition } from 'react'
import {
    Paintbrush, Plus, Package, Globe, Tag, Search, Pencil, Trash2,
    Copy, Eye, ChevronRight, Award, MapPin, ExternalLink,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deleteBrand, moveBrandProducts } from '@/app/actions/inventory/brands'
import { DeleteConflictDialog } from '@/components/ui/DeleteConflictDialog'
import { MobileMasterPage } from '@/components/mobile/MobileMasterPage'
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet'
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type CountryRef = { id?: number; name?: string; code?: string; iso2?: string }
type CategoryRef = { id: number; name?: string }
type BrandRow = {
    id: number
    name: string
    short_name?: string
    logo?: string
    website?: string
    country_of_origin?: string
    country?: { name?: string }
    countries?: CountryRef[]
    categories?: CategoryRef[]
    product_count?: number
}

type DeleteResult = { success: boolean; conflict?: unknown; message?: string }
type DeleteConflictState = { conflict: unknown; source: BrandRow } | null

interface Props {
    brands: BrandRow[]
    countries: CountryRef[]
    categories: CategoryRef[]
}

export function MobileBrandsClient({ brands, countries, categories }: Props) {
    const router = useRouter()
    const [, startTransition] = useTransition()
    const [sheetBrand, setSheetBrand] = useState<BrandRow | null>(null)
    const [actionBrand, setActionBrand] = useState<BrandRow | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<BrandRow | null>(null)
    const [categoryFilter, setCategoryFilter] = useState<number | null>(null)

    const stats = useMemo(() => {
        const total = brands.length
        const withProducts = brands.filter(b => (b.product_count || 0) > 0).length
        const withCountries = brands.filter(b => (b.countries?.length || 0) > 0).length
        const withCategories = brands.filter(b => (b.categories?.length || 0) > 0).length
        const totalProducts = brands.reduce((s, b) => s + (b.product_count || 0), 0)
        return { total, withProducts, withCountries, withCategories, totalProducts }
    }, [brands])

    const openSheet = useCallback((b: BrandRow) => setSheetBrand(b), [])
    const openActions = useCallback((b: BrandRow) => setActionBrand(b), [])

    const [deleteConflict, setDeleteConflict] = useState<DeleteConflictState>(null)

    const handleDelete = useCallback(() => {
        if (!deleteTarget) return
        const source = deleteTarget
        setDeleteTarget(null)
        startTransition(async () => {
            const r = (await deleteBrand(source.id)) as DeleteResult
            if (r?.success) { toast.success(`"${source.name}" deleted`); router.refresh(); return }
            if (r?.conflict) { setDeleteConflict({ conflict: r.conflict, source }); return }
            toast.error(r?.message || 'Delete failed')
        })
    }, [deleteTarget, router])

    const handleBrandMigrateAndDelete = async (targetId: number) => {
        const source = deleteConflict?.source
        if (!source) return
        const moveRes = (await moveBrandProducts({
            source_brand_id: source.id,
            target_brand_id: targetId,
            also_delete_source: true,
        })) as DeleteResult
        if (moveRes?.success === false) { toast.error(moveRes.message || 'Migration failed'); return }
        toast.success(`Migrated & deleted "${source.name}"`)
        setDeleteConflict(null); router.refresh()
    }
    const handleBrandForceDelete = async () => {
        const source = deleteConflict?.source
        if (!source) return
        const res = (await deleteBrand(source.id, { force: true })) as DeleteResult
        if (res?.success) { toast.success(`"${source.name}" force-deleted`); setDeleteConflict(null); router.refresh() }
        else toast.error(res?.message || 'Delete failed')
    }
    const brandTargets = useMemo(() => {
        const sourceId = deleteConflict?.source?.id
        return brands
            .filter((b) => b.id !== sourceId)
            .map((b) => ({ id: b.id, name: b.name, code: b.short_name }))
    }, [brands, deleteConflict])

    const actionItems = useMemo(() => {
        if (!actionBrand) return []
        const hasProducts = (actionBrand.product_count || 0) > 0
        return [
            { key: 'view', label: 'View', hint: 'Details', icon: <Eye size={16} />, variant: 'grid' as const, onClick: () => openSheet(actionBrand) },
            { key: 'open', label: 'Open page', hint: 'Full screen', icon: <ExternalLink size={16} />, variant: 'grid' as const, onClick: () => router.push(`/inventory/brands/${actionBrand.id}`) },
            { key: 'edit', label: 'Edit', icon: <Pencil size={16} />, onClick: () => router.push(`/inventory/brands/${actionBrand.id}?edit=1`) },
            { key: 'copy', label: 'Copy name', hint: actionBrand.name, icon: <Copy size={16} />, onClick: () => {
                try { navigator.clipboard?.writeText(actionBrand.name); toast.success('Copied') }
                catch { toast.error('Copy failed') }
            } },
            { key: 'delete', label: 'Delete', hint: hasProducts ? `${actionBrand.product_count} product${actionBrand.product_count === 1 ? '' : 's'} — will offer migration` : undefined, icon: <Trash2 size={16} />, destructive: true, onClick: () => setDeleteTarget(actionBrand) },
        ]
    }, [actionBrand, openSheet, router])

    return (
        <MobileMasterPage
            config={{
                title: 'Brands',
                subtitle: `${stats.total} brand${stats.total === 1 ? '' : 's'} · ${stats.totalProducts} products`,
                icon: <Paintbrush size={20} />,
                iconColor: 'var(--app-accent)',
                searchPlaceholder: 'Search brands…',
                primaryAction: {
                    label: 'New Brand',
                    icon: <Plus size={16} strokeWidth={2.6} />,
                    onClick: () => router.push('/inventory/brands/new'),
                },
                secondaryActions: [
                    { label: 'Back to Inventory', icon: <Package size={14} />, href: '/inventory/categories' },
                ],
                kpis: [
                    { label: 'Total', value: stats.total, icon: <Paintbrush size={13} />, color: 'var(--app-accent)' },
                    { label: 'With Products', value: stats.withProducts, icon: <Package size={13} />, color: 'var(--app-success, #10b981)' },
                    { label: 'With Countries', value: stats.withCountries, icon: <Globe size={13} />, color: 'var(--app-info, #3b82f6)' },
                    { label: 'With Categories', value: stats.withCategories, icon: <Tag size={13} />, color: 'var(--app-warning, #f59e0b)' },
                    { label: 'Products', value: stats.totalProducts, icon: <Award size={13} />, color: 'var(--app-primary)' },
                ],
                footerLeft: (
                    <>
                        <span>{stats.total} brands</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{stats.totalProducts.toLocaleString()} products</span>
                    </>
                ),
                onRefresh: async () => { router.refresh(); await new Promise(r => setTimeout(r, 500)) },
            }}
            modals={
                <>
                    <MobileActionSheet
                        open={actionBrand !== null}
                        onClose={() => setActionBrand(null)}
                        title={actionBrand?.name}
                        subtitle={actionBrand ? `${actionBrand.product_count || 0} products` : undefined}
                        items={actionItems}
                    />
                    <ConfirmDialog
                        open={deleteTarget !== null}
                        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
                        onConfirm={handleDelete}
                        title={`Delete "${deleteTarget?.name}"?`}
                        description="If products are assigned, you'll be guided to migrate them first."
                        confirmText="Delete"
                        variant="danger"
                    />
                    <DeleteConflictDialog
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- conflict shape is server-derived; the dialog narrows internally
                        conflict={(deleteConflict?.conflict ?? null) as any}
                        sourceName={deleteConflict?.source?.name || ''}
                        entityName="brand"
                        targets={brandTargets}
                        onMigrate={handleBrandMigrateAndDelete}
                        onForceDelete={handleBrandForceDelete}
                        onCancel={() => setDeleteConflict(null)}
                    />
                </>
            }
            sheet={
                <MobileBottomSheet
                    open={sheetBrand !== null}
                    onClose={() => setSheetBrand(null)}
                    initialSnap="peek">
                    {sheetBrand && (
                        <BrandDetail
                            brand={sheetBrand}
                            categories={categories}
                            countries={countries}
                            onEdit={() => { setSheetBrand(null); router.push(`/inventory/brands/${sheetBrand.id}?edit=1`) }}
                            onOpen={() => { setSheetBrand(null); router.push(`/inventory/brands/${sheetBrand.id}`) }}
                            onClose={() => setSheetBrand(null)}
                        />
                    )}
                </MobileBottomSheet>
            }>
            {({ searchQuery }) => {
                const q = searchQuery.trim().toLowerCase()
                const filtered = brands.filter(b => {
                    if (categoryFilter && !(b.categories || []).some((c) => c.id === categoryFilter)) return false
                    if (!q) return true
                    return (b.name || '').toLowerCase().includes(q)
                        || (b.short_name || '').toLowerCase().includes(q)
                })

                return (
                    <div className="space-y-2">
                        {/* Category filter chip rail */}
                        {categories.length > 0 && (
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                                <button
                                    onClick={() => setCategoryFilter(null)}
                                    className="flex-shrink-0 font-black uppercase tracking-widest rounded-full px-3 py-1.5 active:scale-95 transition-transform"
                                    style={{
                                        fontSize: 'var(--tp-xxs)',
                                        minHeight: 32,
                                        color: categoryFilter === null ? '#fff' : 'var(--app-primary)',
                                        background: categoryFilter === null
                                            ? 'var(--app-primary)'
                                            : 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                        border: `1px solid color-mix(in srgb, var(--app-primary) ${categoryFilter === null ? 50 : 25}%, transparent)`,
                                    }}>
                                    All ({brands.length})
                                </button>
                                {categories.slice(0, 40).map((c) => {
                                    const count = brands.filter(b => (b.categories || []).some((bc) => bc.id === c.id)).length
                                    if (count === 0) return null
                                    const active = categoryFilter === c.id
                                    return (
                                        <button key={c.id}
                                            onClick={() => setCategoryFilter(active ? null : c.id)}
                                            className="flex-shrink-0 flex items-center gap-1 font-black uppercase tracking-widest rounded-full px-3 py-1.5 active:scale-95 transition-transform"
                                            style={{
                                                fontSize: 'var(--tp-xxs)',
                                                minHeight: 32,
                                                color: active ? '#fff' : 'var(--app-muted-foreground)',
                                                background: active
                                                    ? 'var(--app-warning, #f59e0b)'
                                                    : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                                border: `1px solid ${active ? 'color-mix(in srgb, var(--app-warning) 40%, transparent)' : 'color-mix(in srgb, var(--app-border) 40%, transparent)'}`,
                                            }}>
                                            {c.name}
                                            <span className="font-black tabular-nums rounded-full px-1.5 py-0.5"
                                                style={{
                                                    fontSize: 'var(--tp-xxs)',
                                                    background: active ? 'rgba(255,255,255,0.2)' : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                                                    color: active ? '#fff' : 'var(--app-muted-foreground)',
                                                    minWidth: 20, textAlign: 'center',
                                                }}>
                                                {count}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                <Paintbrush size={40} className="text-app-muted-foreground mb-3 opacity-40" />
                                <p className="font-bold text-app-muted-foreground mb-1"
                                    style={{ fontSize: 'var(--tp-lg)' }}>
                                    {q || categoryFilter ? 'No matching brands' : 'No brands yet'}
                                </p>
                                <p className="text-app-muted-foreground max-w-xs"
                                    style={{ fontSize: 'var(--tp-md)' }}>
                                    {q || categoryFilter ? 'Try clearing filters.' : 'Tap + to create your first brand.'}
                                </p>
                            </div>
                        ) : filtered.map(brand => {
                            const pcount = brand.product_count || 0
                            return (
                                <button key={brand.id}
                                    onClick={() => openSheet(brand)}
                                    onContextMenu={(e) => { e.preventDefault(); openActions(brand) }}
                                    className="w-full text-left rounded-2xl p-3 active:scale-[0.99] transition-transform"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-border) 45%, transparent)',
                                        contentVisibility: 'auto',
                                        containIntrinsicSize: '0 110px',
                                    }}>
                                    <div className="flex items-start gap-3">
                                        {/* Logo / initials */}
                                        <div className="flex items-center justify-center flex-shrink-0 rounded-xl overflow-hidden font-black text-white"
                                            style={{
                                                width: 46, height: 46,
                                                fontSize: 'var(--tp-xl)',
                                                background: brand.logo
                                                    ? 'var(--app-surface)'
                                                    : 'linear-gradient(135deg, var(--app-accent), color-mix(in srgb, var(--app-accent) 70%, var(--app-accent)))',
                                                boxShadow: '0 2px 10px color-mix(in srgb, var(--app-accent) 25%, transparent)',
                                            }}>
                                            {brand.logo
                                                ? <img src={brand.logo} alt="" className="w-full h-full object-cover" />
                                                : (brand.name || '?').substring(0, 2).toUpperCase()}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className="font-black text-app-foreground truncate"
                                                    style={{ fontSize: 'var(--tp-lg)' }}>
                                                    {brand.name}
                                                </span>
                                                {brand.short_name && (
                                                    <span className="font-bold text-app-muted-foreground uppercase tracking-wider flex-shrink-0"
                                                        style={{ fontSize: 'var(--tp-xxs)' }}>
                                                        {brand.short_name}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {pcount > 0 && (
                                                    <span className="flex items-center gap-1 font-black tabular-nums rounded-lg px-2 py-0.5"
                                                        style={{
                                                            fontSize: 'var(--tp-xs)',
                                                            color: 'var(--app-success, #10b981)',
                                                            background: 'color-mix(in srgb, var(--app-success, #10b981) 10%, transparent)',
                                                        }}>
                                                        <Package size={10} /> {pcount}
                                                    </span>
                                                )}
                                                {brand.countries?.slice(0, 3).map((c, i) => (
                                                    <span key={i} className="flex items-center gap-0.5 font-mono font-black rounded px-1.5 py-0.5"
                                                        style={{
                                                            fontSize: 'var(--tp-xxs)',
                                                            color: 'var(--app-info, #3b82f6)',
                                                            background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)',
                                                        }}>
                                                        {c.code || c.iso2 || '??'}
                                                    </span>
                                                ))}
                                                {(brand.countries?.length ?? 0) > 3 && (
                                                    <span className="font-bold text-app-muted-foreground"
                                                        style={{ fontSize: 'var(--tp-xxs)' }}>
                                                        +{(brand.countries?.length ?? 0) - 3}
                                                    </span>
                                                )}
                                            </div>
                                            {(brand.categories?.length ?? 0) > 0 && (
                                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                    <Tag size={10} style={{ color: 'var(--app-muted-foreground)' }} />
                                                    {brand.categories?.slice(0, 2).map((c) => (
                                                        <span key={c.id} className="font-bold rounded px-1.5"
                                                            style={{
                                                                fontSize: 'var(--tp-xxs)',
                                                                color: 'var(--app-warning, #f59e0b)',
                                                                background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)',
                                                            }}>
                                                            {c.name}
                                                        </span>
                                                    ))}
                                                    {(brand.categories?.length ?? 0) > 2 && (
                                                        <span className="font-bold text-app-muted-foreground"
                                                            style={{ fontSize: 'var(--tp-xxs)' }}>
                                                            +{(brand.categories?.length ?? 0) - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <ChevronRight size={16} className="text-app-muted-foreground flex-shrink-0 mt-1" />
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )
            }}
        </MobileMasterPage>
    )
}

/* ─── Brand detail sheet ─── */
interface BrandDetailProps {
    brand: BrandRow
    categories: CategoryRef[]
    countries: CountryRef[]
    onEdit: () => void
    onOpen: () => void
    onClose: () => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- categories/countries are passed for future enrichment but not yet rendered
function BrandDetail({ brand, categories, countries, onEdit, onOpen, onClose }: BrandDetailProps) {
    const pcount = brand.product_count || 0
    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 px-3 pt-2 pb-3 flex items-center gap-2"
                style={{
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-accent) 10%, var(--app-surface)), var(--app-surface))',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                }}>
                <div className="flex items-center justify-center flex-shrink-0 rounded-xl overflow-hidden font-black text-white"
                    style={{
                        width: 48, height: 48,
                        fontSize: 'var(--tp-2xl)',
                        background: brand.logo
                            ? 'var(--app-surface)'
                            : 'linear-gradient(135deg, var(--app-accent), color-mix(in srgb, var(--app-accent) 70%, var(--app-accent)))',
                        boxShadow: '0 4px 14px color-mix(in srgb, var(--app-accent) 30%, transparent)',
                    }}>
                    {brand.logo
                        ? <img src={brand.logo} alt="" className="w-full h-full object-cover" />
                        : (brand.name || '?').substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-black text-app-foreground truncate leading-tight" style={{ fontSize: 'var(--tp-2xl)' }}>
                        {brand.name}
                    </h3>
                    {brand.short_name && (
                        <div className="font-bold uppercase tracking-wider text-app-muted-foreground truncate"
                            style={{ fontSize: 'var(--tp-xs)' }}>
                            {brand.short_name}
                        </div>
                    )}
                </div>
                <button onClick={onClose}
                    className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
                    style={{
                        width: 36, height: 36,
                        color: 'var(--app-muted-foreground)',
                        background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                    }}
                    aria-label="Close">
                    <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    <div className="rounded-2xl px-3 py-3"
                        style={{
                            background: 'color-mix(in srgb, var(--app-success, #10b981) 6%, var(--app-surface))',
                            border: '1px solid color-mix(in srgb, var(--app-success, #10b981) 20%, transparent)',
                        }}>
                        <div className="font-black uppercase tracking-widest text-app-muted-foreground"
                            style={{ fontSize: 'var(--tp-xxs)' }}>Products</div>
                        <div className="font-black tabular-nums mt-1"
                            style={{ fontSize: 'var(--tp-stat)', color: 'var(--app-success, #10b981)' }}>
                            {pcount}
                        </div>
                    </div>
                    <div className="rounded-2xl px-3 py-3"
                        style={{
                            background: 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, var(--app-surface))',
                            border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)',
                        }}>
                        <div className="font-black uppercase tracking-widest text-app-muted-foreground"
                            style={{ fontSize: 'var(--tp-xxs)' }}>Countries</div>
                        <div className="font-black tabular-nums mt-1"
                            style={{ fontSize: 'var(--tp-stat)', color: 'var(--app-info, #3b82f6)' }}>
                            {brand.countries?.length || 0}
                        </div>
                    </div>
                </div>

                {/* Countries list */}
                {(brand.countries?.length ?? 0) > 0 && (
                    <div>
                        <div className="font-black uppercase tracking-widest text-app-muted-foreground mb-1.5 px-1"
                            style={{ fontSize: 'var(--tp-xs)' }}>
                            Countries
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {brand.countries?.map((c) => (
                                <span key={c.id}
                                    className="flex items-center gap-1 font-bold rounded-lg px-2 py-1"
                                    style={{
                                        fontSize: 'var(--tp-sm)',
                                        color: 'var(--app-info, #3b82f6)',
                                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 22%, transparent)',
                                    }}>
                                    <MapPin size={11} /> {c.name || c.code}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Categories list */}
                {(brand.categories?.length ?? 0) > 0 && (
                    <div>
                        <div className="font-black uppercase tracking-widest text-app-muted-foreground mb-1.5 px-1"
                            style={{ fontSize: 'var(--tp-xs)' }}>
                            Categories ({brand.categories?.length ?? 0})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {brand.categories?.map((c) => (
                                <span key={c.id}
                                    className="flex items-center gap-1 font-bold rounded-lg px-2 py-1"
                                    style={{
                                        fontSize: 'var(--tp-sm)',
                                        color: 'var(--app-warning, #f59e0b)',
                                        background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 22%, transparent)',
                                    }}>
                                    <Tag size={11} /> {c.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Meta */}
                <div className="rounded-2xl overflow-hidden"
                    style={{
                        background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    }}>
                    {([
                        ['Name', brand.name],
                        ['Short name', brand.short_name || '—'],
                        ['Country of origin', brand.country?.name || brand.country_of_origin || '—'],
                        ['Website', brand.website || '—'],
                        ['Products', String(pcount)],
                        ['Countries', String(brand.countries?.length || 0)],
                        ['Categories', String(brand.categories?.length || 0)],
                    ] as const).map(([label, value], i) => (
                        <div key={label}
                            className="flex items-center justify-between gap-3 px-3 py-2.5"
                            style={{ borderTop: i === 0 ? undefined : '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
                            <span className="font-black uppercase tracking-widest text-app-muted-foreground"
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
                <button onClick={onOpen}
                    className="flex items-center justify-center gap-1.5 rounded-xl active:scale-[0.97] transition-transform font-bold flex-shrink-0"
                    style={{
                        fontSize: 'var(--tp-md)', height: 46, padding: '0 16px',
                        color: 'var(--app-muted-foreground)',
                        background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                    }}>
                    <ExternalLink size={14} /> Full page
                </button>
                <button
                    onClick={onEdit}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl active:scale-[0.98] transition-transform font-black"
                    style={{
                        fontSize: 'var(--tp-md)', height: 46,
                        color: '#fff',
                        background: 'var(--app-accent)',
                        boxShadow: '0 2px 10px color-mix(in srgb, var(--app-accent) 35%, transparent)',
                    }}>
                    <Pencil size={14} /> Edit brand
                </button>
            </div>
        </div>
    )
}
