// @ts-nocheck
'use client'

/**
 * SOURCING COUNTRIES - ATTRIBUTE-BASED GROUPING
 * ==============================================
 * Shows Country → Brand → Parfum/Attribute → Size hierarchy
 * Example: Turkey → Head & Shoulders → Rose Small (3), Rose Medium (5), Citron Small (2), Citron Large (4)
 *
 * Key Insight: Products with different parfums (Rose vs Citron) are DIFFERENT even if same size
 */

import { useState, useMemo, useTransition, useCallback, useEffect } from 'react'
import {
    Globe, Search, Plus, X, Check, MapPin, Trash2,
    BarChart3, TrendingUp, Package, ChevronRight, ChevronDown,
    Tag, Layers, Eye, Sparkles, Box, Boxes
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

interface Product {
    id: number; name: string; sku: string;
    brand?: number; brand_name?: string;
    parfum?: number; parfum_name?: string;
    size?: number; size_unit?: string;
    cost_price?: number; selling_price_ttc?: number;
}

interface ProductVariant {
    parfum_id: number | null;
    parfum_name: string;         // "Rose", "Citron", "Menthe", "Original"
    size_label: string;          // "Small (200ml)", "Medium (400ml)"
    size_value: number | null;   // 200, 400, 750
    size_unit: string | null;    // "ml", "g"
    count: number;
    products: Product[];
}

interface BrandGroup {
    brand_id: number | null;
    brand_name: string;
    total_products: number;
    variants: ProductVariant[];
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
 *  PARFUM COLOR MAPPING — Visual coding for quick scanning
 * ═══════════════════════════════════════════════════════════════════════ */

const PARFUM_COLORS: Record<string, string> = {
    'Rose': '#ff6b9d',
    'Citron': '#fbbf24',
    'Menthe': '#10b981',
    'Lavande': '#a78bfa',
    'Original': '#3b82f6',
    'Jasmin': '#f97316',
    'Vanille': '#fde047',
    'Ocean': '#06b6d4',
}

function getParfumColor(parfumName: string): string {
    return PARFUM_COLORS[parfumName] || '#6b7280' // Default gray
}

/* ═══════════════════════════════════════════════════════════════════════
 *  BRAND GROUP CARD — Compact table-style display
 * ═══════════════════════════════════════════════════════════════════════ */

function BrandGroupCard({ brand, expanded, onToggle }: { brand: BrandGroup; expanded: boolean; onToggle: () => void }) {
    return (
        <div className="rounded-lg overflow-hidden transition-all"
            style={{ background: 'var(--app-surface)', border: `1px solid ${expanded ? 'var(--app-primary)' : 'var(--app-border)'}` }}>

            {/* Brand Header - Compact */}
            <div className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-app-surface-hover transition-colors"
                onClick={onToggle}
                style={{ borderBottom: expanded ? '1px solid var(--app-border)' : 'none' }}>
                <div className="flex items-center gap-2 flex-1">
                    <ChevronRight size={14} className="text-app-muted-foreground transition-transform"
                        style={{ transform: expanded ? 'rotate(90deg)' : '' }} />
                    <Tag size={12} className="text-app-primary" />
                    <h4 className="text-xs font-black text-app-foreground">
                        {brand.brand_name}
                    </h4>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black text-app-muted-foreground"
                        style={{ background: 'var(--app-border)' }}>
                        {brand.total_products}
                    </span>
                </div>
                <span className="text-[9px] text-app-muted-foreground">
                    {brand.variants.length} variants
                </span>
            </div>

            {/* Variants Table - Compact & Efficient */}
            {expanded && (
                <div className="px-3 py-2">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-app-muted-foreground"
                        style={{ borderBottom: '1px solid var(--app-border)' }}>
                        <div className="col-span-4">Parfum</div>
                        <div className="col-span-3">Size</div>
                        <div className="col-span-2 text-center">Qty</div>
                        <div className="col-span-3 text-right">Sample SKUs</div>
                    </div>

                    {/* Table Body */}
                    <div className="space-y-0.5 mt-1">
                        {brand.variants.map((variant, idx) => (
                            <div key={idx}
                                className="grid grid-cols-12 gap-2 px-2 py-1.5 rounded hover:bg-app-surface-hover transition-colors"
                                style={{ borderLeft: `3px solid ${getParfumColor(variant.parfum_name)}` }}>

                                {/* Parfum Name with Color Dot */}
                                <div className="col-span-4 flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full shrink-0"
                                        style={{ background: getParfumColor(variant.parfum_name) }} />
                                    <span className="text-[10px] font-bold text-app-foreground truncate">
                                        {variant.parfum_name}
                                    </span>
                                </div>

                                {/* Size */}
                                <div className="col-span-3 flex items-center">
                                    <span className="text-[10px] font-mono text-app-muted-foreground">
                                        {variant.size_label}
                                    </span>
                                </div>

                                {/* Quantity Badge */}
                                <div className="col-span-2 flex items-center justify-center">
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black"
                                        style={{
                                            background: `color-mix(in srgb, ${getParfumColor(variant.parfum_name)} 15%, transparent)`,
                                            color: getParfumColor(variant.parfum_name)
                                        }}>
                                        {variant.count}
                                    </span>
                                </div>

                                {/* Sample SKU (first product) */}
                                <div className="col-span-3 flex items-center justify-end">
                                    <span className="text-[9px] font-mono text-app-muted-foreground truncate">
                                        {variant.products[0]?.sku || '-'}
                                        {variant.count > 1 && <span className="ml-1 opacity-60">+{variant.count - 1}</span>}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Summary Row */}
                    <div className="mt-2 pt-2 px-2 text-[9px] text-app-muted-foreground flex justify-between"
                        style={{ borderTop: '1px solid var(--app-border)' }}>
                        <span>Total Variants: {brand.variants.length}</span>
                        <span>Total SKUs: {brand.total_products}</span>
                    </div>
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════════
 *  COUNTRY DETAIL — Groups products by Brand → Variant
 * ═══════════════════════════════════════════════════════════════════════ */

function CountryDetail({ country }: { country: SourcingCountry }) {
    const [brandGroups, setBrandGroups] = useState<BrandGroup[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedBrands, setExpandedBrands] = useState<Set<number | null>>(new Set())

    useEffect(() => {
        loadCountryData()
    }, [country.country])

    async function loadCountryData() {
        setLoading(true)
        try {
            // Fetch products from this country
            const prodRes = await erpFetch(`/inventory/products/?country_of_origin=${country.country}&page_size=1000`)
            const prods: Product[] = Array.isArray(prodRes) ? prodRes : prodRes?.results || []
            setProducts(prods)

            // Group by brand, then by size
            const groups = groupProductsByBrandAndSize(prods)
            setBrandGroups(groups)
        } catch (err) {
            console.error('Failed to load country data:', err)
            setProducts([])
            setBrandGroups([])
        }
        setLoading(false)
    }

    function groupProductsByBrandAndSize(products: Product[]): BrandGroup[] {
        const brandMap = new Map<number | null, Product[]>()

        // Group by brand
        for (const p of products) {
            const brandId = p.brand || null
            if (!brandMap.has(brandId)) {
                brandMap.set(brandId, [])
            }
            brandMap.get(brandId)!.push(p)
        }

        // For each brand, group by parfum (attribute) THEN by size
        const groups: BrandGroup[] = []
        for (const [brandId, brandProducts] of brandMap) {
            const brandName = brandProducts[0]?.brand_name || (brandId ? `Brand #${brandId}` : 'No Brand')

            // Group by parfum + size (combined key)
            const variantMap = new Map<string, Product[]>()
            for (const p of brandProducts) {
                const variantKey = createVariantKey(p)  // parfum + size
                if (!variantMap.has(variantKey)) {
                    variantMap.set(variantKey, [])
                }
                variantMap.get(variantKey)!.push(p)
            }

            // Create variants (each unique parfum + size combination)
            const variants: ProductVariant[] = []
            for (const [variantKey, variantProducts] of variantMap) {
                const firstProduct = variantProducts[0]
                const parfumName = firstProduct.parfum_name || 'Original'
                const sizeLabel = createSizeLabel(firstProduct)

                variants.push({
                    parfum_id: firstProduct.parfum || null,
                    parfum_name: parfumName,
                    size_label: sizeLabel,
                    size_value: firstProduct.size || null,
                    size_unit: firstProduct.size_unit || null,
                    count: variantProducts.length,
                    products: variantProducts.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                })
            }

            // Sort variants: first by parfum name, then by size value
            variants.sort((a, b) => {
                // First sort by parfum name
                const parfumCompare = a.parfum_name.localeCompare(b.parfum_name)
                if (parfumCompare !== 0) return parfumCompare

                // Then by size value
                if (a.size_value === null) return 1
                if (b.size_value === null) return -1
                return a.size_value - b.size_value
            })

            groups.push({
                brand_id: brandId,
                brand_name: brandName,
                total_products: brandProducts.length,
                variants
            })
        }

        // Sort brands by product count (desc)
        return groups.sort((a, b) => b.total_products - a.total_products)
    }

    function createVariantKey(product: Product): string {
        // Unique key for each parfum + size combination
        const parfumKey = product.parfum || 'no-parfum'
        const sizeKey = product.size ? `${product.size}-${product.size_unit || 'unit'}` : 'no-size'
        return `${parfumKey}:${sizeKey}`
    }

    function createSizeLabel(product: Product): string {
        if (!product.size) return 'Standard Size'
        const sizeVal = parseFloat(String(product.size))
        const unit = product.size_unit || 'unit'

        // Categorize sizes
        if (unit === 'ml' || unit === 'g') {
            if (sizeVal < 300) return `Small (${sizeVal}${unit})`
            if (sizeVal < 600) return `Medium (${sizeVal}${unit})`
            return `Large (${sizeVal}${unit})`
        }

        return `${sizeVal}${unit}`
    }

    function toggleBrand(brandId: number | null) {
        setExpandedBrands(prev => {
            const next = new Set(prev)
            if (next.has(brandId)) {
                next.delete(brandId)
            } else {
                next.add(brandId)
            }
            return next
        })
    }

    if (loading) return (
        <div className="py-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    return (
        <div className="px-3 pb-3 space-y-2">
            {/* Quick Stats - More Compact */}
            <div className="flex items-center gap-4 px-3 py-2 rounded-lg text-[10px]"
                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-1.5">
                    <Tag size={11} className="text-app-info" />
                    <span className="font-bold text-app-muted-foreground">Brands:</span>
                    <span className="font-black text-app-foreground">{brandGroups.length}</span>
                </div>
                <div className="w-px h-4" style={{ background: 'var(--app-border)' }} />
                <div className="flex items-center gap-1.5">
                    <Package size={11} className="text-app-success" />
                    <span className="font-bold text-app-muted-foreground">SKUs:</span>
                    <span className="font-black text-app-foreground">{products.length}</span>
                </div>
                <div className="w-px h-4" style={{ background: 'var(--app-border)' }} />
                <div className="flex items-center gap-1.5">
                    <Boxes size={11} className="text-app-warning" />
                    <span className="font-bold text-app-muted-foreground">Variants:</span>
                    <span className="font-black text-app-foreground">
                        {brandGroups.reduce((sum, b) => sum + b.variants.length, 0)}
                    </span>
                </div>
            </div>

            {/* Brand Groups */}
            {brandGroups.length > 0 ? (
                <div className="space-y-2">
                    <p className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        <Tag size={9} /> Brands & Variants
                    </p>
                    {brandGroups.map(brand => (
                        <BrandGroupCard
                            key={brand.brand_id || 'no-brand'}
                            brand={brand}
                            expanded={expandedBrands.has(brand.brand_id)}
                            onToggle={() => toggleBrand(brand.brand_id)}
                        />
                    ))}
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
 *  COUNTRY PICKER MODAL - PREMIUM REDESIGN V2
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
    const [activeRegion, setActiveRegion] = useState<string | null>(null)

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

    const regionStats = useMemo(() => {
        const stats: Record<string, { total: number; selected: number }> = {}
        for (const [region, countries] of byRegion) {
            stats[region] = {
                total: countries.length,
                selected: countries.filter(c => selectedIds.has(c.id)).length
            }
        }
        return stats
    }, [byRegion, selectedIds])

    const toggle = (id: number) => setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

    const selectAllInRegion = (region: string) => {
        const regionCountries = byRegion.find(([r]) => r === region)?.[1] || []
        const allSelected = regionCountries.every(c => selectedIds.has(c.id))
        setSelectedIds(p => {
            const n = new Set(p)
            regionCountries.forEach(c => allSelected ? n.delete(c.id) : n.add(c.id))
            return n
        })
    }

    const handleAdd = () => {
        if (selectedIds.size === 0) return
        startTransition(async () => {
            const res = await bulkEnableSourcingCountries(Array.from(selectedIds))
            if (res.success) {
                toast.success(`${selectedIds.size} sourcing ${selectedIds.size === 1 ? 'country' : 'countries'} added`)
                const added: SourcingCountry[] = Array.from(selectedIds).map(cid => {
                    const c = allCountries.find(x => x.id === cid)!
                    return { id: Date.now() + cid, country: cid, country_iso2: c.iso2, country_iso3: c.iso3, country_name: c.name, country_region: c.region, default_currency_code: c.default_currency_code, is_enabled: true, notes: '' }
                })
                onAdded(added); onClose()
            } else { toast.error(res.error || 'Failed to add countries') }
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-5xl mx-4 rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300"
                style={{ background: 'var(--app-surface)', border: '2px solid var(--app-border)', maxHeight: '85vh' }}
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between"
                    style={{ background: 'var(--app-background)', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, var(--app-info), color-mix(in srgb, var(--app-info) 70%, black))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                            <Globe size={18} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-black" style={{ color: 'var(--app-foreground)' }}>Add Sourcing Countries</h3>
                            <div className="flex items-center gap-2.5 mt-0.5">
                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {available.length} Available
                                </p>
                                {selectedIds.size > 0 && (
                                    <>
                                        <div className="w-px h-3" style={{ background: 'var(--app-border)' }} />
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                                            style={{ background: 'var(--app-success)', color: 'white' }}>
                                            <Check size={10} strokeWidth={3} />
                                            <span className="text-[10px] font-black">{selectedIds.size} Selected</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:opacity-70 transition-all"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-6 py-3.5" style={{ background: 'var(--app-background)', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="relative">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted-foreground)' }} />
                        <input
                            type="text"
                            placeholder="Search by name, code, or region..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl text-[12px] font-medium outline-none transition-all"
                            style={{
                                background: 'var(--app-surface)',
                                border: '1px solid var(--app-border)',
                                color: 'var(--app-foreground)'
                            }}
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center hover:opacity-70 transition-all"
                                style={{ color: 'var(--app-muted-foreground)' }}
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Region Tabs */}
                {!search && byRegion.length > 1 && (
                    <div className="px-6 py-3 flex items-center gap-2 overflow-x-auto custom-scrollbar"
                        style={{ background: 'var(--app-background)', borderBottom: '1px solid var(--app-border)' }}>
                        <button
                            onClick={() => setActiveRegion(null)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap"
                            style={{
                                background: activeRegion === null ? 'var(--app-info)' : 'var(--app-surface)',
                                color: activeRegion === null ? 'white' : 'var(--app-muted-foreground)',
                                border: `1px solid ${activeRegion === null ? 'var(--app-info)' : 'var(--app-border)'}`
                            }}
                        >
                            All Regions <span className="opacity-60">({available.length})</span>
                        </button>
                        {byRegion.map(([region, countries]) => (
                            <button
                                key={region}
                                onClick={() => setActiveRegion(activeRegion === region ? null : region)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap"
                                style={{
                                    background: activeRegion === region ? `var(${rc(region)})` : 'var(--app-surface)',
                                    color: activeRegion === region ? 'white' : `var(${rc(region)})`,
                                    border: `1px solid ${activeRegion === region ? `var(${rc(region)})` : 'var(--app-border)'}`
                                }}
                            >
                                <div className="w-1.5 h-1.5 rounded-full"
                                    style={{ background: activeRegion === region ? 'white' : `var(${rc(region)})` }}
                                />
                                {region}
                                <span className="opacity-60">
                                    ({regionStats[region]?.selected > 0 ? `${regionStats[region].selected}/` : ''}{countries.length})
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Countries Grid */}
                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar" style={{ minHeight: 300 }}>
                    {available.length === 0 ? (
                        <div className="py-16 text-center">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                                style={{ background: 'var(--app-background)', border: '2px dashed var(--app-border)' }}>
                                <Globe size={32} style={{ color: 'var(--app-muted-foreground)', opacity: 0.4 }} />
                            </div>
                            <p className="text-sm font-bold mb-1" style={{ color: 'var(--app-foreground)' }}>
                                {search ? 'No matching countries found' : 'All countries already added!'}
                            </p>
                            <p className="text-[11px]" style={{ color: 'var(--app-muted-foreground)' }}>
                                {search ? 'Try a different search term' : 'You have sourcing enabled for all available countries'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {byRegion
                                .filter(([region]) => !activeRegion || region === activeRegion)
                                .map(([region, countries]) => {
                                const allRegionSelected = countries.every(c => selectedIds.has(c.id))
                                const someRegionSelected = countries.some(c => selectedIds.has(c.id))

                                return (
                                    <div key={region} className="mb-5">
                                        {/* Region Header with Select All */}
                                        <div className="flex items-center justify-between mb-3 px-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ background: `var(${rc(region)})` }} />
                                                <p className="text-[10px] font-black uppercase tracking-widest"
                                                    style={{ color: `var(${rc(region)})` }}>
                                                    {region}
                                                </p>
                                                <div className="px-2 py-0.5 rounded-full text-[9px] font-black"
                                                    style={{
                                                        background: `color-mix(in srgb, var(${rc(region)}) 15%, transparent)`,
                                                        color: `var(${rc(region)})`
                                                    }}>
                                                    {regionStats[region]?.selected > 0
                                                        ? `${regionStats[region].selected}/${countries.length}`
                                                        : countries.length}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => selectAllInRegion(region)}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all hover:scale-105"
                                                style={{
                                                    background: allRegionSelected
                                                        ? `var(${rc(region)})`
                                                        : `color-mix(in srgb, var(${rc(region)}) 10%, transparent)`,
                                                    color: allRegionSelected ? 'white' : `var(${rc(region)})`,
                                                    border: `1px solid var(${rc(region)})`
                                                }}
                                            >
                                                {allRegionSelected ? (
                                                    <>
                                                        <X size={9} strokeWidth={3} />
                                                        Deselect All
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check size={9} strokeWidth={3} />
                                                        Select All
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {/* Countries Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {countries.map(c => {
                                                const sel = selectedIds.has(c.id)
                                                return (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => toggle(c.id)}
                                                        className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:scale-[1.02]"
                                                        style={{
                                                            background: sel
                                                                ? `color-mix(in srgb, var(${rc(region)}) 15%, var(--app-surface))`
                                                                : 'var(--app-surface)',
                                                            border: sel
                                                                ? `2px solid var(${rc(region)})`
                                                                : '1px solid var(--app-border)',
                                                            boxShadow: sel ? `0 4px 12px color-mix(in srgb, var(${rc(region)}) 25%, transparent)` : 'none'
                                                        }}
                                                    >
                                                        {/* Flag */}
                                                        <span className="text-2xl transition-transform group-hover:scale-110"
                                                            style={{ transform: sel ? 'scale(1.1)' : 'scale(1)' }}>
                                                            {getFlagEmoji(c.iso2)}
                                                        </span>

                                                        {/* Country Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[11px] font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                                {c.name}
                                                            </p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[9px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                                                    {c.iso2}
                                                                </span>
                                                                {c.default_currency_code && (
                                                                    <>
                                                                        <div className="w-0.5 h-0.5 rounded-full" style={{ background: 'var(--app-muted-foreground)' }} />
                                                                        <span className="text-[9px] font-bold" style={{ color: `var(${rc(region)})` }}>
                                                                            {c.default_currency_code}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Selection Indicator */}
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${sel ? 'scale-100' : 'scale-0'}`}
                                                            style={{
                                                                background: `var(${rc(region)})`,
                                                                boxShadow: `0 2px 8px color-mix(in srgb, var(${rc(region)}) 40%, transparent)`
                                                            }}>
                                                            <Check size={12} className="text-white" strokeWidth={3} />
                                                        </div>

                                                        {/* Hover Border Animation */}
                                                        {!sel && (
                                                            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                                                style={{ border: `1px solid var(${rc(region)})` }}
                                                            />
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </>
                    )}
                </div>

                {/* Footer with Action Buttons */}
                <div className="px-6 py-4 flex items-center justify-between gap-4"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-background)' }}>
                    {/* Selection Summary */}
                    <div className="flex items-center gap-3">
                        {selectedIds.size > 0 ? (
                            <>
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                    <Check size={13} style={{ color: 'var(--app-success)' }} strokeWidth={2.5} />
                                    <span className="text-[11px] font-black" style={{ color: 'var(--app-foreground)' }}>
                                        {selectedIds.size} {selectedIds.size === 1 ? 'Country' : 'Countries'} Selected
                                    </span>
                                </div>
                                <button
                                    onClick={() => setSelectedIds(new Set())}
                                    className="text-[10px] font-bold uppercase tracking-wider transition-all hover:opacity-70"
                                    style={{ color: 'var(--app-muted-foreground)' }}
                                >
                                    Clear All
                                </button>
                            </>
                        ) : (
                            <p className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                Select countries to enable sourcing
                            </p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all hover:opacity-80"
                            style={{
                                border: '1px solid var(--app-border)',
                                background: 'var(--app-surface)',
                                color: 'var(--app-muted-foreground)'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={selectedIds.size === 0 || isPending}
                            className="px-6 py-2.5 rounded-xl text-[12px] font-bold text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 hover:opacity-90 transition-all"
                            style={{
                                background: selectedIds.size > 0
                                    ? 'linear-gradient(135deg, var(--app-success), color-mix(in srgb, var(--app-success) 70%, black))'
                                    : 'var(--app-border)'
                            }}
                        >
                            {isPending ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <Plus size={14} strokeWidth={2.5} />
                                    Add {selectedIds.size > 0 ? selectedIds.size : ''} {selectedIds.size === 1 ? 'Country' : 'Countries'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════════
 *  MAIN PAGE (unchanged structure, uses optimized CountryDetail)
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
    const [viewMode, setViewMode] = useState<'table' | 'dashboard'>('table') // NEW: View toggle

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
                            {viewMode === 'table' ? '📊 Table View - Compact data layout' : '📈 Dashboard View - Visual analytics'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* View Toggle */}
                    <div className="flex items-center rounded-lg p-1" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <button
                            onClick={() => setViewMode('table')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold transition-all"
                            style={{
                                background: viewMode === 'table' ? 'var(--app-info)' : 'transparent',
                                color: viewMode === 'table' ? 'white' : 'var(--app-muted-foreground)'
                            }}>
                            <BarChart3 size={14} />
                            Table
                        </button>
                        <button
                            onClick={() => setViewMode('dashboard')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold transition-all"
                            style={{
                                background: viewMode === 'dashboard' ? 'var(--app-info)' : 'transparent',
                                color: viewMode === 'dashboard' ? 'white' : 'var(--app-muted-foreground)'
                            }}>
                            <TrendingUp size={14} />
                            Dashboard
                        </button>
                    </div>
                    <button onClick={() => setShowPicker(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[12px] font-bold transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]"
                        style={{ background: 'linear-gradient(135deg, var(--app-info), color-mix(in srgb, var(--app-info) 70%, black))' }}>
                        <Plus className="h-4 w-4" /> Add Countries
                    </button>
                </div>
            </div>

            {/* ═══ ULTRA-COMPACT STATS ROW ═══ */}
            <div className="mb-3 px-4 py-2 rounded-lg flex items-center gap-6 text-[11px]"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-1.5">
                    <Globe size={13} className="text-app-info" />
                    <span className="font-bold text-app-muted-foreground">Sourcing:</span>
                    <span className="font-black text-app-foreground">{sourcingList.length}</span>
                </div>
                <div className="w-px h-4" style={{ background: 'var(--app-border)' }} />
                <div className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-app-primary" />
                    <span className="font-bold text-app-muted-foreground">Regions:</span>
                    <span className="font-black text-app-foreground">{regionBreakdown.length}</span>
                </div>
                <div className="w-px h-4" style={{ background: 'var(--app-border)' }} />
                <div className="flex items-center gap-1.5">
                    <BarChart3 size={13} className="text-app-success" />
                    <span className="font-bold text-app-muted-foreground">Global Pool:</span>
                    <span className="font-black text-app-foreground">{allCountries.length}</span>
                </div>
                <div className="w-px h-4" style={{ background: 'var(--app-border)' }} />
                <div className="flex items-center gap-1.5">
                    <TrendingUp size={13} className="text-app-warning" />
                    <span className="font-bold text-app-muted-foreground">Available:</span>
                    <span className="font-black text-app-foreground">{allCountries.length - sourcingList.length}</span>
                </div>
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
                                style={{
                                    background: isOpen ? `linear-gradient(to right, color-mix(in srgb, var(${color}) 8%, transparent), var(--app-surface))` : 'var(--app-surface)',
                                    border: `2px solid ${isOpen ? `var(${color})` : 'var(--app-border)'}`,
                                    boxShadow: isOpen ? `0 4px 20px color-mix(in srgb, var(${color}) 25%, transparent)` : 'none'
                                }}>

                                {/* Country header — clickable to expand */}
                                <div className="px-4 py-3 flex items-center justify-between cursor-pointer transition-all relative"
                                    onClick={() => setExpandedId(isOpen ? null : sc.id)}
                                    style={{
                                        background: isOpen ? `linear-gradient(90deg, color-mix(in srgb, var(${color}) 15%, transparent) 0%, transparent 100%)` : 'transparent'
                                    }}>

                                    {/* Active indicator bar */}
                                    {isOpen && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 animate-pulse"
                                            style={{ background: `var(${color})` }} />
                                    )}

                                    <div className="flex items-center gap-3">
                                        <button className="p-0.5 transition-transform" style={{ transform: isOpen ? 'rotate(90deg)' : '' }}>
                                            <ChevronRight size={14} style={{ color: isOpen ? `var(${color})` : 'var(--app-muted-foreground)' }} />
                                        </button>
                                        <span className="text-2xl" style={{ transform: isOpen ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.2s' }}>
                                            {getFlagEmoji(sc.country_iso2)}
                                        </span>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-[14px] font-black transition-colors"
                                                    style={{ color: isOpen ? `var(${color})` : 'var(--app-foreground)' }}>
                                                    {sc.country_name}
                                                </h3>
                                                {isOpen && (
                                                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse"
                                                        style={{
                                                            background: `var(${color})`,
                                                            color: 'white'
                                                        }}>
                                                        VIEWING
                                                    </span>
                                                )}
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
                                                <span className="text-[9px]"
                                                    style={{ color: isOpen ? `var(${color})` : 'var(--app-muted-foreground)' }}>
                                                    {isOpen ? '⬇ Viewing brands & variants below' : 'Click to see brands & variants'}
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
