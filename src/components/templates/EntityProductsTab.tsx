// @ts-nocheck
'use client'

/**
 * ═══════════════════════════════════════════════════════════
 *  EntityProductsTab — Reusable template component
 *
 *  A universal, configurable Products tab for any entity
 *  (Category, Unit, Brand, etc.). Features:
 *  - Multi-select with Select All + floating action bar
 *  - Debounced server-side search
 *  - Sort toggle (Name, Stock, Price)
 *  - Advanced filter popup (SearchableDropdown + NumericRangeFilter)
 *  - Infinite scroll with IntersectionObserver
 *  - Product preview popup
 *  - Move-to-entity modal (configurable)
 *
 *  Usage:
 *    <EntityProductsTab config={{
 *      entityType: 'unit',
 *      entityId: node.id,
 *      entityName: node.name,
 *      exploreEndpoint: `units/${node.id}/explore/`,
 *      moveEndpoint: 'units/move_products/',
 *      moveTargets: allUnits,
 *      moveLabel: 'Move to Unit',
 *      moveTargetKey: 'target_unit_id',
 *    }} />
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
    Search, Package, Loader2, ExternalLink, X, Info, ArrowRightLeft,
    Check, SlidersHorizontal, ChevronRight, Folder, Ruler, AlertTriangle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { NumericRangeFilter, EMPTY_RANGE, type NumericRange } from '@/components/ui/NumericRangeFilter'
import { erpFetch } from '@/lib/erp-api'
import { revalidateEntityPath } from '@/app/actions/inventory/revalidate'

/* ═══════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════ */
export interface EntityProductsTabConfig {
    /** Entity type label — used in UI text ('category', 'unit', etc.) */
    entityType: string
    entityId: number
    entityName: string

    /** API endpoint for explore (e.g. 'inventory/categories/5/explore/') */
    exploreEndpoint: string

    /** API endpoint for move (e.g. 'inventory/categories/move_products/' or 'units/move_products/') */
    moveEndpoint?: string
    /** Key for the target ID in the move request body (e.g. 'target_category_id' or 'target_unit_id') */
    moveTargetKey?: string
    /** List of possible move targets */
    moveTargets?: any[]
    /** Label for the move button (e.g. 'Move to Category') */
    moveLabel?: string
    /** Icon for target items in the move modal */
    moveIcon?: ReactNode
    /** Path prefix for target items (e.g. 'full_path' for categories) */
    moveTargetPathKey?: string

    /** Optional conflict resolver for the move preview (Categories uses this for brand/attribute conflicts) */
    moveConflictRenderer?: (props: {
        preview: any
        onResolve: (reconciliation: any) => void
        reconciliation: any
    }) => ReactNode
}

/* ═══════════════════════════════════════════════════════════
 *  COMPONENT
 * ═══════════════════════════════════════════════════════════ */
export function EntityProductsTab({ config }: { config: EntityProductsTabConfig }) {
    const {
        entityType, entityId, entityName,
        exploreEndpoint,
        moveEndpoint, moveTargetKey = 'target_category_id',
        moveTargets = [], moveLabel = 'Move',
        moveIcon, moveTargetPathKey = 'full_path',
        moveConflictRenderer,
    } = config

    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [nextOffset, setNextOffset] = useState<number | null>(null)
    const [totalCount, setTotalCount] = useState(0)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price'>('name')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
    const [previewProduct, setPreviewProduct] = useState<any>(null)
    const [filterOptions, setFilterOptions] = useState<any>({})
    const [filterBrand, setFilterBrand] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [filterType, setFilterType] = useState('')
    const [filterCategory, setFilterCategory] = useState('')
    const [filterTva, setFilterTva] = useState('')
    const [taxGroups, setTaxGroups] = useState<any[]>([])
    const [filterMargin, setFilterMargin] = useState<NumericRange>(EMPTY_RANGE)
    const [filterPrice, setFilterPrice] = useState<NumericRange>(EMPTY_RANGE)
    const [showFilterPopup, setShowFilterPopup] = useState(false)
    const filterRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const sentinelRef = useRef<HTMLDivElement>(null)
    const [showMoveModal, setShowMoveModal] = useState(false)
    const [moveTarget, setMoveTarget] = useState<number | null>(null)
    const [movePreview, setMovePreview] = useState<any>(null)
    const [moveStep, setMoveStep] = useState<'picking' | 'preview' | 'executing'>('picking')
    // Packaging-conflict resolution. When the preview reports cross-family
    // packagings, the operator must explicitly pick `detach` (delete the
    // affected ProductPackaging rows — recommended) or `keep` (orphan them
    // — legacy behavior, accepts the silent break) before the Move button
    // re-enables. Reset between modal opens.
    const [packagingAction, setPackagingAction] = useState<'detach' | 'keep' | null>(null)
    const [targetSearch, setTargetSearch] = useState('')
    const [reconciliation, setReconciliation] = useState<any>({})
    const router = useRouter()

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300)
        return () => clearTimeout(timer)
    }, [search])

    // Load products from explore endpoint
    const loadProducts = useCallback((offset = 0, append = false) => {
        if (!append) setLoading(true)
        else setLoadingMore(true)
        const params = new URLSearchParams()
        if (offset > 0) params.set('offset', String(offset))
        if (debouncedSearch) params.set('search', debouncedSearch)
        params.set('sort', sortBy)
        params.set('sort_dir', sortDir)
        const qs = params.toString() ? `?${params.toString()}` : ''
        erpFetch(`${exploreEndpoint}${qs}`)
            .then((data: any) => {
                const newProducts = data?.products ?? []
                if (append) setProducts(prev => [...prev, ...newProducts])
                else setProducts(newProducts)
                setTotalCount(data?.total_count ?? 0)
                setHasMore(data?.has_more ?? false)
                setNextOffset(data?.next_offset ?? null)
                if (!append && data?.filter_options) setFilterOptions(data.filter_options)
                setLoading(false); setLoadingMore(false)
            })
            .catch((err) => { console.error('[EntityProductsTab] explore failed:', exploreEndpoint, err); if (!append) setProducts([]); setLoading(false); setLoadingMore(false) })
    }, [exploreEndpoint, debouncedSearch, sortBy, sortDir])

    // Reset when entity or search changes
    useEffect(() => { setSelected(new Set()); loadProducts(0, false) }, [loadProducts])

    // Infinite scroll observer
    useEffect(() => {
        const sentinel = sentinelRef.current
        if (!sentinel) return
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting && hasMore && !loadingMore && nextOffset !== null) loadProducts(nextOffset, true) },
            { root: scrollRef.current, threshold: 0.1 }
        )
        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [hasMore, loadingMore, nextOffset, loadProducts])

    // Extract filter option values
    const uniqueBrands = useMemo(() => (filterOptions.brands || []).map((o: any) => o.value), [filterOptions])
    const uniqueStatuses = useMemo(() => (filterOptions.statuses || []).map((o: any) => o.value), [filterOptions])
    const uniqueTypes = useMemo(() => (filterOptions.types || []).map((o: any) => o.value), [filterOptions])
    const uniqueCategories = useMemo(() => (filterOptions.categories || filterOptions.units || []).map((o: any) => o.value), [filterOptions])
    const uniqueTvaRates = useMemo(() => (filterOptions.tva_rates || []).map((o: any) => o.value), [filterOptions])

    // Load tax groups for TVA filter labels
    useEffect(() => {
        erpFetch('finance/tax-groups/')
            .then((data: any) => { setTaxGroups(Array.isArray(data) ? data : data?.results ?? []) })
            .catch(() => {})
    }, [])

    // Filter count
    const activeFilterCount = (filterBrand ? 1 : 0) + (filterStatus ? 1 : 0) + (filterType ? 1 : 0) +
        (filterCategory ? 1 : 0) + (filterTva ? 1 : 0) + (filterMargin.op ? 1 : 0) + (filterPrice.op ? 1 : 0)

    const clearAllFilters = () => {
        setFilterBrand(''); setFilterStatus(''); setFilterType('')
        setFilterCategory(''); setFilterTva('')
        setFilterMargin(EMPTY_RANGE); setFilterPrice(EMPTY_RANGE)
    }

    // Range filter logic
    const applyRange = (val: number | null | undefined, range: NumericRange): boolean => {
        if (!range.op || val === null || val === undefined) return true
        const a = Number(range.a), b = Number(range.b)
        switch (range.op) {
            case 'eq': return val === a
            case 'gt': return val > a
            case 'gte': return val >= a
            case 'lt': return val < a
            case 'lte': return val <= a
            case 'between': return val >= a && val <= b
            default: return true
        }
    }

    // Client-side filtering (on top of server search)
    const filtered = useMemo(() => {
        let list = products
        const matchFilter = (val: string | undefined, filter: string) => {
            if (!filter) return true
            const isNot = filter.startsWith('!')
            const raw = isNot ? filter.slice(1) : filter
            if (!raw) return true
            return isNot ? val !== raw : val === raw
        }
        if (filterBrand) list = list.filter(p => matchFilter(p.brand_name, filterBrand))
        if (filterStatus) list = list.filter(p => matchFilter(p.status, filterStatus))
        if (filterType) list = list.filter(p => matchFilter(p.product_type, filterType))
        if (filterCategory) list = list.filter(p => matchFilter(p.category_name || p.unit_code, filterCategory))
        if (filterTva) list = list.filter(p => matchFilter(String(p.tva_rate), filterTva))
        if (filterMargin.op) list = list.filter(p => applyRange(p.margin_pct, filterMargin))
        if (filterPrice.op) list = list.filter(p => applyRange(p.selling_price_ttc, filterPrice))
        return list
    }, [products, filterBrand, filterStatus, filterType, filterCategory, filterTva, filterMargin, filterPrice])

    // Selection
    const toggleSelect = (id: number) => { const next = new Set(selected); next.has(id) ? next.delete(id) : next.add(id); setSelected(next) }
    const toggleAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map(p => p.id))) }

    // Move modal
    const openMoveModal = () => { setShowMoveModal(true); setMoveStep('picking'); setMoveTarget(null); setMovePreview(null); setTargetSearch(''); setReconciliation({}) }
    const closeMoveModal = () => { setShowMoveModal(false); setMoveStep('picking'); setMoveTarget(null); setMovePreview(null); setTargetSearch(''); setReconciliation({}) }

    const filteredTargets = targetSearch.trim()
        ? moveTargets.filter((t: any) => t.name?.toLowerCase().includes(targetSearch.toLowerCase()) || t[moveTargetPathKey]?.toLowerCase().includes(targetSearch.toLowerCase()))
        : moveTargets

    const previewMove = async (targetId: number) => {
        setMoveTarget(targetId); setMoveStep('preview')
        setPackagingAction(null)
        try {
            const preview = await erpFetch(moveEndpoint!, {
                method: 'POST', body: JSON.stringify({ product_ids: Array.from(selected), [moveTargetKey]: targetId, preview: true }),
            })
            setMovePreview(preview)
        } catch (e: any) { toast.error(e?.message || 'Failed to analyze move'); setMoveStep('picking') }
    }

    const executeMove = async () => {
        if (!moveTarget || !moveEndpoint) return
        setMoveStep('executing')
        try {
            await erpFetch(moveEndpoint, {
                method: 'POST',
                body: JSON.stringify({
                    product_ids: Array.from(selected),
                    [moveTargetKey]: moveTarget,
                    ...(Object.keys(reconciliation).length > 0 ? { reconciliation } : {}),
                    ...(packagingAction ? { packaging_action: packagingAction } : {}),
                }),
            })
            const targetName = moveTargets.find((t: any) => t.id === moveTarget)?.name || 'target'
            toast.success(`Moved ${selected.size} product${selected.size > 1 ? 's' : ''} to "${targetName}"`)
            closeMoveModal(); setSelected(new Set())
            // Bust the Next.js 30s fetch cache for the inventory entity pages so
            // the tree/sidebar badges reflect the new counts immediately.
            try { await revalidateEntityPath(entityType) } catch { /* non-blocking */ }
            // Reload this tab's product list AND trigger server-component re-render.
            loadProducts(0, false)
            router.refresh()
        } catch (e: any) { toast.error(e?.message || 'Move failed'); setMoveStep('preview') }
    }

    // Dynamic secondary label for category/unit column
    const secondaryFilterLabel = entityType === 'unit' ? 'Category' : entityType === 'category' ? 'Unit' : 'Group'

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            {/* ═══ Search + Select All + Sort + Filter ═══ */}
            <div className="flex-shrink-0 px-4 py-2.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-1.5">
                    {/* Select All checkbox */}
                    {!loading && products.length > 0 && (
                        <button onClick={toggleAll}
                            className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all"
                            style={{ borderColor: selected.size > 0 ? 'var(--app-primary)' : 'var(--app-border)', background: selected.size === filtered.length && selected.size > 0 ? 'var(--app-primary)' : 'transparent' }}>
                            {selected.size === filtered.length && selected.size > 0 && <Check size={10} className="text-white" />}
                            {selected.size > 0 && selected.size < filtered.length && <div className="w-1.5 h-1.5 rounded-sm bg-app-primary" />}
                        </button>
                    )}

                    {/* Search input */}
                    <div className="relative flex-1">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder={`Search in "${entityName}"...`}
                            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all" />
                    </div>

                    {/* Sort buttons */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                        {(['name', 'stock', 'price'] as const).map(s => (
                            <button key={s}
                                onClick={() => { if (sortBy === s) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(s); setSortDir('asc') } }}
                                className="text-[9px] font-bold px-1.5 py-1 rounded-lg transition-all"
                                style={{ background: sortBy === s ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent', color: sortBy === s ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }}>
                                {s === 'name' ? 'A-Z' : s === 'stock' ? 'Qty' : '₵'}
                                {sortBy === s && <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                            </button>
                        ))}
                    </div>

                    {/* Filter button */}
                    <div className="relative" ref={filterRef}>
                        <button onClick={() => setShowFilterPopup(!showFilterPopup)}
                            className="relative p-1.5 rounded-lg transition-all flex-shrink-0"
                            style={{
                                background: activeFilterCount > 0 || showFilterPopup ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent',
                                color: activeFilterCount > 0 || showFilterPopup ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                border: activeFilterCount > 0 ? '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' : '1px solid transparent',
                            }}>
                            <SlidersHorizontal size={14} />
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-app-primary text-white text-[8px] font-black flex items-center justify-center">{activeFilterCount}</span>
                            )}
                        </button>

                        {/* Filter popup (portal) */}
                        {showFilterPopup && createPortal(
                            <div className="fixed inset-0 z-[200] flex items-center justify-center animate-in fade-in duration-200"
                                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                                onClick={e => { if (e.target === e.currentTarget) setShowFilterPopup(false) }}>
                                <div className="w-full max-w-md mx-4 rounded-2xl animate-in zoom-in-95 duration-200"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
                                    onClick={e => e.stopPropagation()}>
                                    <div className="px-4 py-2.5 flex items-center justify-between"
                                        style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))' }}>
                                        <div className="flex items-center gap-2">
                                            <SlidersHorizontal size={13} className="text-app-primary" />
                                            <span className="text-[11px] font-black uppercase tracking-wider text-app-foreground">Filters</span>
                                            {activeFilterCount > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-app-primary text-white">{activeFilterCount}</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {activeFilterCount > 0 && <button onClick={clearAllFilters} className="text-[10px] font-bold text-app-error hover:underline">Clear all</button>}
                                            <button onClick={() => setShowFilterPopup(false)} className="p-1 rounded-lg hover:bg-app-border/50 text-app-muted-foreground hover:text-app-foreground transition-all"><X size={14} /></button>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                            <SearchableDropdown label="Type" value={filterType} onChange={setFilterType} options={uniqueTypes.map((t: string) => ({ value: t, label: t }))} placeholder="All Types" />
                                            <SearchableDropdown label="Brand" value={filterBrand} onChange={setFilterBrand} options={uniqueBrands.map((b: string) => ({ value: b, label: b }))} placeholder="All Brands" />
                                            <SearchableDropdown label="Status" value={filterStatus} onChange={setFilterStatus} options={uniqueStatuses.map((s: string) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} placeholder="All Statuses" />
                                            <SearchableDropdown label={secondaryFilterLabel} value={filterCategory} onChange={setFilterCategory} options={uniqueCategories.map((u: string) => ({ value: u, label: u }))} placeholder={`All ${secondaryFilterLabel}s`} />
                                            <SearchableDropdown label="TVA Rate %" value={filterTva} onChange={setFilterTva}
                                                options={taxGroups.length > 0 ? taxGroups.map((tg: any) => ({ value: String(tg.rate), label: `${tg.name} (${tg.rate}%)` })) : uniqueTvaRates.map((r: any) => ({ value: r, label: `${r}%` }))} placeholder="All Rates" />
                                            <NumericRangeFilter label="Margin %" value={filterMargin} onChange={setFilterMargin} />
                                            <NumericRangeFilter label="Price TTC" value={filterPrice} onChange={setFilterPrice} />
                                        </div>
                                    </div>
                                    <div className="px-4 py-2.5 flex items-center justify-between"
                                        style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, var(--app-surface))' }}>
                                        <span className="text-[10px] font-bold text-app-muted-foreground">{filtered.length} of {totalCount} products</span>
                                        <button onClick={() => setShowFilterPopup(false)}
                                            className="text-[11px] font-bold px-4 py-1.5 rounded-xl bg-app-primary text-white hover:brightness-110 transition-all"
                                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>Apply Filters</button>
                                    </div>
                                </div>
                            </div>
                        , document.body)}
                    </div>
                </div>
                <p className="text-[10px] font-bold text-app-muted-foreground mt-1">
                    {loading ? 'Loading...' : selected.size > 0 ? `${selected.size} of ${filtered.length} selected` : activeFilterCount > 0 ? `${filtered.length} of ${totalCount} (filtered)` : `${products.length} of ${totalCount} product${totalCount !== 1 ? 's' : ''}`}
                </p>
            </div>

            {/* ═══ Floating Action Bar (selection active) ═══ */}
            {selected.size > 0 && moveEndpoint && (
                <div className="flex-shrink-0 px-3 py-2 flex items-center justify-between gap-2 animate-in slide-in-from-top-1 duration-150"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <span className="text-[11px] font-bold text-app-primary">{selected.size} selected</span>
                    <button onClick={openMoveModal}
                        className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary text-white px-3 py-1.5 rounded-xl hover:brightness-110 transition-all"
                        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        <ArrowRightLeft size={12} />{moveLabel}
                    </button>
                </div>
            )}

            {/* ═══ Product List ═══ */}
            <div className="flex-1 overflow-y-auto custom-scrollbar" ref={scrollRef}>
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-app-primary" /></div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Package size={32} className="text-app-muted-foreground mb-3 opacity-40" />
                        <p className="text-sm font-bold text-app-foreground">
                            {search || activeFilterCount > 0 ? 'No matching products' : `No products in this ${entityType} yet`}
                        </p>
                        {!(search || activeFilterCount > 0) && (
                            <>
                                <p className="text-[11px] text-app-muted-foreground mt-1 mb-4 max-w-sm">
                                    Create a new product and assign it to <strong>{entityName}</strong>, or browse existing products to re-assign.
                                </p>
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                    <Link
                                        href={`/products/new?${entityType}=${entityId}&${entityType}_name=${encodeURIComponent(entityName)}`}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all"
                                        style={{
                                            background: 'var(--app-primary)',
                                            color: 'white',
                                            boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 35%, transparent)',
                                        }}>
                                        <Package size={12} /> New Product
                                    </Link>
                                    <Link
                                        href={`/inventory/products?${entityType}=${entityId}`}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all"
                                        style={{
                                            color: 'var(--app-muted-foreground)',
                                            border: '1px solid var(--app-border)',
                                        }}>
                                        <ExternalLink size={12} /> Browse &amp; Assign
                                    </Link>
                                </div>
                                <p className="text-[10px] text-app-muted-foreground mt-4 opacity-60">
                                    Tip: you can also bulk-import products from the <Link href="/inventory/products" className="underline">Products page</Link>.
                                </p>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-app-border/30">
                            {filtered.map((p: any) => {
                                const isSelected = selected.has(p.id)
                                return (
                                    <div key={p.id} className="flex items-center gap-2 px-4 py-2 group transition-all cursor-pointer"
                                        style={{
                                            background: isSelected ? 'color-mix(in srgb, var(--app-primary) 6%, transparent)' : 'transparent',
                                            // Viewport virtualization — browser skips rendering off-screen rows.
                                            // Avoids DOM bloat after scrolling through thousands of products.
                                            contentVisibility: 'auto',
                                            containIntrinsicSize: '0 44px',
                                        }}
                                        onClick={() => toggleSelect(p.id)}>
                                        {/* Checkbox */}
                                        <button className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all"
                                            style={{ borderColor: isSelected ? 'var(--app-primary)' : 'var(--app-border)', background: isSelected ? 'var(--app-primary)' : 'transparent' }}>
                                            {isSelected && <Check size={10} className="text-white" />}
                                        </button>
                                        {/* Icon */}
                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}>
                                            <Package size={12} />
                                        </div>
                                        {/* Name + meta */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold text-app-foreground truncate">{p.name}</p>
                                            <div className="flex items-center gap-2 text-[10px] text-app-muted-foreground">
                                                {p.sku && <span className="font-mono font-bold">{p.sku}</span>}
                                                {p.brand_name && <span>· {p.brand_name}</span>}
                                                {p.category_name && entityType !== 'category' && <span>· {p.category_name}</span>}
                                                {p.unit_code && entityType !== 'unit' && <span>· {p.unit_code}</span>}
                                            </div>
                                        </div>
                                        {/* Stock */}
                                        <span className="text-[11px] font-bold tabular-nums flex-shrink-0"
                                            style={{ color: (p.stock_on_hand ?? 0) > 0 ? 'var(--app-success)' : 'var(--app-muted-foreground)' }}>
                                            {Number(p.stock_on_hand ?? 0).toLocaleString()}
                                        </span>
                                        {/* Preview button */}
                                        <button onClick={e => { e.stopPropagation(); setPreviewProduct(p) }}
                                            className="p-1 rounded-lg text-app-muted-foreground hover:text-app-primary opacity-0 group-hover:opacity-100 transition-all">
                                            <Info size={11} />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                        {/* Infinite scroll sentinel */}
                        <div ref={sentinelRef} className="h-1" />
                        {loadingMore && (
                            <div className="flex items-center justify-center py-3 gap-2">
                                <Loader2 size={14} className="animate-spin text-app-primary" />
                                <span className="text-[10px] text-app-muted-foreground">Loading more...</span>
                            </div>
                        )}
                        {!hasMore && products.length > 0 && products.length >= 50 && (
                            <p className="text-[10px] text-app-muted-foreground text-center py-2 opacity-50">All {totalCount} products loaded</p>
                        )}
                    </>
                )}
            </div>

            {/* ═══ Product Preview Popup ═══ */}
            {previewProduct && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center animate-in fade-in duration-150"
                    style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setPreviewProduct(null)}>
                    <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="px-4 py-3 flex items-center gap-3"
                            style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))' }}>
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: 'color-mix(in srgb, var(--app-success) 12%, transparent)', color: 'var(--app-success)' }}>
                                <Package size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-black text-app-foreground truncate">{previewProduct.name}</p>
                                {previewProduct.sku && <p className="text-[10px] font-mono font-bold text-app-muted-foreground">{previewProduct.sku}</p>}
                            </div>
                            <button onClick={() => setPreviewProduct(null)} className="p-1 rounded-lg hover:bg-app-border/50 text-app-muted-foreground hover:text-app-foreground transition-all"><X size={14} /></button>
                        </div>
                        <div className="p-4 space-y-2">
                            {[
                                { label: 'Brand', value: previewProduct.brand_name, color: '#8b5cf6' },
                                { label: 'Category', value: previewProduct.category_name },
                                { label: 'Type', value: previewProduct.product_type },
                                { label: 'Status', value: previewProduct.status?.toUpperCase() },
                                { label: 'Unit', value: previewProduct.unit_code },
                                { label: 'Stock', value: Number(previewProduct.stock_on_hand ?? 0).toLocaleString(), color: (previewProduct.stock_on_hand ?? 0) > 0 ? 'var(--app-success)' : 'var(--app-error)' },
                                { label: 'Price TTC', value: `${Number(previewProduct.selling_price_ttc ?? 0).toLocaleString()} CFA` },
                                { label: 'Price HT', value: `${Number(previewProduct.selling_price_ht ?? 0).toLocaleString()} CFA` },
                                { label: 'Cost', value: `${Number(previewProduct.cost_price ?? 0).toLocaleString()} CFA` },
                                { label: 'TVA', value: previewProduct.tva_rate != null ? `${previewProduct.tva_rate}%` : null },
                                { label: 'Margin', value: previewProduct.margin_pct != null ? `${previewProduct.margin_pct}%` : null, color: (previewProduct.margin_pct ?? 0) > 0 ? 'var(--app-success)' : 'var(--app-error)' },
                            ].filter(r => r.value).map(r => (
                                <div key={r.label} className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">{r.label}</span>
                                    <span className="text-[12px] font-bold" style={{ color: r.color || 'var(--app-foreground)' }}>{r.value}</span>
                                </div>
                            ))}
                        </div>
                        <div className="px-4 py-2.5 flex items-center justify-end gap-2" style={{ borderTop: '1px solid var(--app-border)' }}>
                            <Link href={`/inventory/products/${previewProduct.id}`}
                                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl bg-app-primary text-white hover:brightness-110 transition-all"
                                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                <ExternalLink size={11} />Open Full Page
                            </Link>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* ═══ Move Modal ═══ */}
            {showMoveModal && moveEndpoint && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--app-background) 80%, transparent)', backdropFilter: 'blur(8px)' }}
                    onClick={closeMoveModal}>
                    <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}
                        onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="px-5 py-3.5 flex items-center justify-between"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                    style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                    <ArrowRightLeft size={15} className="text-white" />
                                </div>
                                <div>
                                    <h3>Move Products</h3>
                                    <p className="text-[11px] text-app-muted-foreground">{selected.size} product{selected.size > 1 ? 's' : ''} from &ldquo;{entityName}&rdquo;</p>
                                </div>
                            </div>
                            <button onClick={closeMoveModal} className="p-2 rounded-xl hover:bg-app-border/50 text-app-muted-foreground hover:text-app-foreground transition-all"><X size={16} /></button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-5 py-4" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            {moveStep === 'picking' && (
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Select target {entityType}</p>
                                    <div className="relative">
                                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                        <input value={targetSearch} onChange={e => setTargetSearch(e.target.value)} placeholder={`Search ${entityType}s...`} autoFocus
                                            className="w-full pl-9 pr-3 py-2 text-[12px] bg-app-background border border-app-border rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none focus:border-app-primary transition-all" />
                                    </div>
                                    <div className="max-h-52 overflow-y-auto custom-scrollbar rounded-xl border border-app-border/50">
                                        {filteredTargets.length === 0 ? (
                                            <p className="text-[11px] text-app-muted-foreground p-4 text-center">No {entityType}s found</p>
                                        ) : filteredTargets.map((target: any) => (
                                            <button key={target.id} onClick={() => previewMove(target.id)}
                                                className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 text-[12px] font-medium text-app-foreground hover:bg-app-border/20 transition-all"
                                                style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', color: 'var(--app-primary)' }}>
                                                    {moveIcon || <Folder size={12} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold truncate">{target.name}</p>
                                                    {target[moveTargetPathKey] && target[moveTargetPathKey] !== target.name && <p className="text-[10px] text-app-muted-foreground truncate">{target[moveTargetPathKey]}</p>}
                                                    {target.code && <p className="text-[10px] font-mono text-app-muted-foreground">{target.code}</p>}
                                                </div>
                                                <ChevronRight size={13} className="text-app-muted-foreground flex-shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(moveStep === 'preview' || moveStep === 'executing') && movePreview && (
                                <div className="space-y-3">
                                    {/* Move summary */}
                                    <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', border: '1px solid var(--app-border)' }}>
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)' }}>
                                                {moveIcon || <Folder size={12} className="text-app-muted-foreground" />}
                                            </div>
                                            <span className="text-[12px] font-bold text-app-foreground truncate">{entityName}</span>
                                        </div>
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)' }}>
                                            <ArrowRightLeft size={11} className="text-app-primary" />
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                                            <span className="text-[12px] font-black text-app-primary truncate">
                                                {movePreview.target_category?.name || movePreview.target_unit?.name || moveTargets.find((t: any) => t.id === moveTarget)?.name}
                                            </span>
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)' }}>
                                                {moveIcon || <Folder size={12} className="text-app-primary" />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* No conflicts — ready to go */}
                                    {!movePreview.has_conflicts && (
                                        <div className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--app-success) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-success) 15%, transparent)' }}>
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-success) 15%, transparent)' }}>
                                                <Check size={14} style={{ color: 'var(--app-success)' }} />
                                            </div>
                                            <div>
                                                <p className="text-[12px] font-bold" style={{ color: 'var(--app-success)' }}>Ready to move</p>
                                                <p className="text-[10px] text-app-muted-foreground">{selected.size} product{selected.size > 1 ? 's' : ''} will be reassigned.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Cross-family packaging warning (units endpoint sets this) ---------- */}
                                    {Array.isArray(movePreview.packaging_impact) && movePreview.cross_family_count > 0 && (
                                        <div className="rounded-xl overflow-hidden"
                                             style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)' }}>
                                            <div className="flex items-start gap-2.5 p-3" style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 18%, transparent)' }}>
                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                                    style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 18%, transparent)' }}>
                                                    <AlertTriangle size={14} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-bold" style={{ color: 'var(--app-warning, #f59e0b)' }}>
                                                        {movePreview.cross_family_count} product{movePreview.cross_family_count > 1 ? 's have' : ' has'} packaging tied to a different unit family
                                                    </p>
                                                    <p className="text-[10px] text-app-muted-foreground mt-0.5">
                                                        Their packaging ratios are computed against the original base unit. Moving them to <span className="font-bold">{movePreview.target_unit?.name}</span> would silently break stock math unless we drop those rows.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="max-h-32 overflow-y-auto custom-scrollbar text-[10px]">
                                                {movePreview.packaging_impact
                                                    .filter((r: any) => r.same_family === false)
                                                    .slice(0, 12)
                                                    .map((r: any) => (
                                                        <div key={r.product_id}
                                                             className="flex items-center gap-2 px-3 py-1.5"
                                                             style={{ borderTop: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)' }}>
                                                            <span className="font-bold text-app-foreground truncate flex-1">{r.product_name}</span>
                                                            <span className="font-mono text-app-muted-foreground flex-shrink-0">{r.packaging_count} pkg{r.packaging_count > 1 ? 's' : ''} · {r.source_unit_name || '—'}</span>
                                                        </div>
                                                    ))}
                                                {movePreview.packaging_impact.filter((r: any) => r.same_family === false).length > 12 && (
                                                    <div className="px-3 py-1.5 text-app-muted-foreground text-center" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)' }}>
                                                        +{movePreview.packaging_impact.filter((r: any) => r.same_family === false).length - 12} more
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-3 space-y-2" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 18%, transparent)' }}>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-app-muted-foreground">Choose what to do</p>
                                                <label className="flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors"
                                                    style={{ background: packagingAction === 'detach' ? 'color-mix(in srgb, var(--app-primary) 8%, transparent)' : 'transparent', border: `1px solid ${packagingAction === 'detach' ? 'color-mix(in srgb, var(--app-primary) 35%, transparent)' : 'var(--app-border)'}` }}>
                                                    <input type="radio" name="pkg-action" className="mt-0.5 accent-app-primary"
                                                        checked={packagingAction === 'detach'}
                                                        onChange={() => setPackagingAction('detach')} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[12px] font-bold text-app-foreground">Detach packagings <span className="text-app-success">(recommended)</span></p>
                                                        <p className="text-[10px] text-app-muted-foreground">Delete the affected ProductPackaging rows. Past purchase / sales orders that referenced them keep their history; the rows just stop existing for new transactions.</p>
                                                    </div>
                                                </label>
                                                <label className="flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors"
                                                    style={{ background: packagingAction === 'keep' ? 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)' : 'transparent', border: `1px solid ${packagingAction === 'keep' ? 'color-mix(in srgb, var(--app-error, #ef4444) 35%, transparent)' : 'var(--app-border)'}` }}>
                                                    <input type="radio" name="pkg-action" className="mt-0.5 accent-app-error"
                                                        checked={packagingAction === 'keep'}
                                                        onChange={() => setPackagingAction('keep')} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[12px] font-bold text-app-foreground">Force-keep <span className="text-app-error">(dangerous)</span></p>
                                                        <p className="text-[10px] text-app-muted-foreground">Move the products and leave the packaging rows pointing at the old unit. Stock conversions and per-package prices may silently misreport — only do this if you intend to fix them manually.</p>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Conflict resolver (optional — Categories passes this) */}
                                    {movePreview.has_conflicts && moveConflictRenderer && moveConflictRenderer({
                                        preview: movePreview,
                                        onResolve: setReconciliation,
                                        reconciliation,
                                    })}
                                </div>
                            )}

                            {moveStep === 'preview' && !movePreview && (
                                <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        {(moveStep === 'preview' || moveStep === 'executing') && movePreview && (
                            <div className="px-5 py-3 space-y-2" style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, var(--app-surface))' }}>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => { setMoveStep('picking'); setMovePreview(null) }}
                                        className="flex-1 text-[12px] font-bold py-2 rounded-xl border border-app-border text-app-muted-foreground hover:bg-app-border/30 transition-all">← Back</button>
                                    <button onClick={executeMove}
                                        disabled={
                                            moveStep === 'executing'
                                            || (movePreview.has_conflicts && !moveConflictRenderer)
                                            // Cross-family packaging requires explicit operator choice.
                                            || ((movePreview.cross_family_count ?? 0) > 0 && packagingAction === null)
                                        }
                                        className="flex-[2] flex items-center justify-center gap-2 text-[12px] font-bold bg-app-primary text-white py-2 rounded-xl hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                        style={{ boxShadow: moveStep !== 'executing' ? '0 4px 12px color-mix(in srgb, var(--app-primary) 25%, transparent)' : 'none' }}>
                                        {moveStep === 'executing' ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                                        {moveStep === 'executing'
                                            ? 'Moving...'
                                            : packagingAction === 'detach'
                                                ? `Detach packagings + move ${selected.size}`
                                                : packagingAction === 'keep'
                                                    ? `Force-move ${selected.size} (orphan packagings)`
                                                    : `Move ${selected.size} Product${selected.size > 1 ? 's' : ''}`}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            , document.body)}
        </div>
    )
}
