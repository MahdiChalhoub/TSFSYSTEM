// @ts-nocheck
'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
    Search, Package, Loader2, ExternalLink, X, Info, ArrowRightLeft,
    Check, AlertTriangle, SlidersHorizontal, Paintbrush, Tag, Link2,
    Plus, Folder, ChevronRight, Pencil
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { NumericRangeFilter, EMPTY_RANGE, type NumericRange } from '@/components/ui/NumericRangeFilter'
import { erpFetch } from '@/lib/erp-api'

/* ═══════════════════════════════════════════════════════════
 *  Products Tab — multi-select + filters + smart move modal
 * ═══════════════════════════════════════════════════════════ */
export function ProductsTab({ categoryId, categoryName, allCategories }: {
    categoryId: number; categoryName: string; allCategories: any[]
}) {
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
    const [filterUnit, setFilterUnit] = useState('')
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
    const [catSearch, setCatSearch] = useState('')
    const [autoLinkBrands, setAutoLinkBrands] = useState<Set<number>>(new Set())
    const [autoLinkAttrs, setAutoLinkAttrs] = useState<Set<number>>(new Set())
    const [reassignBrands, setReassignBrands] = useState<Record<number, number>>({})
    const [reassignAttrs, setReassignAttrs] = useState<Record<number, number>>({})
    const router = useRouter()

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300)
        return () => clearTimeout(timer)
    }, [search])

    const loadProducts = useCallback((offset = 0, append = false) => {
        if (!append) setLoading(true)
        else setLoadingMore(true)
        const params = new URLSearchParams()
        if (offset > 0) params.set('offset', String(offset))
        if (debouncedSearch) params.set('search', debouncedSearch)
        params.set('sort', sortBy)
        params.set('sort_dir', sortDir)
        const qs = params.toString() ? `?${params.toString()}` : ''
        erpFetch(`inventory/categories/${categoryId}/explore/${qs}`)
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
            .catch(() => { if (!append) setProducts([]); setLoading(false); setLoadingMore(false) })
    }, [categoryId, debouncedSearch, sortBy, sortDir])

    useEffect(() => { setSelected(new Set()); loadProducts(0, false) }, [loadProducts])

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

    const uniqueBrands = useMemo(() => (filterOptions.brands || []).map((o: any) => o.value), [filterOptions])
    const uniqueStatuses = useMemo(() => (filterOptions.statuses || []).map((o: any) => o.value), [filterOptions])
    const uniqueTypes = useMemo(() => (filterOptions.types || []).map((o: any) => o.value), [filterOptions])
    const uniqueUnits = useMemo(() => (filterOptions.units || []).map((o: any) => o.value), [filterOptions])
    const uniqueTvaRates = useMemo(() => (filterOptions.tva_rates || []).map((o: any) => o.value), [filterOptions])

    useEffect(() => {
        erpFetch('finance/tax-groups/')
            .then((data: any) => { setTaxGroups(Array.isArray(data) ? data : data?.results ?? []) })
            .catch(() => {})
    }, [])

    const activeFilterCount = (filterBrand ? 1 : 0) + (filterStatus ? 1 : 0) + (filterType ? 1 : 0) +
        (filterUnit ? 1 : 0) + (filterTva ? 1 : 0) + (filterMargin.op ? 1 : 0) + (filterPrice.op ? 1 : 0)

    const clearAllFilters = () => {
        setFilterBrand(''); setFilterStatus(''); setFilterType('')
        setFilterUnit(''); setFilterTva('')
        setFilterMargin(EMPTY_RANGE); setFilterPrice(EMPTY_RANGE)
    }

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
        if (filterUnit) list = list.filter(p => matchFilter(p.unit_code, filterUnit))
        if (filterTva) list = list.filter(p => matchFilter(String(p.tva_rate), filterTva))
        if (filterMargin.op) list = list.filter(p => applyRange(p.margin_pct, filterMargin))
        if (filterPrice.op) list = list.filter(p => applyRange(p.selling_price_ttc, filterPrice))
        return list
    }, [products, filterBrand, filterStatus, filterType, filterUnit, filterTva, filterMargin, filterPrice])

    const toggleSelect = (id: number) => { const next = new Set(selected); next.has(id) ? next.delete(id) : next.add(id); setSelected(next) }
    const toggleAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map(p => p.id))) }

    const openMoveModal = () => { setShowMoveModal(true); setMoveStep('picking'); setMoveTarget(null); setMovePreview(null); setCatSearch('') }
    const closeMoveModal = () => { setShowMoveModal(false); setMoveStep('picking'); setMoveTarget(null); setMovePreview(null); setCatSearch(''); setReassignBrands({}); setReassignAttrs({}) }

    const moveTargets = allCategories.filter((c: any) => c.id !== categoryId)
    const filteredTargets = catSearch.trim()
        ? moveTargets.filter((c: any) => c.name?.toLowerCase().includes(catSearch.toLowerCase()) || c.full_path?.toLowerCase().includes(catSearch.toLowerCase()))
        : moveTargets

    const previewMove = async (targetId: number) => {
        setMoveTarget(targetId); setMoveStep('preview')
        try {
            const preview = await erpFetch('inventory/categories/move_products/', {
                method: 'POST', body: JSON.stringify({ product_ids: Array.from(selected), target_category_id: targetId, preview: true }),
            })
            setMovePreview(preview)
            setAutoLinkBrands(new Set((preview.conflict_brands || []).map((b: any) => b.id)))
            setAutoLinkAttrs(new Set((preview.conflict_attributes || []).map((a: any) => a.id)))
            setReassignBrands({}); setReassignAttrs({})
        } catch (e: any) { toast.error(e?.message || 'Failed to analyze move'); setMoveStep('picking') }
    }

    const executeMove = async () => {
        if (!moveTarget) return
        setMoveStep('executing')
        try {
            await erpFetch('inventory/categories/move_products/', {
                method: 'POST',
                body: JSON.stringify({
                    product_ids: Array.from(selected), target_category_id: moveTarget,
                    reconciliation: { auto_link_brands: Array.from(autoLinkBrands), auto_link_attributes: Array.from(autoLinkAttrs), reassign_brands: reassignBrands, reassign_attributes: reassignAttrs },
                }),
            })
            toast.success(`Moved ${selected.size} product${selected.size > 1 ? 's' : ''} to "${movePreview?.target_category?.name}"`)
            closeMoveModal(); setSelected(new Set()); loadProducts(0, false); router.refresh()
        } catch (e: any) { toast.error(e?.message || 'Move failed'); setMoveStep('preview') }
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            {/* Search + Select All + Filter Button */}
            <div className="flex-shrink-0 px-4 py-2.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-1.5">
                    {!loading && products.length > 0 && (
                        <button onClick={toggleAll}
                            className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all"
                            style={{ borderColor: selected.size > 0 ? 'var(--app-primary)' : 'var(--app-border)', background: selected.size === filtered.length && selected.size > 0 ? 'var(--app-primary)' : 'transparent' }}>
                            {selected.size === filtered.length && selected.size > 0 && <Check size={10} className="text-white" />}
                            {selected.size > 0 && selected.size < filtered.length && <div className="w-1.5 h-1.5 rounded-sm bg-app-primary" />}
                        </button>
                    )}
                    <div className="relative flex-1">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder={`Search in "${categoryName}"...`}
                            className="w-full pl-8 pr-3 py-1.5 text-tp-md bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all" />
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                        {(['name', 'stock', 'price'] as const).map(s => (
                            <button key={s}
                                onClick={() => { if (sortBy === s) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(s); setSortDir('asc') } }}
                                className="text-tp-xxs font-bold px-1.5 py-1 rounded-lg transition-all"
                                style={{ background: sortBy === s ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent', color: sortBy === s ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }}>
                                {s === 'name' ? 'A-Z' : s === 'stock' ? 'Qty' : '₵'}
                                {sortBy === s && <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                            </button>
                        ))}
                    </div>
                    {/* Filter Button */}
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
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-app-primary text-white text-tp-xxs font-black flex items-center justify-center">{activeFilterCount}</span>
                            )}
                        </button>

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
                                            <span className="text-tp-sm font-black uppercase tracking-wider text-app-foreground">Filters</span>
                                            {activeFilterCount > 0 && <span className="text-tp-xxs font-black px-1.5 py-0.5 rounded-full bg-app-primary text-white">{activeFilterCount}</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {activeFilterCount > 0 && <button onClick={clearAllFilters} className="text-tp-xs font-bold text-app-error hover:underline">Clear all</button>}
                                            <button onClick={() => setShowFilterPopup(false)} className="p-1 rounded-lg hover:bg-app-border/50 text-app-muted-foreground hover:text-app-foreground transition-all"><X size={14} /></button>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                            <SearchableDropdown label="Type" value={filterType} onChange={setFilterType} options={uniqueTypes.map((t: string) => ({ value: t, label: t }))} placeholder="All Types" />
                                            <SearchableDropdown label="Brand" value={filterBrand} onChange={setFilterBrand} options={uniqueBrands.map((b: string) => ({ value: b, label: b }))} placeholder="All Brands" />
                                            <SearchableDropdown label="Status" value={filterStatus} onChange={setFilterStatus} options={uniqueStatuses.map((s: string) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} placeholder="All Statuses" />
                                            <SearchableDropdown label="Unit" value={filterUnit} onChange={setFilterUnit} options={uniqueUnits.map((u: string) => ({ value: u, label: u }))} placeholder="All Units" />
                                            <SearchableDropdown label="TVA Rate %" value={filterTva} onChange={setFilterTva}
                                                options={taxGroups.length > 0 ? taxGroups.map((tg: any) => ({ value: String(tg.rate), label: `${tg.name} (${tg.rate}%)` })) : uniqueTvaRates.map((r: any) => ({ value: r, label: `${r}%` }))} placeholder="All Rates" />
                                            <NumericRangeFilter label="Margin %" value={filterMargin} onChange={setFilterMargin} />
                                            <NumericRangeFilter label="Price TTC" value={filterPrice} onChange={setFilterPrice} />
                                        </div>
                                    </div>
                                    <div className="px-4 py-2.5 flex items-center justify-between"
                                        style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, var(--app-surface))' }}>
                                        <span className="text-tp-xs font-bold text-app-muted-foreground">{filtered.length} of {totalCount} products</span>
                                        <button onClick={() => setShowFilterPopup(false)}
                                            className="text-tp-sm font-bold px-4 py-1.5 rounded-xl bg-app-primary text-white hover:brightness-110 transition-all"
                                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>Apply Filters</button>
                                    </div>
                                </div>
                            </div>
                        , document.body)}
                    </div>
                </div>
                <p className="text-tp-xs font-bold text-app-muted-foreground mt-1">
                    {loading ? 'Loading...' : selected.size > 0 ? `${selected.size} of ${filtered.length} selected` : activeFilterCount > 0 ? `${filtered.length} of ${totalCount} (filtered)` : `${products.length} of ${totalCount} product${totalCount !== 1 ? 's' : ''}`}
                </p>
            </div>

            {/* Floating Action Bar */}
            {selected.size > 0 && (
                <div className="flex-shrink-0 px-3 py-2 flex items-center justify-between gap-2 animate-in slide-in-from-top-1 duration-150"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <span className="text-tp-sm font-bold text-app-primary">{selected.size} selected</span>
                    <button onClick={openMoveModal}
                        className="flex items-center gap-1.5 text-tp-sm font-bold bg-app-primary text-white px-3 py-1.5 rounded-xl hover:brightness-110 transition-all"
                        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        <ArrowRightLeft size={12} /> Move to Category
                    </button>
                </div>
            )}

            {/* Product List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar" ref={scrollRef}>
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-app-primary" /></div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Package size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground">{search || filterBrand || filterStatus ? 'No matching products' : 'No products in this category'}</p>
                        <p className="text-tp-sm text-app-muted-foreground mt-1">Assign products from the Products page.</p>
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-app-border/30">
                            {filtered.map((p: any) => {
                                const isSelected = selected.has(p.id)
                                return (
                                    <div key={p.id} className="flex items-center gap-2 px-4 py-2 group transition-all cursor-pointer"
                                        style={{ background: isSelected ? 'color-mix(in srgb, var(--app-primary) 6%, transparent)' : 'transparent' }}
                                        onClick={() => toggleSelect(p.id)}>
                                        <button className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all"
                                            style={{ borderColor: isSelected ? 'var(--app-primary)' : 'var(--app-border)', background: isSelected ? 'var(--app-primary)' : 'transparent' }}>
                                            {isSelected && <Check size={10} className="text-white" />}
                                        </button>
                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}>
                                            <Package size={12} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-tp-md font-bold text-app-foreground truncate">{p.name}</p>
                                            <div className="flex items-center gap-2 text-tp-xs text-app-muted-foreground">
                                                {p.sku && <span className="font-mono font-bold">{p.sku}</span>}
                                                {p.brand_name && <span>· {p.brand_name}</span>}
                                            </div>
                                        </div>
                                        <span className="text-tp-sm font-bold tabular-nums flex-shrink-0"
                                            style={{ color: (p.stock_on_hand ?? 0) > 0 ? 'var(--app-success)' : 'var(--app-muted-foreground)' }}>
                                            {Number(p.stock_on_hand ?? 0).toLocaleString()}
                                        </span>
                                        <button onClick={e => { e.stopPropagation(); setPreviewProduct(p) }}
                                            className="p-1 rounded-lg text-app-muted-foreground hover:text-app-primary opacity-0 group-hover:opacity-100 transition-all">
                                            <Info size={11} />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                        <div ref={sentinelRef} className="h-1" />
                        {loadingMore && (
                            <div className="flex items-center justify-center py-3 gap-2">
                                <Loader2 size={14} className="animate-spin text-app-primary" />
                                <span className="text-tp-xs text-app-muted-foreground">Loading more...</span>
                            </div>
                        )}
                        {!hasMore && products.length > 0 && products.length >= 50 && (
                            <p className="text-tp-xs text-app-muted-foreground text-center py-2 opacity-50">All {totalCount} products loaded</p>
                        )}
                    </>
                )}
            </div>

            {/* Product Preview Popup */}
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
                                <p className="text-tp-lg font-black text-app-foreground truncate">{previewProduct.name}</p>
                                {previewProduct.sku && <p className="text-tp-xs font-mono font-bold text-app-muted-foreground">{previewProduct.sku}</p>}
                            </div>
                            <button onClick={() => setPreviewProduct(null)} className="p-1 rounded-lg hover:bg-app-border/50 text-app-muted-foreground hover:text-app-foreground transition-all"><X size={14} /></button>
                        </div>
                        <div className="p-4 space-y-2">
                            {[
                                { label: 'Brand', value: previewProduct.brand_name, color: '#8b5cf6' },
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
                                    <span className="text-tp-xs font-black uppercase tracking-widest text-app-muted-foreground">{r.label}</span>
                                    <span className="text-tp-md font-bold" style={{ color: r.color || 'var(--app-foreground)' }}>{r.value}</span>
                                </div>
                            ))}
                        </div>
                        <div className="px-4 py-2.5 flex items-center justify-end gap-2" style={{ borderTop: '1px solid var(--app-border)' }}>
                            <Link href={`/inventory/products/${previewProduct.id}`}
                                className="flex items-center gap-1.5 text-tp-sm font-bold px-3 py-1.5 rounded-xl bg-app-primary text-white hover:brightness-110 transition-all"
                                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                <ExternalLink size={11} /> Open Full Page
                            </Link>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Move Modal */}
            {showMoveModal && createPortal(
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
                                    <h3 className="text-sm font-black text-app-foreground">Move Products</h3>
                                    <p className="text-tp-sm text-app-muted-foreground">{selected.size} product{selected.size > 1 ? 's' : ''} from &ldquo;{categoryName}&rdquo;</p>
                                </div>
                            </div>
                            <button onClick={closeMoveModal} className="p-2 rounded-xl hover:bg-app-border/50 text-app-muted-foreground hover:text-app-foreground transition-all"><X size={16} /></button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-5 py-4" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            {moveStep === 'picking' && (
                                <div className="space-y-3">
                                    <p className="text-tp-xs font-black uppercase tracking-widest text-app-muted-foreground">Select target category</p>
                                    <div className="relative">
                                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                        <input value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="Search categories..." autoFocus
                                            className="w-full pl-9 pr-3 py-2 text-tp-md bg-app-background border border-app-border rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none focus:border-app-primary transition-all" />
                                    </div>
                                    <div className="max-h-52 overflow-y-auto custom-scrollbar rounded-xl border border-app-border/50">
                                        {filteredTargets.length === 0 ? (
                                            <p className="text-tp-sm text-app-muted-foreground p-4 text-center">No categories found</p>
                                        ) : filteredTargets.map((cat: any) => (
                                            <button key={cat.id} onClick={() => previewMove(cat.id)}
                                                className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 text-tp-md font-medium text-app-foreground hover:bg-app-border/20 transition-all"
                                                style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', color: 'var(--app-primary)' }}>
                                                    <Folder size={12} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold truncate">{cat.name}</p>
                                                    {cat.full_path && cat.full_path !== cat.name && <p className="text-tp-xs text-app-muted-foreground truncate">{cat.full_path}</p>}
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
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)' }}><Folder size={12} className="text-app-muted-foreground" /></div>
                                            <span className="text-tp-md font-bold text-app-foreground truncate">{categoryName}</span>
                                        </div>
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)' }}><ArrowRightLeft size={11} className="text-app-primary" /></div>
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                                            <span className="text-tp-md font-black text-app-primary truncate">{movePreview.target_category?.name}</span>
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)' }}><Folder size={12} className="text-app-primary" /></div>
                                        </div>
                                    </div>

                                    {!movePreview.has_conflicts && (
                                        <div className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--app-success) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-success) 15%, transparent)' }}>
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-success) 15%, transparent)' }}><Check size={14} style={{ color: 'var(--app-success)' }} /></div>
                                            <div><p className="text-tp-md font-bold" style={{ color: 'var(--app-success)' }}>Ready to move</p><p className="text-tp-xs text-app-muted-foreground">All brands and attributes are compatible.</p></div>
                                        </div>
                                    )}

                                    {movePreview.has_conflicts && (
                                        <>
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-warning) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 12%, transparent)' }}>
                                                <AlertTriangle size={13} style={{ color: 'var(--app-warning)' }} />
                                                <p className="text-tp-sm font-bold" style={{ color: 'var(--app-warning)' }}>Resolve conflicts before moving</p>
                                            </div>

                                            {/* Brand conflicts */}
                                            {movePreview.conflict_brands?.length > 0 && (
                                                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                                                    <div className="px-3 py-2 flex items-center justify-between" style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', borderBottom: '1px solid var(--app-border)' }}>
                                                        <div className="flex items-center gap-1.5"><Paintbrush size={11} style={{ color: '#8b5cf6' }} /><span className="text-tp-xs font-black uppercase tracking-widest" style={{ color: '#8b5cf6' }}>Brand Conflicts</span></div>
                                                        <span className="text-tp-xxs font-bold text-app-muted-foreground">{movePreview.conflict_brands.length} to resolve</span>
                                                    </div>
                                                    <div className="divide-y divide-app-border/30">
                                                        {movePreview.conflict_brands.map((b: any) => {
                                                            const isLinked = autoLinkBrands.has(b.id)
                                                            const isReassigned = b.id in reassignBrands
                                                            const resolved = isLinked || isReassigned
                                                            const reassignedTo = isReassigned ? movePreview.target_brands?.find((tb: any) => tb.id === reassignBrands[b.id])?.name : null
                                                            return (
                                                                <div key={b.id} className="px-3 py-2.5">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-tp-md font-bold text-app-foreground">{b.name}</span>
                                                                            <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)', color: 'var(--app-muted-foreground)' }}>{b.affected_count} product{b.affected_count > 1 ? 's' : ''}</span>
                                                                        </div>
                                                                        <span className="text-tp-xxs font-black px-1.5 py-0.5 rounded" style={{ background: resolved ? 'color-mix(in srgb, var(--app-success) 10%, transparent)' : 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: resolved ? 'var(--app-success)' : 'var(--app-error)' }}>
                                                                            {isLinked ? '✓ Will link' : isReassigned ? `→ ${reassignedTo}` : '⚠ Unresolved'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <button onClick={() => { const next = new Set(autoLinkBrands); if (isLinked) { next.delete(b.id) } else { next.add(b.id) }; setAutoLinkBrands(next); if (!isLinked) { const r = { ...reassignBrands }; delete r[b.id]; setReassignBrands(r) } }}
                                                                            className="text-tp-xs font-bold px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
                                                                            style={{ background: isLinked ? 'color-mix(in srgb, var(--app-success) 12%, transparent)' : 'color-mix(in srgb, var(--app-border) 40%, transparent)', color: isLinked ? 'var(--app-success)' : 'var(--app-muted-foreground)', border: isLinked ? '1px solid color-mix(in srgb, var(--app-success) 20%, transparent)' : '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                                                            <Link2 size={10} /> Link to category
                                                                        </button>
                                                                        {!isLinked && (movePreview.all_brands?.length > 0 ? (
                                                                            <select value={isReassigned ? String(reassignBrands[b.id]) : ''} onChange={e => { const val = e.target.value; if (val) { setReassignBrands({ ...reassignBrands, [b.id]: Number(val) }); const next = new Set(autoLinkBrands); next.delete(b.id); setAutoLinkBrands(next) } else { const r = { ...reassignBrands }; delete r[b.id]; setReassignBrands(r) } }}
                                                                                className="text-tp-xs font-bold px-2 py-1.5 rounded-lg bg-app-background text-app-foreground outline-none flex-1 min-w-0 transition-all"
                                                                                style={{ border: isReassigned ? '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)' : '1px solid color-mix(in srgb, var(--app-error) 40%, transparent)', color: isReassigned ? 'var(--app-primary)' : undefined, animation: !isReassigned ? 'pulse 2s ease-in-out infinite' : 'none' }}>
                                                                                <option value="">⚠ Reassign to brand...</option>
                                                                                {movePreview.all_brands.filter((tb: any) => tb.id !== b.id).map((tb: any) => (<option key={tb.id} value={String(tb.id)}>{tb.name}</option>))}
                                                                            </select>
                                                                        ) : (<span className="text-tp-xxs font-bold px-2 py-1 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', color: 'var(--app-error)' }}>No brands available — must link</span>))}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Attribute conflicts */}
                                            {movePreview.conflict_attributes?.length > 0 && (
                                                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                                                    <div className="px-3 py-2 flex items-center justify-between" style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', borderBottom: '1px solid var(--app-border)' }}>
                                                        <div className="flex items-center gap-1.5"><Tag size={11} style={{ color: 'var(--app-warning)' }} /><span className="text-tp-xs font-black uppercase tracking-widest" style={{ color: 'var(--app-warning)' }}>Attribute Conflicts</span></div>
                                                        <span className="text-tp-xxs font-bold text-app-muted-foreground">{movePreview.conflict_attributes.length} to resolve</span>
                                                    </div>
                                                    <div className="divide-y divide-app-border/30">
                                                        {movePreview.conflict_attributes.map((a: any) => {
                                                            const isLinked = autoLinkAttrs.has(a.id)
                                                            const isReassigned = a.id in reassignAttrs
                                                            const resolved = isLinked || isReassigned
                                                            const reassignedTo = isReassigned ? movePreview.all_attributes?.find((ta: any) => ta.id === reassignAttrs[a.id])?.name : null
                                                            return (
                                                                <div key={a.id} className="px-3 py-2.5">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-tp-md font-bold text-app-foreground">{a.name}</span>
                                                                            {a.code && <span className="text-tp-xs font-mono text-app-muted-foreground">{a.code}</span>}
                                                                        </div>
                                                                        <span className="text-tp-xxs font-black px-1.5 py-0.5 rounded" style={{ background: resolved ? 'color-mix(in srgb, var(--app-success) 10%, transparent)' : 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: resolved ? 'var(--app-success)' : 'var(--app-error)' }}>
                                                                            {isLinked ? '✓ Will link' : isReassigned ? `→ ${reassignedTo}` : '⚠ Unresolved'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <button onClick={() => { const next = new Set(autoLinkAttrs); if (isLinked) { next.delete(a.id) } else { next.add(a.id) }; setAutoLinkAttrs(next); if (!isLinked) { const r = { ...reassignAttrs }; delete r[a.id]; setReassignAttrs(r) } }}
                                                                            className="text-tp-xs font-bold px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
                                                                            style={{ background: isLinked ? 'color-mix(in srgb, var(--app-success) 12%, transparent)' : 'color-mix(in srgb, var(--app-border) 40%, transparent)', color: isLinked ? 'var(--app-success)' : 'var(--app-muted-foreground)', border: isLinked ? '1px solid color-mix(in srgb, var(--app-success) 20%, transparent)' : '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                                                            <Link2 size={10} /> Link to category
                                                                        </button>
                                                                        {!isLinked && (movePreview.all_attributes?.length > 0 ? (
                                                                            <select value={isReassigned ? String(reassignAttrs[a.id]) : ''} onChange={e => { const val = e.target.value; if (val) { setReassignAttrs({ ...reassignAttrs, [a.id]: Number(val) }); const next = new Set(autoLinkAttrs); next.delete(a.id); setAutoLinkAttrs(next) } else { const r = { ...reassignAttrs }; delete r[a.id]; setReassignAttrs(r) } }}
                                                                                className="text-tp-xs font-bold px-2 py-1.5 rounded-lg bg-app-background text-app-foreground outline-none flex-1 min-w-0 transition-all"
                                                                                style={{ border: isReassigned ? '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)' : '1px solid color-mix(in srgb, var(--app-error) 40%, transparent)', color: isReassigned ? 'var(--app-primary)' : undefined, animation: !isReassigned ? 'pulse 2s ease-in-out infinite' : 'none' }}>
                                                                                <option value="">⚠ Reassign to attribute...</option>
                                                                                {movePreview.all_attributes.filter((ta: any) => ta.id !== a.id).map((ta: any) => (<option key={ta.id} value={String(ta.id)}>{ta.name}</option>))}
                                                                            </select>
                                                                        ) : (<span className="text-tp-xxs font-bold px-2 py-1 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', color: 'var(--app-error)' }}>No attributes available — must link</span>))}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {moveStep === 'preview' && !movePreview && (
                                        <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        {(moveStep === 'preview' || moveStep === 'executing') && movePreview && (() => {
                            const unresolvedBrands = (movePreview.conflict_brands || []).filter((b: any) => !autoLinkBrands.has(b.id) && !(b.id in reassignBrands))
                            const unresolvedAttrs = (movePreview.conflict_attributes || []).filter((a: any) => !autoLinkAttrs.has(a.id) && !(a.id in reassignAttrs))
                            const hasUnresolved = unresolvedBrands.length > 0 || unresolvedAttrs.length > 0
                            const canMove = !hasUnresolved && moveStep !== 'executing'
                            return (
                                <div className="px-5 py-3 space-y-2" style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, var(--app-surface))' }}>
                                    {hasUnresolved && (
                                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error) 15%, transparent)' }}>
                                            <AlertTriangle size={12} style={{ color: 'var(--app-error)' }} />
                                            <p className="text-tp-xs font-bold" style={{ color: 'var(--app-error)' }}>
                                                {unresolvedBrands.length > 0 && `${unresolvedBrands.length} brand${unresolvedBrands.length > 1 ? 's' : ''} must be linked or reassigned`}
                                                {unresolvedBrands.length > 0 && unresolvedAttrs.length > 0 && ' · '}
                                                {unresolvedAttrs.length > 0 && `${unresolvedAttrs.length} attribute${unresolvedAttrs.length > 1 ? 's' : ''} must be linked`}
                                            </p>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => { setMoveStep('picking'); setMovePreview(null) }}
                                            className="flex-1 text-tp-md font-bold py-2 rounded-xl border border-app-border text-app-muted-foreground hover:bg-app-border/30 transition-all">← Back</button>
                                        <button onClick={executeMove} disabled={!canMove}
                                            className="flex-[2] flex items-center justify-center gap-2 text-tp-md font-bold bg-app-primary text-white py-2 rounded-xl hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                            style={{ boxShadow: canMove ? '0 4px 12px color-mix(in srgb, var(--app-primary) 25%, transparent)' : 'none' }}>
                                            {moveStep === 'executing' ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                                            {moveStep === 'executing' ? 'Moving...' : `Move ${selected.size} Product${selected.size > 1 ? 's' : ''}`}
                                        </button>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>
            , document.body)}
        </div>
    )
}
