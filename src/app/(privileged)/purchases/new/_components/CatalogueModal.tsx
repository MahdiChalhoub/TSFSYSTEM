'use client'

/**
 * CatalogueModal — full-screen product browser for the PO Intelligence Grid.
 *
 * Wired to backend endpoints:
 *   - `products/`     — paginated products (same source as /inventory/products)
 *   - `categories/`   — filter dimension
 *   - `brands/`       — filter dimension
 *
 * The previous endpoints (`dashboard/catalogue_list/`, `dashboard/catalogue_filters/`)
 * 500'd on this deployment, so the modal now reads from the canonical
 * inventory product master used by the rest of the app.
 *
 * The operator can browse, filter, search, and click products to add them
 * to the PO line list. Already-added products are visually marked.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Search, Package, ChevronDown, Loader2, Check, Filter, Plus, ShoppingCart } from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'

type CatalogueItem = {
    id: number
    name: string
    sku: string
    barcode: string
    category_name: string
    stock: number
    daily_sales: number
    cost_price: number
    effective_cost: number
    cost_price_ht: number
    selling_price: number
    margin_pct: number
    safety_tag: string
}

/** Map a raw `products/` row to the CatalogueItem shape used by this modal. */
function mapProductToCatalogueItem(p: Record<string, any>): CatalogueItem {
    const num = (v: unknown) => {
        const n = typeof v === 'string' ? parseFloat(v) : Number(v)
        return Number.isFinite(n) ? n : 0
    }
    const cost = num(p.cost_price ?? p.cost_price_ttc ?? p.cost_price_ht)
    const sell = num(p.selling_price_ttc ?? p.selling_price_ht)
    const marginPct = sell > 0 ? ((sell - cost) / sell) * 100 : 0
    return {
        id: Number(p.id),
        name: String(p.name || ''),
        sku: String(p.sku || p.code || ''),
        barcode: String(p.barcode || ''),
        category_name: String(p.category_name || ''),
        stock: num(p.on_hand_qty ?? p.available_qty ?? p.stock_qty ?? 0),
        daily_sales: num(p.daily_sales ?? 0),
        cost_price: cost,
        effective_cost: num(p.effective_cost ?? cost),
        cost_price_ht: num(p.cost_price_ht ?? cost),
        selling_price: sell,
        margin_pct: marginPct,
        safety_tag: String(p.safety_tag || ''),
    }
}

type FilterDimensions = {
    categories: { id: number; name: string }[]
    brands: { id: number; name: string }[]
    types: string[]
}

type Props = {
    open: boolean
    onClose: () => void
    onAddProduct: (product: Record<string, any>) => void
    /** IDs of products already in the PO lines */
    existingProductIds: number[]
    /** Supplier filter */
    supplierId?: number | ''
}

export function CatalogueModal({ open, onClose, onAddProduct, existingProductIds, supplierId }: Props) {
    const [items, setItems] = useState<CatalogueItem[]>([])
    const [filters, setFilters] = useState<FilterDimensions | null>(null)
    const [loading, setLoading] = useState(false)
    const [query, setQuery] = useState('')
    const [category, setCategory] = useState('')
    const [brand, setBrand] = useState('')
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [showSupplierOnly, setShowSupplierOnly] = useState(!!supplierId)
    const searchRef = useRef<HTMLInputElement>(null)

    // Sync showSupplierOnly with prop if it changes
    useEffect(() => {
        if (supplierId) setShowSupplierOnly(true)
    }, [supplierId])

    // Fetch filter dimensions once — pull categories + brands directly from
    // the inventory master endpoints (same source as /inventory/products).
    useEffect(() => {
        if (!open) return
        let cancelled = false
        Promise.all([
            erpFetch('categories/').catch(() => []),
            erpFetch('brands/').catch(() => []),
        ]).then(([catsRaw, brandsRaw]) => {
            if (cancelled) return
            const toList = (raw: unknown): Array<Record<string, unknown>> => {
                if (Array.isArray(raw)) return raw
                const r = raw as { results?: unknown } | null
                return Array.isArray(r?.results) ? (r!.results as Array<Record<string, unknown>>) : []
            }
            setFilters({
                categories: toList(catsRaw).map(c => ({ id: Number(c.id), name: String(c.name || '') })),
                brands: toList(brandsRaw).map(b => ({ id: Number(b.id), name: String(b.name || '') })),
                types: [],
            })
        })
        return () => { cancelled = true }
    }, [open])

    // Fetch catalogue items from `products/` — the same DRF endpoint that
    // /inventory/products uses. Server-side pagination + DRF SearchFilter
    // (`?search=`) covers SKU / barcode / name. Filters are passed as
    // `?category=` / `?brand=` (DRF FK filter names).
    const fetchItems = useCallback(async (pageNum: number, append = false) => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(pageNum),
                page_size: '30',
            })
            if (query) params.set('search', query)
            if (category) params.set('category', category)
            if (brand) params.set('brand', brand)
            if (showSupplierOnly && supplierId) params.set('supplier', String(supplierId))

            const data = await erpFetch(`products/?${params}`) as
                | Array<Record<string, unknown>>
                | { results?: Array<Record<string, unknown>>; count?: number; next?: string | null }
                | null
            const rawList: Array<Record<string, unknown>> = Array.isArray(data)
                ? data
                : (data?.results || [])
            const newItems = rawList.map(mapProductToCatalogueItem)
            // DRF returns a `next` URL when more pages exist; fall back to
            // count-based check for compatibility with custom paginators.
            const next = !Array.isArray(data) && data?.next
            const total = !Array.isArray(data) && typeof data?.count === 'number' ? data.count : undefined
            const hasMoreFlag = !!next || (typeof total === 'number' && pageNum * 30 < total)
            setItems(prev => append ? [...prev, ...newItems] : newItems)
            setHasMore(hasMoreFlag)
            setPage(pageNum)
        } catch {
            if (!append) setItems([])
        } finally {
            setLoading(false)
        }
    }, [query, category, brand, supplierId, showSupplierOnly])

    // Refetch on filter/query change
    useEffect(() => {
        if (!open) return
        const timer = setTimeout(() => fetchItems(1), 300)
        return () => clearTimeout(timer)
    }, [open, query, category, brand, showSupplierOnly, fetchItems])

    // Focus search on open
    useEffect(() => {
        if (open) setTimeout(() => searchRef.current?.focus(), 200)
    }, [open])

    if (!open) return null

    const addedSet = new Set(existingProductIds)

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center animate-in fade-in duration-200"
             style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(6px)' }}
             onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-[900px] max-h-[85vh] flex flex-col rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 shadow-2xl"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>

                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b"
                     style={{ borderColor: 'var(--app-border)', background: 'var(--app-background)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                         style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                        <ShoppingCart size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-[15px] font-black text-app-foreground tracking-tight">Product Catalogue</h2>
                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Browse & add products to your order</p>
                    </div>
                    <button type="button" onClick={onClose}
                            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-app-error/10 text-app-muted-foreground hover:text-app-error transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* Search + Filters Bar */}
                <div className="px-5 py-3 flex items-center gap-2 border-b" style={{ borderColor: 'var(--app-border)' }}>
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input ref={searchRef} type="text"
                               className="w-full pl-9 pr-3 py-2 text-[12px] bg-app-background border border-app-border rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                               placeholder="Search by name, SKU, or barcode..."
                               value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                    
                    {/* Supplier filter toggle */}
                    {supplierId && (
                        <button type="button" onClick={() => setShowSupplierOnly((s: boolean) => !s)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${showSupplierOnly ? 'bg-app-success/10 text-app-success border-app-success/30' : 'text-app-muted-foreground border-app-border hover:bg-app-background'}`}>
                            <ShoppingCart size={12} />
                            {showSupplierOnly ? 'Supplier Only' : 'All Products'}
                        </button>
                    )}

                    <button type="button" onClick={() => setFiltersOpen(f => !f)}
                            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-bold border transition-all ${filtersOpen ? 'bg-app-primary/10 text-app-primary border-app-primary/30' : 'text-app-muted-foreground border-app-border hover:bg-app-background'}`}>
                        <Filter size={12} />
                        Filters
                        <ChevronDown size={10} className={`transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* Filters row */}
                {filtersOpen && filters && (
                    <div className="px-5 py-2.5 flex items-center gap-3 border-b flex-wrap" style={{ borderColor: 'var(--app-border)', background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-background))' }}>
                        <select className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-app-border bg-app-surface text-app-foreground outline-none"
                                value={category} onChange={(e) => setCategory(e.target.value)}>
                            <option value="">All Categories</option>
                            {filters.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-app-border bg-app-surface text-app-foreground outline-none"
                                value={brand} onChange={(e) => setBrand(e.target.value)}>
                            <option value="">All Brands</option>
                            {filters.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        {(category || brand || (supplierId && !showSupplierOnly)) && (
                            <button type="button" onClick={() => { setCategory(''); setBrand(''); setShowSupplierOnly(true) }}
                                    className="text-[10px] font-bold text-app-error hover:underline">
                                Clear filters
                            </button>
                        )}
                    </div>
                )}

                {/* Product list */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Column header */}
                    <div className="flex items-center gap-0 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-app-muted-foreground border-b sticky top-0 z-10"
                         style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                        <div className="w-[40%] px-2">Product</div>
                        <div className="w-[12%] px-2 text-center">Stock</div>
                        <div className="w-[12%] px-2 text-center hidden sm:block">Daily Sales</div>
                        <div className="w-[12%] px-2 text-center">Cost</div>
                        <div className="w-[12%] px-2 text-center hidden sm:block">Margin</div>
                        <div className="w-[12%] px-2 text-center">Add</div>
                    </div>

                    {loading && items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-app-muted-foreground">
                            <Loader2 size={24} className="animate-spin mb-2" />
                            <p className="text-[11px] font-bold">Loading catalogue...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-app-muted-foreground">
                            <Package size={32} className="mb-2 opacity-40" />
                            <p className="text-[12px] font-bold">No products found</p>
                            <p className="text-[10px] mt-1">Try adjusting your search or filters</p>
                        </div>
                    ) : (
                        <>
                            {items.map(item => {
                                const isAdded = addedSet.has(item.id)
                                return (
                                    <div key={item.id}
                                         className={`flex items-center gap-0 px-3 py-2.5 transition-all border-b ${isAdded ? 'opacity-50' : 'hover:bg-app-primary/5 cursor-pointer'}`}
                                         style={{ borderColor: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}
                                         onClick={() => !isAdded && onAddProduct({
                                             id: item.id,
                                             name: item.name,
                                             sku: item.sku,
                                             barcode: item.barcode,
                                             costPriceHT: item.cost_price_ht,
                                             sellingPriceTTC: item.selling_price,
                                             stockLevel: item.stock,
                                         })}>
                                        {/* Product */}
                                        <div className="w-[40%] px-2 flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                                 style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                                <Package size={13} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-[12px] font-bold text-app-foreground truncate">{item.name}</div>
                                                <div className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider">{item.sku}{item.category_name ? ` · ${item.category_name}` : ''}</div>
                                            </div>
                                        </div>
                                        {/* Stock */}
                                        <div className="w-[12%] px-2 text-center">
                                            <span className={`text-[11px] font-black tabular-nums ${item.stock <= 0 ? 'text-app-error' : 'text-app-foreground'}`}>
                                                {item.stock.toLocaleString()}
                                            </span>
                                        </div>
                                        {/* Daily Sales */}
                                        <div className="w-[12%] px-2 text-center hidden sm:block">
                                            <span className="text-[11px] font-bold tabular-nums text-app-muted-foreground">{item.daily_sales.toFixed(1)}</span>
                                        </div>
                                        {/* Cost */}
                                        <div className="w-[12%] px-2 text-center">
                                            <span className="text-[11px] font-black tabular-nums text-app-foreground">{item.cost_price.toLocaleString()}</span>
                                        </div>
                                        {/* Margin */}
                                        <div className="w-[12%] px-2 text-center hidden sm:block">
                                            <span className={`text-[10px] font-black tabular-nums ${item.margin_pct >= 20 ? 'text-app-success' : item.margin_pct >= 0 ? 'text-app-warning' : 'text-app-error'}`}>
                                                {item.margin_pct.toFixed(1)}%
                                            </span>
                                        </div>
                                        {/* Add button */}
                                        <div className="w-[12%] px-2 flex justify-center">
                                            {isAdded ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black text-app-success"
                                                      style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)' }}>
                                                    <Check size={10} /> Added
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black text-app-primary hover:bg-app-primary/10 transition-all"
                                                      style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }}>
                                                    <Plus size={10} /> Add
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Load more */}
                            {hasMore && (
                                <div className="flex justify-center py-4">
                                    <button type="button"
                                            onClick={() => fetchItems(page + 1, true)}
                                            disabled={loading}
                                            className="text-[11px] font-bold text-app-primary hover:underline flex items-center gap-1.5 disabled:opacity-50">
                                        {loading ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                                        Load more products
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t flex items-center justify-between"
                     style={{ borderColor: 'var(--app-border)', background: 'var(--app-background)' }}>
                    <span className="text-[10px] font-bold text-app-muted-foreground">
                        {items.length} products shown · {existingProductIds.length} in order
                    </span>
                    <button type="button" onClick={onClose}
                            className="px-4 py-1.5 text-[11px] font-bold rounded-xl bg-app-primary text-white hover:brightness-110 transition-all">
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}
