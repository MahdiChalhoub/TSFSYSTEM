'use client'

import { useState, useMemo, useCallback, useRef, useEffect, useTransition } from 'react'
import {
    Plus, Search, Pencil, X, Trash2, Award, Package, Globe,
    ChevronDown, ChevronRight, Layers, Loader2, Paintbrush,
    Maximize2, Minimize2, Tag, Box, FolderTree, Wrench, ExternalLink,
    ChevronsUpDown, ChevronsDownUp
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DeleteConflictDialog } from '@/components/ui/DeleteConflictDialog'
import { deleteBrand, getBrandHierarchy, moveBrandProducts } from '@/app/actions/inventory/brands'
import { BrandFormModal } from '@/components/admin/BrandFormModal'

/* ═══════════════════════════════════════════════════════════
 *  BRAND HIERARCHY PANEL (expandable)
 * ═══════════════════════════════════════════════════════════ */
function BrandHierarchy({ brandId }: { brandId: number }) {
    const [data, setData] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        getBrandHierarchy(brandId).then(res => {
            if (mounted) { setData(res); setLoading(false) }
        }).catch(() => { if (mounted) setLoading(false) })
        return () => { mounted = false }
    }, [brandId])

    if (loading) return (
        <div className="py-8 text-center">
            <Loader2 size={20} className="animate-spin text-app-primary inline-block" />
        </div>
    )

    const groups = data?.productGroups || []
    const loose = data?.products || []

    if (!data || (groups.length === 0 && loose.length === 0)) return (
        <div className="py-8 text-center text-[11px] font-bold text-app-muted-foreground">
            No products found for this brand.
        </div>
    )

    return (
        <div className="px-4 py-3 space-y-3" style={{ background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
            {groups.map((group: any) => (
                <div key={group.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
                    <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-info) 5%, var(--app-surface))' }}>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>
                                <Layers size={12} />
                            </div>
                            <span className="text-[12px] font-black text-app-foreground">{group.name}</span>
                            <span className="text-[9px] font-bold text-app-muted-foreground">{group.products?.length || 0} variants</span>
                        </div>
                    </div>
                    <div className="divide-y divide-app-border/30">
                        {group.products?.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between px-4 py-2 hover:bg-app-surface/60 transition-all">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-black" style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                        {p.country_name?.substring(0, 2) || 'WW'}
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-bold text-app-foreground">{p.name} {p.size && `– ${p.size}${p.unit_name || ''}`}</span>
                                        <span className="text-[9px] text-app-muted-foreground font-mono ml-2">{p.sku || 'NO-SKU'}</span>
                                    </div>
                                </div>
                                <span className={`text-[12px] font-black tabular-nums ${p.stock > 0 ? 'text-app-foreground' : 'text-app-error'}`}>
                                    {p.stock ?? 0}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {loose.length > 0 && (
                <div className="rounded-xl p-3" style={{ border: '1px dashed var(--app-border)' }}>
                    <div className="flex items-center gap-1.5 mb-2">
                        <Package size={11} className="text-app-muted-foreground" />
                        <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">Ungrouped</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {loose.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                <div>
                                    <span className="text-[11px] font-bold text-app-foreground">{p.name}</span>
                                    <span className="text-[9px] text-app-muted-foreground font-mono ml-1.5">{p.sku || 'NO-SKU'}</span>
                                </div>
                                <span className="text-[11px] font-black tabular-nums text-app-foreground">{p.stock ?? 0}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}


/* ═══════════════════════════════════════════════════════════
 *  BRAND CARD (grid view item)
 * ═══════════════════════════════════════════════════════════ */
function BrandCard({ brand, onEdit, onDelete }: { brand: any; onEdit: (b: any) => void; onDelete: (b: any) => void }) {
    return (
        <div
            className="group rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl cursor-pointer h-full flex flex-col"
            style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
            }}
            onClick={() => onEdit(brand)}
        >
            {/* Top accent */}
            <div className="h-1 w-full" style={{ background: 'var(--app-primary)' }} />

            <div className="p-4 flex-1 flex flex-col">
                {/* Logo + Name */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black uppercase overflow-hidden flex-shrink-0"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 10%, var(--app-background))',
                                border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                color: 'var(--app-primary)',
                            }}
                        >
                            {brand.logo
                                ? <img src={brand.logo} alt="" className="w-full h-full object-cover" />
                                : brand.name?.substring(0, 2)}
                        </div>
                        <div className="min-w-0">
                            <h4 className="text-sm font-black text-app-foreground truncate group-hover:text-app-primary transition-colors">{brand.name}</h4>
                            {brand.short_name && <p className="text-[10px] font-bold text-app-muted-foreground">{brand.short_name}</p>}
                        </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                            onClick={e => { e.stopPropagation(); onEdit(brand) }}
                            className="p-1.5 rounded-lg text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-colors"
                        >
                            <Pencil size={12} />
                        </button>
                        <button
                            onClick={e => { e.stopPropagation(); onDelete(brand) }}
                            className="p-1.5 rounded-lg hover:bg-app-border/50 transition-colors"
                            style={{ color: 'var(--app-error)' }}
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>

                {/* Categories */}
                <div className="flex flex-wrap gap-1 mb-3">
                    {brand.categories?.slice(0, 3).map((cat: any) => (
                        <span key={cat.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: 'color-mix(in srgb, #8b5cf6 8%, transparent)', color: '#8b5cf6', border: '1px solid color-mix(in srgb, #8b5cf6 15%, transparent)' }}>
                            {cat.name}
                        </span>
                    ))}
                    {(brand.categories?.length || 0) > 3 && (
                        <span className="text-[9px] font-bold text-app-muted-foreground">+{brand.categories.length - 3}</span>
                    )}
                    {(!brand.categories || brand.categories.length === 0) && (
                        <span className="text-[9px] font-bold text-app-muted-foreground italic">Universal</span>
                    )}
                </div>

                {/* Footer row */}
                <div className="mt-auto flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-3">
                        {/* Countries */}
                        <div className="flex items-center gap-1">
                            <Globe size={10} className="text-app-muted-foreground" />
                            <span className="text-[9px] font-bold text-app-muted-foreground">
                                {brand.countries?.length > 0
                                    ? brand.countries.map((c: any) => c.code).join(', ')
                                    : 'Worldwide'}
                            </span>
                        </div>
                    </div>
                    {/* Product count */}
                    <div className="flex items-center gap-1 text-[10px] font-bold"
                        style={{ color: (brand.product_count || 0) > 0 ? 'var(--app-success)' : 'var(--app-muted-foreground)' }}>
                        <Package size={10} />
                        <span>{brand.product_count || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}


/* ═══════════════════════════════════════════════════════════
 *  BRAND TABLE ROW (list view item)
 * ═══════════════════════════════════════════════════════════ */
function BrandRow({ brand, onEdit, onDelete, isExpanded, onToggle }: {
    brand: any; onEdit: (b: any) => void; onDelete: (b: any) => void;
    isExpanded: boolean; onToggle: () => void;
}) {
    return (
        <div>
            <div
                className="group flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 border-b transition-all duration-150 cursor-pointer hover:bg-app-surface"
                style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}
                onClick={onToggle}
            >
                {/* Expand toggle */}
                <button className="w-5 h-5 flex items-center justify-center rounded-md text-app-muted-foreground transition-all flex-shrink-0">
                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>

                {/* Logo */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black uppercase overflow-hidden flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 8%, var(--app-background))',
                        border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)',
                        color: 'var(--app-primary)',
                    }}
                >
                    {brand.logo
                        ? <img src={brand.logo} alt="" className="w-full h-full object-cover" />
                        : brand.name?.substring(0, 2)}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-[13px] font-bold text-app-foreground truncate">{brand.name}</span>
                    {brand.short_name && (
                        <span className="hidden md:inline text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider bg-app-border/30 px-1.5 py-0.5 rounded">
                            {brand.short_name}
                        </span>
                    )}
                </div>

                {/* Categories */}
                <div className="hidden md:flex w-36 flex-shrink-0 flex-wrap gap-1">
                    {brand.categories?.slice(0, 2).map((cat: any) => (
                        <span key={cat.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: 'color-mix(in srgb, #8b5cf6 8%, transparent)', color: '#8b5cf6' }}>
                            {cat.name}
                        </span>
                    ))}
                    {(brand.categories?.length || 0) > 2 && <span className="text-[9px] font-bold text-app-muted-foreground">+{brand.categories.length - 2}</span>}
                </div>

                {/* Origins */}
                <div className="hidden sm:flex w-20 flex-shrink-0">
                    <span className="text-[10px] font-bold text-app-muted-foreground">
                        {brand.countries?.length > 0
                            ? brand.countries.map((c: any) => c.code).join(', ')
                            : 'WW'}
                    </span>
                </div>

                {/* Product count */}
                <div className="hidden sm:flex w-16 flex-shrink-0">
                    <span className="text-[10px] font-bold flex items-center gap-1"
                        style={{ color: (brand.product_count || 0) > 0 ? 'var(--app-success)' : 'var(--app-muted-foreground)' }}>
                        <Box size={10} />
                        {brand.product_count || 0}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); onEdit(brand) }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
                        <Pencil size={12} />
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); onDelete(brand) }}
                        className="p-1.5 hover:bg-app-border/50 rounded-lg transition-colors"
                        style={{ color: 'var(--app-muted-foreground)' }}
                        title="Delete"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Expanded Hierarchy */}
            {isExpanded && (
                <div className="animate-in slide-in-from-top-1 duration-150">
                    <BrandHierarchy brandId={brand.id} />
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  MAIN BRANDS PAGE
 * ═══════════════════════════════════════════════════════════ */
export function BrandsClient({ initialBrands, countries, categories }: { initialBrands: any[], countries: any[], categories: any[] }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingBrand, setEditingBrand] = useState<any>(null)
    const [deleteTarget, setDeleteTarget] = useState<any>(null)
    const [deleteConflict, setDeleteConflict] = useState<any>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
    const [allExpanded, setAllExpanded] = useState(false)
    const [focusMode, setFocusMode] = useState(false)
    const searchRef = useRef<HTMLInputElement>(null)
    const data = initialBrands

    // Keyboard shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // Filter
    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return data
        const q = searchQuery.toLowerCase()
        return data.filter(b =>
            b.name?.toLowerCase().includes(q) ||
            b.short_name?.toLowerCase().includes(q) ||
            b.countries?.some((c: any) => c.code?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q)) ||
            b.categories?.some((c: any) => c.name?.toLowerCase().includes(q))
        )
    }, [data, searchQuery])

    // Stats
    const stats = useMemo(() => ({
        total: data.length,
        filtered: filtered.length,
        totalProducts: data.reduce((s: number, b: any) => s + (b.product_count || 0), 0),
        totalCategories: new Set(data.flatMap((b: any) => (b.categories || []).map((c: any) => c.id))).size,
    }), [data, filtered])

    // Actions
    const openAdd = useCallback(() => { setEditingBrand(null); setIsFormOpen(true) }, [])
    const openEdit = useCallback((b: any) => { setEditingBrand(b); setIsFormOpen(true) }, [])

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        const source = deleteTarget
        setDeleteTarget(null)
        startTransition(async () => {
            const result = await deleteBrand(source.id)
            if (result?.success) { toast.success(`"${source.name}" deleted`); router.refresh(); return }
            if ((result as any)?.conflict) {
                setDeleteConflict({ conflict: (result as any).conflict, source })
                return
            }
            toast.error(result?.message || 'Failed to delete')
        })
    }

    const handleMigrateBrandAndDelete = async (targetId: number) => {
        const source = deleteConflict?.source
        if (!source) return
        try {
            // Brand move_products already supports also_delete_source in one shot
            const moveRes = await moveBrandProducts({
                source_brand_id: source.id,
                target_brand_id: targetId,
                also_delete_source: true,
            })
            if (moveRes?.success === false) {
                toast.error(moveRes.message || 'Migration failed'); return
            }
            toast.success(`Products migrated and "${source.name}" deleted`)
            setDeleteConflict(null); router.refresh()
        } catch (e: any) {
            toast.error(e?.message || 'Migration failed')
        }
    }

    const handleForceDeleteBrand = async () => {
        const source = deleteConflict?.source
        if (!source) return
        const res = await deleteBrand(source.id, { force: true })
        if (res?.success) {
            toast.success(`"${source.name}" force-deleted`)
            setDeleteConflict(null); router.refresh()
        } else {
            toast.error(res?.message || 'Delete failed')
        }
    }

    const brandMigrationTargets = useMemo(() => {
        const sourceId = deleteConflict?.source?.id
        return data
            .filter((b: any) => b.id !== sourceId)
            .map((b: any) => ({ id: b.id, name: b.name, code: b.short_name }))
    }, [data, deleteConflict])

    return (
        <div className={`flex flex-col animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`} style={{ height: '100%' }}>

            {/* ═══════════════ HEADER ═══════════════ */}
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

                {focusMode ? (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-primary)' }}>
                                <Paintbrush size={14} style={{ color: '#fff' }} />
                            </div>
                            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Brands</span>
                            <span className="text-[10px] font-bold text-app-muted-foreground">{stats.filtered}/{stats.total}</span>
                        </div>

                        <div className="flex-1 relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all"
                            />
                        </div>

                        <button onClick={openAdd}
                            className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0">
                            <Plus size={12} /><span className="hidden sm:inline">New</span>
                        </button>

                        <button onClick={() => setFocusMode(false)} title="Exit focus mode"
                            className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                            <Minimize2 size={13} />
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Action Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="page-header-icon" style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                    <Paintbrush size={20} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Brands</h1>
                                    <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                        {stats.total} Brands · Product Manufacturers
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                <Link
                                    href="/inventory/maintenance?tab=brand"
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                                >
                                    <Wrench size={13} />
                                    <span className="hidden md:inline">Cleanup</span>
                                </Link>
                                <button
                                    onClick={openAdd}
                                    className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                                >
                                    <Plus size={14} />
                                    <span className="hidden sm:inline">New Brand</span>
                                </button>
                                <button onClick={() => setFocusMode(true)} title="Focus mode — maximize tree"
                                    className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                    <Maximize2 size={13} />
                                </button>
                            </div>
                        </div>

                        {/* KPI Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                                { label: 'Total', value: stats.total, icon: <Paintbrush size={11} />, color: 'var(--app-primary)' },
                                { label: 'Products', value: stats.totalProducts, icon: <Package size={11} />, color: 'var(--app-success)' },
                                { label: 'Categories', value: stats.totalCategories, icon: <FolderTree size={11} />, color: '#8b5cf6' },
                                { label: 'Showing', value: stats.filtered, icon: <Search size={11} />, color: 'var(--app-info)' },
                            ].map(s => (
                                <div key={s.label}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    }}
                                >
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                        style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                        {s.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                        <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Search + View Toggle */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search brands by name, origin, category... (Ctrl+K)"
                                    className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                                />
                            </div>

                            {/* View toggle */}
                            <div className="flex rounded-xl overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--app-border)' }}>
                                <button onClick={() => setViewMode('grid')}
                                    className="p-2 text-[11px] transition-all"
                                    style={{
                                        background: viewMode === 'grid' ? 'var(--app-primary)' : 'transparent',
                                        color: viewMode === 'grid' ? '#fff' : 'var(--app-muted-foreground)',
                                    }}
                                    title="Grid view"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                                </button>
                                <button onClick={() => setViewMode('list')}
                                    className="p-2 text-[11px] transition-all"
                                    style={{
                                        background: viewMode === 'list' ? 'var(--app-primary)' : 'transparent',
                                        color: viewMode === 'list' ? '#fff' : 'var(--app-muted-foreground)',
                                    }}
                                    title="List view"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                                </button>
                            </div>

                            <button
                                onClick={() => {
                                    if (allExpanded) {
                                        setExpandedIds(new Set())
                                        setAllExpanded(false)
                                    } else {
                                        setExpandedIds(new Set(filtered.map(b => b.id)))
                                        setAllExpanded(true)
                                    }
                                }}
                                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-2 rounded-xl border transition-all flex-shrink-0"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)',
                                    color: 'var(--app-primary)',
                                    borderColor: 'color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                }}
                            >
                                {allExpanded ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
                                <span className="hidden sm:inline">{allExpanded ? 'Collapse' : 'Expand'}</span>
                            </button>

                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')}
                                    className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0"
                                    style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}>
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ═══════════════ FORM MODAL ═══════════════ */}
            {isFormOpen && (
                <BrandFormModal
                    isOpen={true}
                    onClose={() => setIsFormOpen(false)}
                    brand={editingBrand}
                    countries={countries}
                    categories={categories}
                />
            )}

            {/* ═══════════════ CONTENT ═══════════════ */}
            <div className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col"
                style={{ background: 'color-mix(in srgb, var(--app-surface) 30%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>

                {viewMode === 'list' ? (
                    <>
                        {/* Column Headers */}
                        <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                            <div className="w-5 flex-shrink-0" />
                            <div className="w-9 flex-shrink-0" />
                            <div className="flex-1 min-w-0">Brand</div>
                            <div className="hidden md:block w-36 flex-shrink-0">Categories</div>
                            <div className="hidden sm:block w-20 flex-shrink-0">Origin</div>
                            <div className="hidden sm:block w-16 flex-shrink-0">Products</div>
                            <div className="w-14 flex-shrink-0" />
                        </div>

                        {/* List Body */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                            {filtered.length > 0 ? (
                                filtered.map(brand => (
                                    <BrandRow
                                        key={brand.id}
                                        brand={brand}
                                        onEdit={openEdit}
                                        onDelete={setDeleteTarget}
                                        isExpanded={expandedIds.has(brand.id)}
                                        onToggle={() => {
                                            setExpandedIds(prev => {
                                                const next = new Set(prev)
                                                if (next.has(brand.id)) next.delete(brand.id)
                                                else next.add(brand.id)
                                                return next
                                            })
                                        }}
                                    />
                                ))
                            ) : (
                                <EmptyState searchQuery={searchQuery} onAdd={openAdd} />
                            )}
                        </div>
                    </>
                ) : (
                    /* Grid Body */
                    <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar p-4">
                        {filtered.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {filtered.map(brand => (
                                    <BrandCard key={brand.id} brand={brand} onEdit={openEdit} onDelete={setDeleteTarget} />
                                ))}
                            </div>
                        ) : (
                            <EmptyState searchQuery={searchQuery} onAdd={openAdd} />
                        )}
                    </div>
                )}
            </div>

            {/* ── Delete Confirm ── */}
            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                onConfirm={handleConfirmDelete}
                title={`Delete "${deleteTarget?.name}"?`}
                description="Products are checked before delete. If any product is assigned to this brand, you'll be guided to migrate them first."
                confirmText="Delete"
                variant="danger"
            />

            {/* ── 409 Conflict → Migration Flow ── */}
            <DeleteConflictDialog
                conflict={deleteConflict?.conflict || null}
                sourceName={deleteConflict?.source?.name || ''}
                entityName="brand"
                targets={brandMigrationTargets}
                onMigrate={handleMigrateBrandAndDelete}
                onForceDelete={handleForceDeleteBrand}
                onCancel={() => setDeleteConflict(null)}
            />
        </div>
    )
}

function EmptyState({ searchQuery, onAdd }: { searchQuery: string; onAdd: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 15%, transparent), color-mix(in srgb, var(--app-primary) 5%, transparent))',
                    border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                }}
            >
                <Paintbrush size={28} style={{ color: 'var(--app-primary)', opacity: 0.7 }} />
            </div>
            <p className="text-base font-bold text-app-muted-foreground mb-1">
                {searchQuery ? 'No matching brands' : 'No brands defined yet'}
            </p>
            <p className="text-xs text-app-muted-foreground mb-6 max-w-xs">
                {searchQuery
                    ? 'Try a different search term or clear filters.'
                    : 'Create a brand to start organizing your product catalog.'}
            </p>
            {!searchQuery && (
                <button
                    onClick={onAdd}
                    className="px-4 py-2 rounded-xl bg-app-primary text-white text-sm font-bold hover:brightness-110 transition-all"
                    style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                >
                    <Plus size={16} className="inline mr-1.5" />Create First Brand
                </button>
            )}
        </div>
    )
}
