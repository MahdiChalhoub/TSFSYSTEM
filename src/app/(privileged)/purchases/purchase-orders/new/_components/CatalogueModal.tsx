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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { X, Search, Package, ChevronDown, Loader2, Check, Filter, Plus, ShoppingCart, RotateCcw } from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'

// Reuse the rich filter UI + filter shape from the inventory products page so
// the catalogue picker has the same filtering vocabulary (type, completeness,
// verified, ranges, etc.). Future cleanup: lift these to `src/lib/products/`
// or `src/components/products/` so the cross-page coupling isn't via _lib/.
import { FiltersPanel } from '../../../../inventory/products/_components/FiltersPanel'
import type { Filters, Lookups } from '../../../../inventory/products/_lib/types'
import {
    EMPTY_FILTERS,
    EMPTY_LOOKUPS,
    DEFAULT_VISIBLE_FILTERS,
    COMPLETENESS_LEVELS,
} from '../../../../inventory/products/_lib/constants'

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
    pipeline_status: string | null
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
        pipeline_status: (p.pipeline_status as string) ?? null,
    }
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

/** Map a Completeness label (e.g. "Identified") to its integer level (0..7).
 *  Backend's `data_completeness_level` filterset expects an int; the UI shows
 *  the label. The COMPLETENESS_LEVELS constant defines the canonical order. */
const completenessLevelByValue = new Map(COMPLETENESS_LEVELS.map((c, i) => [c.value, i]))

export function CatalogueModal({ open, onClose, onAddProduct, existingProductIds, supplierId }: Props) {
    const [items, setItems] = useState<CatalogueItem[]>([])
    const [lookups, setLookups] = useState<Lookups>(EMPTY_LOOKUPS)
    const [loading, setLoading] = useState(false)
    const [query, setQuery] = useState('')
    const [filterValues, setFilterValues] = useState<Filters>(EMPTY_FILTERS)
    // Which filters appear in the FiltersPanel grid. Same defaults as the
    // /inventory/products page; a future Customize button can let the user
    // toggle individual filters in/out and persist that choice as a profile.
    const [visibleFilters] = useState<Record<string, boolean>>(DEFAULT_VISIBLE_FILTERS)
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [showSupplierOnly, setShowSupplierOnly] = useState(!!supplierId)
    const searchRef = useRef<HTMLInputElement>(null)

    // Resolve filter NAME → backend FK ID. The FiltersPanel sends
    // `filterValues.category = "Soft Drinks"` (the human label), but DRF's
    // FK filterset expects the row id. We do the lookup here so the panel
    // stays UI-only.
    const idByName = useMemo(() => ({
        category: new Map(lookups.categories.map(c => [c.name, c.id])),
        brand:    new Map(lookups.brands.map(b => [b.name, b.id])),
        unit:     new Map(lookups.units.map(u => [u.name, u.id])),
    }), [lookups])

    // Has-any-active for the chip Reset button
    const hasActiveFilters = useMemo(() => {
        const f = filterValues
        return Boolean(f.type || f.category || f.brand || f.unit || f.country || f.parfum
            || f.status || f.completeness || f.verified || f.isActive || f.catalogReady
            || f.expiryTracked || f.tracksLots || f.tracksSerials
            || f.lotMgmt || f.valuation || f.productGroup || f.pricingSource || f.syncStatus)
    }, [filterValues])

    // Sync showSupplierOnly with prop if it changes
    useEffect(() => {
        if (supplierId) setShowSupplierOnly(true)
    }, [supplierId])

    // Fetch filter dimensions once — same masters /inventory/products uses.
    // Adds countries + parfums so the rich FiltersPanel can offer them.
    useEffect(() => {
        if (!open) return
        let cancelled = false
        Promise.all([
            erpFetch('categories/').catch(() => []),
            erpFetch('brands/').catch(() => []),
            erpFetch('units/').catch(() => []),
            erpFetch('reference/sourcing-countries/').catch(() => []),
            erpFetch('parfums/').catch(() => []),
        ]).then(([catsRaw, brandsRaw, unitsRaw, countriesRaw, parfumsRaw]) => {
            if (cancelled) return
            const toList = (raw: unknown): Array<Record<string, unknown>> => {
                if (Array.isArray(raw)) return raw
                const r = raw as { results?: unknown } | null
                return Array.isArray(r?.results) ? (r!.results as Array<Record<string, unknown>>) : []
            }
            setLookups({
                categories: toList(catsRaw).map(c => ({ id: Number(c.id), name: String(c.name || '') })),
                brands: toList(brandsRaw).map(b => ({ id: Number(b.id), name: String(b.name || '') })),
                units: toList(unitsRaw).map(u => ({ id: Number(u.id), name: String(u.name || ''), short_name: String(u.short_name || '') })),
                countries: toList(countriesRaw).map(c => ({ id: Number(c.id), name: String(c.name || c.country_name || '') })),
                parfums: toList(parfumsRaw).map(p => ({ id: Number(p.id), name: String(p.name || '') })),
            })
        })
        return () => { cancelled = true }
    }, [open])

    // Fetch catalogue items from `products/` — same DRF endpoint as
    // /inventory/products. Server-side pagination + SearchFilter for
    // SKU/barcode/name; FK filters (`?category=<id>`) pulled from idByName.
    //
    // Filters that the backend's `filterset_fields` doesn't yet support
    // (country, parfum, ranges, catalogReady, expiryTracked, lotMgmt,
    // valuation, productGroup, pricingSource, syncStatus) are intentionally
    // not wired here — they appear in the panel but no-op for now. Adding
    // backend support is a separate task; the panel is structured so the
    // wiring is mechanical when those filters land.
    const fetchItems = useCallback(async (pageNum: number, append = false) => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(pageNum),
                page_size: '30',
                lite: '1', // skip N+1-causing nested fields; see ProductLiteSerializer
            })
            if (query) params.set('search', query)
            if (showSupplierOnly && supplierId) params.set('supplier', String(supplierId))

            const f = filterValues
            // FK filters: convert NAME → id via lookup map. Skip silently
            // when name has no match (lookups not loaded yet).
            const setFkParam = (paramName: string, val: string, idMap: Map<string, number>) => {
                if (!val) return
                if (val === '__NONE__') { params.set(`${paramName}__isnull`, 'true'); return }
                const cleanVal = val.startsWith('!') ? val.slice(1) : val
                const id = idMap.get(cleanVal)
                if (id == null) return
                params.set(paramName, val.startsWith('!') ? `!${id}` : String(id))
            }
            setFkParam('category', f.category, idByName.category)
            setFkParam('brand',    f.brand,    idByName.brand)
            setFkParam('unit',     f.unit,     idByName.unit)

            // Enum / scalar filters — pass values directly.
            if (f.type)   params.set('product_type', f.type)
            if (f.status) params.set('status', f.status)

            // Boolean tri-state ('yes' | 'no' | ''): pass true/false to backend.
            const setBoolParam = (paramName: string, val: string) => {
                if (val === 'yes') params.set(paramName, 'true')
                else if (val === 'no') params.set(paramName, 'false')
            }
            setBoolParam('is_verified',     f.verified)
            setBoolParam('is_active',       f.isActive)
            setBoolParam('tracks_serials',  f.tracksSerials)

            // Completeness label → integer level.
            if (f.completeness) {
                const lvl = completenessLevelByValue.get(f.completeness)
                if (lvl != null) params.set('data_completeness_level', String(lvl))
            }

            const data = await erpFetch(`products/?${params}`) as
                | Array<Record<string, unknown>>
                | { results?: Array<Record<string, unknown>>; count?: number; next?: string | null }
                | null
            const rawList: Array<Record<string, unknown>> = Array.isArray(data)
                ? data
                : (data?.results || [])
            const newItems = rawList.map(mapProductToCatalogueItem)
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
    }, [query, filterValues, idByName, supplierId, showSupplierOnly])

    // Refetch on filter/query change. fetchItems is memoized on filterValues,
    // so a single dep on it covers all 27 filter fields.
    useEffect(() => {
        if (!open) return
        const timer = setTimeout(() => fetchItems(1), 300)
        return () => clearTimeout(timer)
    }, [open, query, filterValues, showSupplierOnly, fetchItems])

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

                {/* Filters grid — same FiltersPanel as /inventory/products so the
                    picker has identical filter vocabulary. Backend wires the
                    supported subset (FK, enum, boolean, completeness); the rest
                    are visual-only until backend filterset_fields catches up. */}
                {filtersOpen && (
                    <div className="px-5 py-4 border-b border-app-border space-y-2"
                         style={{ background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-background))' }}>
                        <FiltersPanel
                            items={items}
                            filters={filterValues}
                            setFilters={setFilterValues}
                            isOpen
                            lookups={lookups}
                            visibleFilters={visibleFilters}
                        />
                        {hasActiveFilters && (
                            <div className="flex justify-end">
                                <button type="button"
                                        onClick={() => setFilterValues(EMPTY_FILTERS)}
                                        className="flex items-center gap-1 text-[10px] font-black uppercase text-app-error hover:opacity-80 transition-all">
                                    <RotateCcw size={10} />
                                    Clear All Filters
                                </button>
                            </div>
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
                                             // Forward the canonical pipeline state so the line
                                             // status column shows "Requested · Purchase" (etc.)
                                             // instead of always "Available".
                                             pipeline_status: (item as any).pipeline_status,
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
