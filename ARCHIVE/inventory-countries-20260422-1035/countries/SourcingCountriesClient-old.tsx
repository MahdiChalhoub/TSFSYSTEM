// @ts-nocheck
'use client'

import { useState, useMemo, useTransition, useCallback, useEffect } from 'react'
import {
    Globe, Search, Plus, X, Check, MapPin, Trash2,
    BarChart3, TrendingUp, Package, ChevronRight, ChevronDown,
    Tag, Layers, Eye, Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import {
    enableSourcingCountry,
    disableSourcingCountry,
    bulkEnableSourcingCountries,
} from '@/app/actions/reference'

/* ─── TYPES ──────────────────────────────────────────────────────────── */

interface RefCountry {
    id: number; iso2: string; iso3?: string; name: string;
    phone_code?: string; region?: string; subregion?: string;
    default_currency?: number; default_currency_code?: string;
}

interface SourcingCountry {
    id: number; country: number; country_iso2: string; country_iso3?: string;
    country_name: string; country_region?: string; default_currency_code?: string;
    is_enabled: boolean; notes: string;
}

interface BrandSummary {
    id: number; name: string; product_count: number;
}

interface ProductSummary {
    id: number; name: string; sku: string;
    brand_name?: string; cost_price?: number; selling_price_ttc?: number;
}

/* ─── HELPERS ────────────────────────────────────────────────────────── */

function getFlagEmoji(iso2: string) {
    return iso2.toUpperCase().split('').map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('')
}

const REGION_COLORS: Record<string, string> = {
    'Africa': '--app-warning', 'Americas': '--app-success',
    'Asia': '--app-error', 'Europe': '--app-primary',
    'Oceania': '--app-info', 'Other': '--app-muted-foreground',
}
function rc(region?: string) { return REGION_COLORS[region || 'Other'] || '--app-muted-foreground' }

/* ─── STAT CARD ──────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, cssVar }: { icon: any; label: string; value: string | number; cssVar: string }) {
    return (
        <div className="relative overflow-hidden rounded-xl p-3.5 transition-all hover:scale-[1.02]"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0"
                    style={{ background: `linear-gradient(135deg, var(${cssVar}), color-mix(in srgb, var(${cssVar}) 70%, black))` }}>
                    <Icon size={15} className="text-white" />
                </div>
                <div>
                    <p className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">{label}</p>
                    <p className="text-xl font-black text-app-foreground tracking-tight">{value}</p>
                </div>
            </div>
            <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-[0.06]" style={{ background: `var(${cssVar})` }} />
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════════
 *  EXPANDED COUNTRY DETAIL — Brands + Products drill-down
 * ═══════════════════════════════════════════════════════════════════════ */

function CountryDetail({ country }: { country: SourcingCountry }) {
    const [brands, setBrands] = useState<BrandSummary[]>([])
    const [products, setProducts] = useState<ProductSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedBrand, setSelectedBrand] = useState<number | null>(null)
    const [productSearch, setProductSearch] = useState('')

    useEffect(() => {
        loadCountryData()
    }, [country.country])

    async function loadCountryData() {
        setLoading(true)
        try {
            // Fetch products from this country of origin
            const prodRes = await erpFetch(`/inventory/products/?country_of_origin=${country.country}&page_size=500`)
            const prods: ProductSummary[] = Array.isArray(prodRes) ? prodRes : prodRes?.results || []
            setProducts(prods)

            // Compute brands from the products
            const brandMap = new Map<number, { id: number; name: string; count: number }>()
            for (const p of prods) {
                if (p.brand) {
                    const existing = brandMap.get(p.brand)
                    if (existing) {
                        existing.count++
                    } else {
                        brandMap.set(p.brand, { id: p.brand, name: p.brand_name || `Brand #${p.brand}`, count: 1 })
                    }
                }
            }
            setBrands(Array.from(brandMap.values()).map(b => ({ id: b.id, name: b.name, product_count: b.count })).sort((a, b) => b.product_count - a.product_count))
        } catch { setProducts([]); setBrands([]) }
        setLoading(false)
    }

    // Filter products
    const filteredProducts = useMemo(() => {
        let list = products
        if (selectedBrand !== null) {
            list = list.filter(p => p.brand === selectedBrand)
        }
        if (productSearch) {
            const q = productSearch.toLowerCase()
            list = list.filter(p => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
        }
        return list
    }, [products, selectedBrand, productSearch])

    if (loading) return (
        <div className="py-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    return (
        <div className="px-4 pb-4 space-y-3">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 15%, transparent)' }}>
                    <Tag size={12} style={{ color: 'var(--app-info)' }} />
                    <div>
                        <p className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Brands</p>
                        <p className="text-sm font-black text-app-foreground">{brands.length}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: 'color-mix(in srgb, var(--app-success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-success) 15%, transparent)' }}>
                    <Package size={12} style={{ color: 'var(--app-success)' }} />
                    <div>
                        <p className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Products</p>
                        <p className="text-sm font-black text-app-foreground">{products.length}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 15%, transparent)' }}>
                    <Eye size={12} style={{ color: 'var(--app-warning)' }} />
                    <div>
                        <p className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Showing</p>
                        <p className="text-sm font-black text-app-foreground">{filteredProducts.length}</p>
                    </div>
                </div>
            </div>

            {/* Brands Row — clickable filters */}
            {brands.length > 0 && (
                <div>
                    <p className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <Tag size={9} /> Linked Brands
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => setSelectedBrand(null)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                            style={{
                                background: selectedBrand === null ? 'var(--app-primary)' : 'var(--app-background)',
                                color: selectedBrand === null ? 'white' : 'var(--app-muted-foreground)',
                                border: `1px solid ${selectedBrand === null ? 'var(--app-primary)' : 'var(--app-border)'}`,
                            }}>
                            All ({products.length})
                        </button>
                        {brands.map(b => (
                            <button key={b.id} onClick={() => setSelectedBrand(selectedBrand === b.id ? null : b.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-[1.02]"
                                style={{
                                    background: selectedBrand === b.id ? 'var(--app-info)' : 'var(--app-background)',
                                    color: selectedBrand === b.id ? 'white' : 'var(--app-foreground)',
                                    border: `1px solid ${selectedBrand === b.id ? 'var(--app-info)' : 'var(--app-border)'}`,
                                }}>
                                <Tag size={8} />
                                {b.name}
                                <span className="px-1 py-0 rounded text-[8px] font-black"
                                    style={{
                                        background: selectedBrand === b.id ? 'rgba(255,255,255,0.2)' : 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                        color: selectedBrand === b.id ? 'white' : 'var(--app-primary)',
                                    }}>
                                    {b.product_count}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Product Search */}
            {products.length > 0 && (
                <div className="relative max-w-sm">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input type="text" placeholder="Search products..." value={productSearch} onChange={e => setProductSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[11px] outline-none"
                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                </div>
            )}

            {/* Products Table */}
            {filteredProducts.length > 0 ? (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                    <table className="w-full text-xs">
                        <thead>
                            <tr style={{ background: 'var(--app-background)', borderBottom: '1px solid var(--app-border)' }}>
                                <th className="text-left px-3 py-2 text-[9px] font-black uppercase tracking-wider text-app-muted-foreground">Product</th>
                                <th className="text-left px-3 py-2 text-[9px] font-black uppercase tracking-wider text-app-muted-foreground">Brand</th>
                                <th className="text-right px-3 py-2 text-[9px] font-black uppercase tracking-wider text-app-muted-foreground">Cost</th>
                                <th className="text-right px-3 py-2 text-[9px] font-black uppercase tracking-wider text-app-muted-foreground">Sell (TTC)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.slice(0, 50).map((p, i) => (
                                <tr key={p.id || i} className="hover:bg-app-surface-hover transition-colors"
                                    style={{ borderBottom: '1px solid var(--app-border)' }}>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <Package size={11} className="text-app-muted-foreground shrink-0" />
                                            <div>
                                                <p className="text-[11px] font-bold text-app-foreground leading-tight">{p.name}</p>
                                                <p className="text-[9px] font-mono text-app-muted-foreground">{p.sku}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        {p.brand_name ? (
                                            <span className="px-2 py-0.5 rounded text-[9px] font-bold"
                                                style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>
                                                {p.brand_name}
                                            </span>
                                        ) : <span className="text-[9px] text-app-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-[10px] text-app-muted-foreground">
                                        {p.cost_price ? parseFloat(String(p.cost_price)).toFixed(2) : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-[10px] font-bold text-app-foreground">
                                        {p.selling_price_ttc ? parseFloat(String(p.selling_price_ttc)).toFixed(2) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredProducts.length > 50 && (
                        <div className="px-3 py-2 text-center text-[10px] font-bold text-app-muted-foreground"
                            style={{ background: 'var(--app-background)', borderTop: '1px solid var(--app-border)' }}>
                            Showing 50 of {filteredProducts.length} products
                        </div>
                    )}
                </div>
            ) : products.length > 0 ? (
                <div className="py-4 text-center text-[11px] text-app-muted-foreground">
                    No products match the current filter
                </div>
            ) : (
                <div className="py-6 text-center">
                    <Package size={24} className="mx-auto mb-2 text-app-muted-foreground opacity-30" />
                    <p className="text-[11px] font-bold text-app-muted-foreground">No products sourced from this country yet</p>
                    <p className="text-[9px] text-app-muted-foreground mt-1">Set a product's "Country of Origin" to link it here</p>
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════════
 *  COUNTRY PICKER MODAL
 * ═══════════════════════════════════════════════════════════════════════ */

function CountryPickerModal({
    allCountries, sourcedIds, onClose, onAdded,
}: {
    allCountries: RefCountry[]; sourcedIds: Set<number>;
    onClose: () => void; onAdded: (added: SourcingCountry[]) => void;
}) {
    const [search, setSearch] = useState('')
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [isPending, startTransition] = useTransition()

    const available = useMemo(() => {
        let list = allCountries.filter(c => !sourcedIds.has(c.id))
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(c => c.name.toLowerCase().includes(q) || c.iso2.toLowerCase().includes(q) || (c.region || '').toLowerCase().includes(q))
        }
        return list
    }, [allCountries, sourcedIds, search])

    const byRegion = useMemo(() => {
        const map: Record<string, RefCountry[]> = {}
        for (const c of available) { const r = c.region || 'Other'; if (!map[r]) map[r] = []; map[r].push(c) }
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
    }, [available])

    const toggle = (id: number) => setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

    const handleAdd = () => {
        if (selectedIds.size === 0) return
        startTransition(async () => {
            const res = await bulkEnableSourcingCountries(Array.from(selectedIds))
            if (res.success) {
                toast.success(`${selectedIds.size} sourcing countries added`)
                const added: SourcingCountry[] = Array.from(selectedIds).map(cid => {
                    const c = allCountries.find(x => x.id === cid)!
                    return { id: Date.now() + cid, country: cid, country_iso2: c.iso2, country_iso3: c.iso3, country_name: c.name, country_region: c.region, default_currency_code: c.default_currency_code, is_enabled: true, notes: '' }
                })
                onAdded(added); onClose()
            } else { toast.error(res.error || 'Failed') }
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-2xl mx-4 rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', maxHeight: '80vh' }}
                onClick={e => e.stopPropagation()}>

                <div className="px-5 py-3.5 flex items-center justify-between"
                    style={{ background: 'var(--app-background)', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                            style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, black))' }}>
                            <Plus size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-[14px] font-black text-app-foreground">Add Sourcing Countries</h3>
                            <p className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select countries to add'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input type="text" placeholder="Search by name, code, or region..." value={search} onChange={e => setSearch(e.target.value)} autoFocus
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-app-primary/20 transition-all"
                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar" style={{ minHeight: 200 }}>
                    {available.length === 0 ? (
                        <div className="py-12 text-center">
                            <Globe size={36} className="mx-auto mb-3 text-app-muted-foreground opacity-30" />
                            <p className="text-xs font-bold text-app-muted-foreground">{search ? 'No matching countries' : 'All countries already added!'}</p>
                        </div>
                    ) : byRegion.map(([region, countries]) => (
                        <div key={region} className="mb-4">
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: `var(${rc(region)})` }} />
                                <p className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">
                                    {region} <span style={{ color: `var(${rc(region)})` }}>({countries.length})</span>
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {countries.map(c => {
                                    const sel = selectedIds.has(c.id)
                                    return (
                                        <button key={c.id} onClick={() => toggle(c.id)}
                                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all"
                                            style={{
                                                background: sel ? `color-mix(in srgb, var(${rc(region)}) 10%, transparent)` : 'transparent',
                                                border: sel ? `1px solid color-mix(in srgb, var(${rc(region)}) 30%, transparent)` : '1px solid transparent',
                                            }}>
                                            <span className="text-lg">{getFlagEmoji(c.iso2)}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-bold text-app-foreground truncate">{c.name}</p>
                                                <p className="text-[9px] text-app-muted-foreground">{c.iso2} {c.default_currency_code ? `• ${c.default_currency_code}` : ''}</p>
                                            </div>
                                            {sel && <div className="w-5 h-5 rounded-full flex items-center justify-center shadow-sm shrink-0" style={{ background: `var(${rc(region)})` }}><Check size={10} className="text-white" strokeWidth={3} /></div>}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-background)' }}>
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[12px] font-bold text-app-muted-foreground border border-app-border hover:bg-app-surface transition-all">Cancel</button>
                    <button onClick={handleAdd} disabled={selectedIds.size === 0 || isPending}
                        className="px-6 py-2.5 rounded-xl text-[12px] font-bold text-white shadow-lg disabled:opacity-40 flex items-center gap-2 hover:shadow-xl transition-all"
                        style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, black))' }}>
                        {isPending && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {isPending ? 'Adding...' : `Add ${selectedIds.size || ''} Countries`}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════════════════ */

export function SourcingCountriesClient({
    allCountries, sourcingCountries: initialSourcing,
}: {
    allCountries: RefCountry[]; sourcingCountries: SourcingCountry[];
}) {
    const [sourcingList, setSourcingList] = useState<SourcingCountry[]>(initialSourcing)
    const [search, setSearch] = useState('')
    const [regionFilter, setRegionFilter] = useState('')
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [showPicker, setShowPicker] = useState(false)
    const [isPending, startTransition] = useTransition()

    const sourcedCountryIds = useMemo(() => new Set(sourcingList.map(s => s.country)), [sourcingList])

    const regions = useMemo(() => {
        const r = new Set(sourcingList.map(s => s.country_region).filter(Boolean))
        return Array.from(r).sort() as string[]
    }, [sourcingList])

    const filteredSourcing = useMemo(() => {
        let list = sourcingList
        if (search) { const q = search.toLowerCase(); list = list.filter(s => s.country_name.toLowerCase().includes(q) || s.country_iso2.toLowerCase().includes(q)) }
        if (regionFilter) list = list.filter(s => s.country_region === regionFilter)
        return list
    }, [sourcingList, search, regionFilter])

    const regionBreakdown = useMemo(() => {
        const map: Record<string, number> = {}
        for (const s of sourcingList) { const r = s.country_region || 'Other'; map[r] = (map[r] || 0) + 1 }
        return Object.entries(map).sort(([, a], [, b]) => b - a)
    }, [sourcingList])

    const handleRemove = useCallback((sc: SourcingCountry) => {
        startTransition(async () => {
            const res = await disableSourcingCountry(sc.id)
            if (res.success) {
                toast.success(`${sc.country_name} removed`)
                setSourcingList(prev => prev.filter(s => s.id !== sc.id))
                if (expandedId === sc.id) setExpandedId(null)
            } else { toast.error(res.error || 'Failed') }
        })
    }, [expandedId])

    return (
        <div className="min-h-screen layout-container-padding theme-bg">
            {/* ═══ HEADER ═══ */}
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
                        style={{ background: 'linear-gradient(135deg, var(--app-info), color-mix(in srgb, var(--app-info) 60%, black))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-info) 30%, transparent)' }}>
                        <Globe className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Inventory</p>
                        <h1 className="text-2xl font-black tracking-tight text-app-foreground">
                            Sourcing <span style={{ color: 'var(--app-info)' }}>Countries</span>
                        </h1>
                        <p className="text-[10px] text-app-muted-foreground mt-0.5">
                            Expand any country to see linked brands and products
                        </p>
                    </div>
                </div>
                <button onClick={() => setShowPicker(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[12px] font-bold transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, var(--app-info), color-mix(in srgb, var(--app-info) 70%, black))' }}>
                    <Plus className="h-4 w-4" /> Add Countries
                </button>
            </div>

            {/* ═══ STATS ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
                <StatCard icon={Globe} label="Sourcing" value={sourcingList.length} cssVar="--app-info" />
                <StatCard icon={MapPin} label="Regions" value={regionBreakdown.length} cssVar="--app-primary" />
                <StatCard icon={BarChart3} label="Global Pool" value={allCountries.length} cssVar="--app-success" />
                <StatCard icon={TrendingUp} label="Available" value={allCountries.length - sourcingList.length} cssVar="--app-warning" />
            </div>

            {/* ═══ SEARCH & FILTERS ═══ */}
            <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input type="text" placeholder="Search countries..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-app-primary/20 transition-all"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => setRegionFilter('')}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                        style={{ background: !regionFilter ? 'var(--app-info)' : 'var(--app-surface)', color: !regionFilter ? 'white' : 'var(--app-muted-foreground)', border: `1px solid ${!regionFilter ? 'var(--app-info)' : 'var(--app-border)'}` }}>
                        All
                    </button>
                    {regions.map(r => (
                        <button key={r} onClick={() => setRegionFilter(regionFilter === r ? '' : r)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                            style={{ background: regionFilter === r ? `var(${rc(r)})` : 'var(--app-surface)', color: regionFilter === r ? 'white' : 'var(--app-muted-foreground)', border: `1px solid ${regionFilter === r ? `var(${rc(r)})` : 'var(--app-border)'}` }}>
                            {r}
                        </button>
                    ))}
                </div>
                <span className="text-[10px] font-bold text-app-muted-foreground ml-auto">{filteredSourcing.length} countr{filteredSourcing.length !== 1 ? 'ies' : 'y'}</span>
            </div>

            {/* ═══ COUNTRY CARDS — Expandable ═══ */}
            {filteredSourcing.length === 0 ? (
                <div className="py-16 text-center rounded-2xl" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                        style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)' }}>
                        <Globe size={28} style={{ color: 'var(--app-info)', opacity: 0.5 }} />
                    </div>
                    <p className="text-sm font-black text-app-foreground">No sourcing countries yet</p>
                    <p className="text-xs text-app-muted-foreground mt-1 max-w-sm mx-auto">Add countries where your products are sourced from</p>
                    <button onClick={() => setShowPicker(true)}
                        className="mt-4 inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-[12px] font-bold shadow-lg"
                        style={{ background: 'var(--app-info)' }}>
                        <Plus size={14} /> Get Started
                    </button>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {filteredSourcing.map(sc => {
                        const color = rc(sc.country_region)
                        const isOpen = expandedId === sc.id

                        return (
                            <div key={sc.id} className="rounded-xl overflow-hidden transition-all"
                                style={{ background: 'var(--app-surface)', border: `1px solid ${isOpen ? `var(${color})` : 'var(--app-border)'}` }}>

                                {/* Country header — clickable to expand */}
                                <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-app-surface-hover transition-colors"
                                    onClick={() => setExpandedId(isOpen ? null : sc.id)}>
                                    <div className="flex items-center gap-3">
                                        <button className="p-0.5 transition-transform" style={{ transform: isOpen ? 'rotate(90deg)' : '' }}>
                                            <ChevronRight size={14} className="text-app-muted-foreground" />
                                        </button>
                                        <span className="text-2xl">{getFlagEmoji(sc.country_iso2)}</span>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-[14px] font-black text-app-foreground">{sc.country_name}</h3>
                                                <span className="text-[9px] font-mono font-bold text-app-muted-foreground">{sc.country_iso2}</span>
                                                {sc.default_currency_code && (
                                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black"
                                                        style={{ background: 'color-mix(in srgb, var(--app-success) 12%, transparent)', color: 'var(--app-success)' }}>
                                                        {sc.default_currency_code}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {sc.country_region && (
                                                    <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: `var(${color})` }}>
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: `var(${color})` }} />
                                                        {sc.country_region}
                                                    </span>
                                                )}
                                                <span className="text-[9px] text-app-muted-foreground">
                                                    Click to see brands & products
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => handleRemove(sc)} disabled={isPending}
                                            className="p-2 rounded-lg hover:bg-app-error/10 transition-colors" title="Remove">
                                            <Trash2 size={13} className="text-app-muted-foreground hover:text-app-error" />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded detail — brands + products */}
                                {isOpen && (
                                    <div style={{ borderTop: '1px solid var(--app-border)' }}>
                                        <CountryDetail country={sc} />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ═══ REGION BREAKDOWN ═══ */}
            {regionBreakdown.length > 0 && (
                <div className="mt-5 rounded-xl p-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)' }}>
                            <BarChart3 size={12} style={{ color: 'var(--app-primary)' }} />
                        </div>
                        <h3 className="text-[11px] font-black text-app-foreground uppercase tracking-wider">By Region</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {regionBreakdown.map(([region, count]) => {
                            const pct = Math.round((count / sourcingList.length) * 100)
                            return (
                                <div key={region} className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer hover:scale-[1.02]"
                                    onClick={() => setRegionFilter(regionFilter === region ? '' : region)}
                                    style={{ background: `color-mix(in srgb, var(${rc(region)}) 8%, transparent)`, border: `1px solid color-mix(in srgb, var(${rc(region)}) 20%, transparent)` }}>
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: `var(${rc(region)})` }} />
                                    <span className="text-[10px] font-bold text-app-foreground">{region}</span>
                                    <span className="text-[10px] font-black" style={{ color: `var(${rc(region)})` }}>{count}</span>
                                    <span className="text-[8px] text-app-muted-foreground">({pct}%)</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ═══ PICKER MODAL ═══ */}
            {showPicker && <CountryPickerModal allCountries={allCountries} sourcedIds={sourcedCountryIds} onClose={() => setShowPicker(false)} onAdded={added => setSourcingList(prev => [...prev, ...added])} />}
        </div>
    )
}
