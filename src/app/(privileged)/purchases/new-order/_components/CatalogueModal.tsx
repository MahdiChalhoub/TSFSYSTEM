// @ts-nocheck
'use client'

/**
 * CatalogueModal — Product catalogue browser with filters
 * ==========================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { getCatalogueProducts, getCatalogueFilters } from '@/app/actions/inventory/product-actions'
import { Search, BookOpen, Settings2, Plus, Package, Loader2 } from 'lucide-react'

function SafetyBadge({ tag }: { tag: string }) {
    const c: Record<string, { bg: string; text: string; label: string }> = {
        SAFE: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600', label: '✓ SAFE' },
        CAUTION: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600', label: '⚠ CAUTION' },
        RISKY: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600', label: '✕ RISKY' },
    }
    const cfg = c[tag] || c.SAFE
    return <span className={`${cfg.bg} ${cfg.text} text-[7px] font-black px-1.5 py-0.5 rounded-full`}>{cfg.label}</span>
}

export function CatalogueModal({ onSelect, onClose, siteId, supplierId }: {
    onSelect: (p: any) => void, onClose: () => void, siteId: number, supplierId?: number
}) {
    const [query, setQuery] = useState('')
    const [category, setCategory] = useState('')
    const [brand, setBrand] = useState('')
    const [stockFilter, setStockFilter] = useState('')
    const [marginFilter, setMarginFilter] = useState('')
    const [rotationFilter, setRotationFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [products, setProducts] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [brands, setBrands] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [page, setPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [showFilters, setShowFilters] = useState(true)
    const scrollRef = useRef<HTMLDivElement>(null)

    const fCls = "w-full text-[10px] font-semibold bg-app-surface rounded-lg px-2.5 py-2 border border-app-border/50 text-app-foreground outline-none focus:ring-1 focus:ring-app-primary/30"
    const fLbl = "text-[8px] font-black uppercase tracking-widest text-app-muted-foreground mb-1"

    useEffect(() => {
        (async () => {
            try {
                const data = await getCatalogueFilters()
                setCategories(data?.categories || [])
                setBrands(data?.brands || [])
            } catch { /* ignore */ }
        })()
    }, [])

    const loadProducts = useCallback(async (pageNum: number, append = false) => {
        setLoading(true)
        try {
            const params: Record<string, string> = { page: String(pageNum), page_size: '30' }
            if (query) params.query = query
            if (category) params.category = category
            if (brand) params.brand = brand
            if (siteId) params.site_id = siteId.toString()
            if (supplierId) params.supplier = supplierId.toString()
            if (stockFilter === 'in_stock') params.min_stock = '1'
            if (stockFilter === 'out_of_stock') { params.min_stock = '0'; params.max_stock = '0' }
            if (stockFilter === 'low_stock') { params.min_stock = '1'; params.max_stock = '10' }
            if (stockFilter === 'high_stock') params.min_stock = '50'
            if (marginFilter) params.min_margin = marginFilter
            if (statusFilter) params.status = statusFilter
            const data = await getCatalogueProducts(params)
            const results = data?.results || []
            setProducts(prev => append ? [...prev, ...results] : results)
            setTotalCount(data?.count || 0)
            setPage(pageNum)
        } catch { /* ignore */ }
        setLoading(false)
    }, [query, category, brand, siteId, supplierId, stockFilter, marginFilter, statusFilter])

    useEffect(() => {
        const t = setTimeout(() => loadProducts(1), 300)
        return () => clearTimeout(t)
    }, [loadProducts])

    const handleScroll = useCallback(() => {
        const el = scrollRef.current
        if (!el || loading) return
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100 && products.length < totalCount) {
            loadProducts(page + 1, true)
        }
    }, [loading, products.length, totalCount, page, loadProducts])

    const activeFilterCount = [category, brand, stockFilter, marginFilter, rotationFilter, statusFilter].filter(Boolean).length
    const clearAll = () => { setCategory(''); setBrand(''); setStockFilter(''); setMarginFilter(''); setRotationFilter(''); setStatusFilter('') }

    const displayed = rotationFilter ? products.filter(p => {
        const ds = p.daily_sales || 0
        if (rotationFilter === 'fast') return ds >= 5
        if (rotationFilter === 'medium') return ds >= 1 && ds < 5
        if (rotationFilter === 'slow') return ds > 0 && ds < 1
        if (rotationFilter === 'dead') return ds === 0
        return true
    }) : products

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-2 pt-4 md:p-4 md:pt-6 animate-in fade-in duration-200">
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center"><BookOpen size={14} className="text-indigo-500" /></div>
                        <div>
                            <h3 className="font-black text-xs text-app-foreground">Product Catalogue</h3>
                            <p className="text-[8px] text-app-muted-foreground">{totalCount} products{supplierId && supplierId > 0 ? ' • Supplier filtered' : ''}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setShowFilters(!showFilters)}
                            className="text-[9px] font-bold px-2.5 py-1.5 rounded-lg bg-app-background/60 border border-app-border/40 text-app-muted-foreground hover:text-app-foreground transition-colors flex items-center gap-1">
                            <Settings2 size={10} /> Filters {activeFilterCount > 0 && <span className="w-4 h-4 rounded-full bg-indigo-500 text-white text-[8px] flex items-center justify-center">{activeFilterCount}</span>}
                        </button>
                        <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-app-background flex items-center justify-center text-app-muted-foreground hover:text-app-foreground">×</button>
                    </div>
                </div>

                {/* Search */}
                <div className="px-4 py-2.5 border-b border-app-border/40 bg-app-background/20">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground/40" />
                        <input type="text" className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold bg-app-surface rounded-lg border border-app-border/50 outline-none text-app-foreground focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="Search by name, SKU, or barcode..." value={query} onChange={e => setQuery(e.target.value)} autoFocus />
                    </div>
                </div>

                {/* Body: sidebar + products */}
                <div className="flex flex-1 overflow-hidden min-h-0">
                    {showFilters && (
                        <div className="w-48 shrink-0 border-r border-app-border/40 bg-app-background/20 overflow-y-auto p-3 space-y-3">
                            {activeFilterCount > 0 && (
                                <button type="button" onClick={clearAll} className="w-full text-[8px] font-bold text-rose-500 hover:text-rose-600 text-center py-1 rounded-lg hover:bg-rose-500/10 transition-colors">✕ Clear all</button>
                            )}
                            <div><div className={fLbl}>Category</div>
                                <select className={fCls} value={category} onChange={e => setCategory(e.target.value)}>
                                    <option value="">All</option>
                                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select></div>
                            <div><div className={fLbl}>Brand</div>
                                <select className={fCls} value={brand} onChange={e => setBrand(e.target.value)}>
                                    <option value="">All</option>
                                    {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select></div>
                            <div><div className={fLbl}>Available Qty</div>
                                <select className={fCls} value={stockFilter} onChange={e => setStockFilter(e.target.value)}>
                                    <option value="">All levels</option>
                                    <option value="in_stock">✅ In Stock (≥1)</option>
                                    <option value="high_stock">📦 High (≥50)</option>
                                    <option value="low_stock">⚠️ Low (1-10)</option>
                                    <option value="out_of_stock">🔴 Out of Stock</option>
                                </select></div>
                            <div><div className={fLbl}>Min Margin %</div>
                                <select className={fCls} value={marginFilter} onChange={e => setMarginFilter(e.target.value)}>
                                    <option value="">Any</option>
                                    <option value="5">≥ 5%</option><option value="10">≥ 10%</option>
                                    <option value="20">≥ 20%</option><option value="30">≥ 30%</option><option value="50">≥ 50%</option>
                                </select></div>
                            <div><div className={fLbl}>Rotation</div>
                                <select className={fCls} value={rotationFilter} onChange={e => setRotationFilter(e.target.value)}>
                                    <option value="">All</option>
                                    <option value="fast">🚀 Fast (≥5/day)</option><option value="medium">⚡ Medium (1-5)</option>
                                    <option value="slow">🐢 Slow (&lt;1)</option><option value="dead">💀 Dead (0)</option>
                                </select></div>
                            <div><div className={fLbl}>Status</div>
                                <select className={fCls} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                    <option value="">Active</option><option value="DISCONTINUED">Discontinued</option>
                                </select></div>
                            <div className="pt-2 border-t border-app-border/30">
                                <p className="text-[8px] font-bold text-app-muted-foreground text-center">{displayed.length} of {totalCount}</p>
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-3">
                        {displayed.length === 0 && !loading ? (
                            <div className="py-16 text-center">
                                <Package size={32} className="mx-auto mb-2 text-app-muted-foreground/20" />
                                <p className="text-xs font-bold text-app-muted-foreground">No products found</p>
                                <p className="text-[9px] text-app-muted-foreground mt-1">Try adjusting your filters</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {displayed.map((p: any) => {
                                    const stock = p.stock_on_location ?? p.stock ?? p.available_qty ?? p.on_hand_qty ?? 0
                                    const dailySales = p.avg_daily_sales ?? p.daily_sales ?? 0
                                    const costPrice = p.cost_price ?? p.cost_price_ht ?? 0
                                    const sellingPrice = p.selling_price_ttc ?? p.selling_price ?? p.selling_price_ht ?? 0
                                    const marginPct = p.margin_pct ?? (Number(costPrice) > 0 ? Math.round(((Number(sellingPrice) - Number(costPrice)) / Number(costPrice)) * 100) : 0)
                                    const daysOfStock = dailySales > 0 ? Math.round(stock / dailySales) : stock > 0 ? 999 : 0
                                    const proposedQty = p.proposed_qty ?? Math.max(0, Math.round((dailySales || 0) * 14 - (stock || 0)))
                                    return (
                                        <button key={p.id} type="button" onClick={() => onSelect(p)}
                                            className="p-3 bg-app-background/40 rounded-xl border border-app-border/40 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all text-left group">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-bold text-xs text-app-foreground truncate">{p.name}</div>
                                                    <div className="text-[8px] text-app-muted-foreground mt-0.5">{p.sku || '—'} {p.barcode ? `• ${p.barcode}` : ''} {p.category_name ? `• ${p.category_name}` : ''}</div>
                                                </div>
                                                <Plus size={14} className="text-indigo-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <div className="grid grid-cols-4 gap-1 mt-2">
                                                <div className="text-center"><div className={`text-[9px] font-black ${stock > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{stock}</div><div className="text-[7px] text-app-muted-foreground">Avail</div></div>
                                                <div className="text-center"><div className={`text-[9px] font-black ${proposedQty > 0 ? 'text-indigo-500' : 'text-app-muted-foreground'}`}>{proposedQty}</div><div className="text-[7px] text-app-muted-foreground">Proposed</div></div>
                                                <div className="text-center"><div className={`text-[9px] font-black ${marginPct >= 20 ? 'text-emerald-500' : marginPct >= 10 ? 'text-amber-500' : 'text-app-muted-foreground'}`}>{marginPct > 0 ? `${marginPct}%` : '—'}</div><div className="text-[7px] text-app-muted-foreground">Margin</div></div>
                                                <div className="text-center"><div className="text-[9px] font-black text-app-foreground">{daysOfStock > 365 ? '∞' : `${daysOfStock}d`}</div><div className="text-[7px] text-app-muted-foreground">Rotation</div></div>
                                            </div>
                                            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-app-border/20">
                                                <span className="text-[8px] text-app-muted-foreground">Cost: {costPrice} → Sell: {sellingPrice}</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[8px] text-app-muted-foreground">{dailySales}/day</span>
                                                    {p.is_expiry_tracked && <SafetyBadge tag={p.safety_tag} />}
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                        {loading && <div className="py-4 text-center"><Loader2 size={16} className="mx-auto animate-spin text-app-muted-foreground" /></div>}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-app-border flex items-center justify-between">
                    <span className="text-[9px] font-bold text-app-muted-foreground">{displayed.length} of {totalCount} products</span>
                    <button type="button" onClick={onClose} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-app-background/60 border border-app-border/40 text-app-muted-foreground hover:text-app-foreground transition-colors">Close</button>
                </div>
            </div>
        </div>
    )
}
