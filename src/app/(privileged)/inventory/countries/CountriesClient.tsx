'use client'

/**
 * SOURCING COUNTRIES — V5 Premium Redesign
 * ==========================================
 * Same V4 data model (server-enriched). Full Tailwind + theme-variable UI.
 */

import { useState, useMemo, useTransition, useCallback, useEffect } from 'react'
import {
    Globe, Search, Plus, X, Check, Trash2,
    Package, ChevronRight, Tag, MapPin, TrendingUp,
    Star, Boxes, BarChart3, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import {
    disableSourcingCountry,
    bulkEnableSourcingCountries,
} from '@/app/actions/reference'
import { getCountryProducts } from '@/app/actions/inventory/countries'
import { useRouter } from 'next/navigation'

/* ─── TYPES ── */
interface InventoryCountry {
    id: number; name: string; iso2: string; iso3?: string;
    region?: string; phone_code?: string; currency_code?: string;
    flag: string; productCount: number; brandCount: number; isDefault: boolean;
}
interface RefCountry {
    id: number; iso2: string; iso3?: string; name: string;
    phone_code?: string; region?: string; subregion?: string;
    default_currency?: number; default_currency_code?: string;
}
interface DrillProduct {
    id: number; name: string; sku?: string; brand?: string; category?: string;
}

/* ─── HELPERS ── */
function FlagImg({ iso2, size = 28 }: { iso2: string; size?: number }) {
    if (!iso2) return <span style={{ fontSize: size * 0.8 }}>🏳️</span>
    const code = iso2.toLowerCase()
    return (
        <img src={`https://flagcdn.com/w80/${code}.png`}
            srcSet={`https://flagcdn.com/w160/${code}.png 2x`}
            alt={iso2} width={size} height={Math.round(size * 0.75)}
            className="rounded object-cover shadow-sm"
            style={{ border: '1px solid rgba(0,0,0,0.08)' }}
            loading="lazy" />
    )
}

const REGION_COLORS: Record<string, string> = {
    'Africa': 'var(--app-warning)', 'Americas': 'var(--app-success)',
    'Asia': 'var(--app-error)', 'Europe': 'var(--app-primary)', 'Oceania': 'var(--app-info)',
}
function rc(r?: string) { return REGION_COLORS[r || ''] || 'var(--app-muted-foreground)' }

const HIDDEN_ISO2 = new Set(['IL'])

/* ═══════════════════════════════════════════════════════════════════
 *  MAIN
 * ═══════════════════════════════════════════════════════════════════ */
export default function CountriesClient({
    inventoryCountries: initial,
    allRefCountries,
}: {
    inventoryCountries: InventoryCountry[]
    allRefCountries: RefCountry[]
}) {
    const router = useRouter()
    const [countries, setCountries] = useState(initial)
    const [search, setSearch] = useState('')
    const [regionFilter, setRegionFilter] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [showPicker, setShowPicker] = useState(false)
    const [isPending, startTransition] = useTransition()

    const sourcedIds = useMemo(() => new Set(countries.map(c => c.id)), [countries])
    const totalProducts = useMemo(() => countries.reduce((s, c) => s + c.productCount, 0), [countries])
    const totalBrands = useMemo(() => countries.reduce((s, c) => s + c.brandCount, 0), [countries])
    const topRegion = useMemo(() => {
        const m = new Map<string, number>()
        countries.forEach(c => m.set(c.region || 'Other', (m.get(c.region || 'Other') || 0) + c.productCount))
        let top = '—'; let max = 0
        m.forEach((v, k) => { if (v > max) { max = v; top = k } })
        return top
    }, [countries])

    const regions = useMemo(() => {
        const set = new Set<string>()
        countries.forEach(c => { if (c.region) set.add(c.region) })
        return Array.from(set).sort()
    }, [countries])

    const filtered = useMemo(() => {
        let list = countries
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(c => c.name.toLowerCase().includes(q) || c.iso2.toLowerCase().includes(q) || (c.region || '').toLowerCase().includes(q))
        }
        if (regionFilter) list = list.filter(c => c.region === regionFilter)
        return list
    }, [countries, search, regionFilter])

    const byRegion = useMemo(() => {
        const map: Record<string, InventoryCountry[]> = {}
        for (const c of filtered) {
            const r = c.region || 'Other'
            if (!map[r]) map[r] = []
            map[r].push(c)
        }
        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([r, cs]) => [r, cs.sort((a, b) => b.productCount - a.productCount)] as [string, InventoryCountry[]])
    }, [filtered])

    const handleRemove = useCallback((c: InventoryCountry) => {
        startTransition(async () => {
            const res = await disableSourcingCountry(c.id)
            if (res.success) { setCountries(prev => prev.filter(x => x.id !== c.id)); setExpandedId(null); toast.success(`${c.name} removed`); router.refresh() }
            else toast.error(res.error || 'Failed to remove')
        })
    }, [router])

    const handleAdded = useCallback(() => { router.refresh(); window.location.reload() }, [router])

    return (
        <div className="space-y-5">
            {/* ═══ HEADER ═══ */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 60%, black))', boxShadow: '0 8px 24px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        <Globe size={26} className="text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Inventory</p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-app-foreground italic">
                            Sourcing <span style={{ color: 'var(--app-primary)' }}>Countries</span>
                        </h1>
                        <p className="text-xs font-bold text-app-muted-foreground mt-0.5">
                            {countries.length} {countries.length === 1 ? 'country' : 'countries'} · {totalProducts} products · {totalBrands} brands
                        </p>
                    </div>
                </div>
                <button onClick={() => setShowPicker(true)}
                    className="flex items-center gap-2 text-[12px] font-black text-white px-5 py-2.5 rounded-xl transition-all hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 60%, black))', boxShadow: '0 4px 16px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                    <Plus size={16} strokeWidth={2.5} /> Add Countries
                </button>
            </div>

            {/* ═══ STATS RIBBON ═══ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { icon: Globe, label: 'Countries', value: countries.length, color: 'var(--app-primary)' },
                    { icon: Package, label: 'Products', value: totalProducts, color: 'var(--app-success)' },
                    { icon: Tag, label: 'Brands', value: totalBrands, color: 'var(--app-info)' },
                    { icon: MapPin, label: 'Regions', value: regions.length, color: 'var(--app-warning)' },
                    { icon: BarChart3, label: 'Top Region', value: topRegion, color: 'var(--app-error)', small: true },
                    { icon: Star, label: 'Default', value: countries.find(c => c.isDefault)?.iso2 || '—', color: 'var(--app-primary)', small: true },
                ].map(s => (
                    <div key={s.label} className="relative overflow-hidden rounded-2xl border p-3.5"
                        style={{ background: 'var(--app-surface)', borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: `color-mix(in srgb, ${s.color} 12%, transparent)` }}>
                                <s.icon size={16} style={{ color: s.color }} />
                            </div>
                            <div>
                                <p className="text-[8px] font-black uppercase tracking-widest text-app-muted-foreground">{s.label}</p>
                                <p className="font-black tabular-nums mt-0.5" style={{ fontSize: s.small ? 13 : 18, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
                            </div>
                        </div>
                        <div className="absolute -top-4 -right-4 w-14 h-14 rounded-full opacity-[0.06]" style={{ background: s.color }} />
                    </div>
                ))}
            </div>

            {/* ═══ SEARCH + REGION FILTER ═══ */}
            <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--app-surface)', borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 border-b"
                    style={{ borderColor: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input type="text" placeholder="Search countries…" value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full text-[12px] font-medium pl-9 pr-8 py-2.5 rounded-xl border outline-none transition-all"
                            style={{ background: 'var(--app-background)', borderColor: 'var(--app-border)', color: 'var(--app-foreground)' }} />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-app-foreground">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                    {/* Region pills */}
                    {regions.length > 1 && (
                        <div className="flex gap-1.5 flex-wrap">
                            <RegionPill label="All" active={!regionFilter} onClick={() => setRegionFilter(null)} color="var(--app-primary)" />
                            {regions.map(r => (
                                <RegionPill key={r} label={r} active={regionFilter === r}
                                    onClick={() => setRegionFilter(regionFilter === r ? null : r)} color={rc(r)} />
                            ))}
                        </div>
                    )}
                </div>

                {/* ═══ TABLE ═══ */}
                <div className="p-3">
                    {filtered.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl border-2 border-dashed flex items-center justify-center"
                                style={{ borderColor: 'var(--app-border)' }}>
                                <Globe size={28} className="text-app-muted-foreground opacity-30" />
                            </div>
                            <p className="text-sm font-bold text-app-foreground">{search || regionFilter ? 'No matching countries' : 'No sourcing countries yet'}</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1">{search || regionFilter ? 'Try a different search or filter' : 'Click "Add Countries" to get started'}</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {byRegion.map(([region, list]) => (
                                <div key={region}>
                                    {/* Region header */}
                                    <div className="flex items-center gap-2.5 mb-2.5 px-1">
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: rc(region) }} />
                                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: rc(region) }}>{region}</span>
                                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full"
                                            style={{ background: `color-mix(in srgb, ${rc(region)} 12%, transparent)`, color: rc(region) }}>
                                            {list.length}
                                        </span>
                                        <span className="text-[9px] font-bold text-app-muted-foreground">
                                            · {list.reduce((s, c) => s + c.productCount, 0)} products
                                        </span>
                                        <div className="flex-1 h-px" style={{ background: 'var(--app-border)' }} />
                                    </div>

                                    {/* Country rows */}
                                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                                        {/* Table header */}
                                        <div className="hidden sm:grid grid-cols-[2fr_80px_80px_70px_40px] gap-2 px-4 py-2 text-[8px] font-black uppercase tracking-widest text-app-muted-foreground"
                                            style={{ background: 'var(--app-background)', borderBottom: '1px solid var(--app-border)' }}>
                                            <span>Country</span>
                                            <span className="text-center">Products</span>
                                            <span className="text-center">Brands</span>
                                            <span className="text-center">Currency</span>
                                            <span />
                                        </div>

                                        {list.map((c, i) => {
                                            const isExp = expandedId === c.id
                                            return (
                                                <div key={c.id}>
                                                    <div onClick={() => setExpandedId(isExp ? null : c.id)}
                                                        className="grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_80px_80px_70px_40px] gap-2 items-center px-4 py-2.5 cursor-pointer transition-colors hover:bg-app-background"
                                                        style={{
                                                            background: isExp ? 'color-mix(in srgb, var(--app-primary) 5%, var(--app-surface))' : 'var(--app-surface)',
                                                            borderBottom: i < list.length - 1 || isExp ? '1px solid var(--app-border)' : 'none',
                                                        }}>
                                                        {/* Country info */}
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <FlagImg iso2={c.iso2} size={28} />
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[13px] font-black text-app-foreground truncate">{c.name}</span>
                                                                    {c.isDefault && (
                                                                        <span className="text-[7px] font-black px-1.5 py-0.5 rounded text-white shrink-0"
                                                                            style={{ background: 'var(--app-primary)' }}>DEFAULT</span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] font-medium text-app-muted-foreground">
                                                                    {c.iso2}{c.region ? ` · ${c.region}` : ''}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Products — hidden on mobile, shown in mobile row below */}
                                                        <div className="hidden sm:block text-center">
                                                            <span className="inline-block min-w-[32px] px-2 py-1 rounded-lg text-[11px] font-black"
                                                                style={{
                                                                    background: c.productCount > 0 ? 'color-mix(in srgb, var(--app-success) 10%, transparent)' : 'transparent',
                                                                    color: c.productCount > 0 ? 'var(--app-success)' : 'var(--app-muted-foreground)',
                                                                }}>
                                                                {c.productCount}
                                                            </span>
                                                        </div>

                                                        {/* Brands */}
                                                        <div className="hidden sm:block text-center">
                                                            <span className="inline-block min-w-[32px] px-2 py-1 rounded-lg text-[11px] font-black"
                                                                style={{
                                                                    background: c.brandCount > 0 ? 'color-mix(in srgb, var(--app-info) 10%, transparent)' : 'transparent',
                                                                    color: c.brandCount > 0 ? 'var(--app-info)' : 'var(--app-muted-foreground)',
                                                                }}>
                                                                {c.brandCount}
                                                            </span>
                                                        </div>

                                                        {/* Currency */}
                                                        <div className="hidden sm:block text-center text-[10px] font-bold text-app-muted-foreground">
                                                            {c.currency_code || '—'}
                                                        </div>

                                                        {/* Chevron */}
                                                        <div className="text-center">
                                                            <ChevronRight size={14} className="text-app-muted-foreground transition-transform duration-200"
                                                                style={{ transform: isExp ? 'rotate(90deg)' : 'none' }} />
                                                        </div>

                                                        {/* Mobile-only badges */}
                                                        <div className="col-span-2 flex gap-3 sm:hidden -mt-1">
                                                            <span className="text-[9px] font-black" style={{ color: 'var(--app-success)' }}>{c.productCount} products</span>
                                                            <span className="text-[9px] font-black" style={{ color: 'var(--app-info)' }}>{c.brandCount} brands</span>
                                                            {c.currency_code && <span className="text-[9px] font-bold text-app-muted-foreground">{c.currency_code}</span>}
                                                        </div>
                                                    </div>

                                                    {isExp && <CountryDrillDown country={c} onRemove={() => handleRemove(c)} isPending={isPending} />}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ PICKER ═══ */}
            {showPicker && (
                <Picker allCountries={allRefCountries} sourcedIds={sourcedIds}
                    onClose={() => setShowPicker(false)} onAdded={handleAdded} />
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
 *  COUNTRY DRILL-DOWN
 * ═══════════════════════════════════════════════════════════════════ */
function CountryDrillDown({ country, onRemove, isPending }: {
    country: InventoryCountry; onRemove: () => void; isPending: boolean
}) {
    const [products, setProducts] = useState<DrillProduct[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        getCountryProducts(country.id).then(p => { if (!cancelled) { setProducts(p); setLoading(false) } })
        return () => { cancelled = true }
    }, [country.id])

    const byBrand = useMemo(() => {
        const m = new Map<string, DrillProduct[]>()
        products.forEach(p => { const k = p.brand || 'No Brand'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(p) })
        return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length)
    }, [products])

    return (
        <div className="px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-150"
            style={{ background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
            {loading ? (
                <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 size={14} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                    <span className="text-[11px] font-bold text-app-muted-foreground">Loading product details…</span>
                </div>
            ) : products.length === 0 ? (
                <div className="text-center py-4">
                    <Package size={18} className="mx-auto mb-1 text-app-muted-foreground opacity-30" />
                    <p className="text-[11px] font-bold text-app-muted-foreground">No products linked to this country</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Mini summary */}
                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl border text-[10px]"
                        style={{ background: 'var(--app-background)', borderColor: 'var(--app-border)' }}>
                        <span className="font-black" style={{ color: 'var(--app-success)' }}>{products.length} products</span>
                        <div className="w-px h-3.5" style={{ background: 'var(--app-border)' }} />
                        <span className="font-black" style={{ color: 'var(--app-info)' }}>{byBrand.length} brands</span>
                        <div className="w-px h-3.5" style={{ background: 'var(--app-border)' }} />
                        <span className="font-bold text-app-muted-foreground">top: {byBrand[0]?.[0] || '—'} ({byBrand[0]?.[1].length || 0})</span>
                    </div>

                    {/* Brand grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                        {byBrand.slice(0, 8).map(([brand, prods]) => (
                            <div key={brand} className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                                style={{ background: 'var(--app-surface)', borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                <Tag size={10} style={{ color: 'var(--app-primary)' }} className="shrink-0" />
                                <span className="text-[11px] font-bold text-app-foreground flex-1 truncate">{brand}</span>
                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                    {prods.length}
                                </span>
                            </div>
                        ))}
                    </div>
                    {byBrand.length > 8 && (
                        <p className="text-[9px] font-bold text-app-muted-foreground text-center">+{byBrand.length - 8} more brands</p>
                    )}
                </div>
            )}

            {/* Remove action */}
            <div className="flex justify-end mt-3 pt-3 border-t" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                <button onClick={onRemove} disabled={isPending}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
                    style={{ background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', color: 'var(--app-error)', border: '1px solid color-mix(in srgb, var(--app-error) 18%, transparent)' }}>
                    <Trash2 size={11} /> Remove
                </button>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
 *  REGION PILL
 * ═══════════════════════════════════════════════════════════════════ */
function RegionPill({ label, active, onClick, color }: {
    label: string; active: boolean; onClick: () => void; color: string
}) {
    return (
        <button onClick={onClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide whitespace-nowrap transition-all"
            style={{
                background: active ? color : 'var(--app-background)',
                color: active ? 'white' : color,
                border: `1px solid ${active ? color : 'var(--app-border)'}`,
            }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: active ? 'white' : color }} />
            {label}
        </button>
    )
}

/* ═══════════════════════════════════════════════════════════════════
 *  PICKER MODAL
 * ═══════════════════════════════════════════════════════════════════ */
function Picker({ allCountries, sourcedIds, onClose, onAdded }: {
    allCountries: RefCountry[]; sourcedIds: Set<number>;
    onClose: () => void; onAdded: () => void;
}) {
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [isPending, startTransition] = useTransition()
    const [activeRegion, setActiveRegion] = useState<string | null>(null)

    const available = useMemo(() => {
        let list = allCountries.filter(c => !sourcedIds.has(c.id) && !HIDDEN_ISO2.has(c.iso2))
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(c => c.name.toLowerCase().includes(q) || c.iso2.toLowerCase().includes(q) || (c.region || '').toLowerCase().includes(q))
        }
        if (activeRegion) list = list.filter(c => c.region === activeRegion)
        return list.sort((a, b) => a.name.localeCompare(b.name))
    }, [allCountries, sourcedIds, search, activeRegion])

    const regionList = useMemo(() => {
        const m: Record<string, number> = {}
        allCountries.filter(c => !sourcedIds.has(c.id) && !HIDDEN_ISO2.has(c.iso2)).forEach(c => {
            const r = c.region || 'Other'; m[r] = (m[r] || 0) + 1
        })
        return Object.entries(m).sort(([a], [b]) => a.localeCompare(b))
    }, [allCountries, sourcedIds])

    const toggle = (id: number) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

    const handleAdd = () => {
        if (selected.size === 0) return
        startTransition(async () => {
            const res = await bulkEnableSourcingCountries(Array.from(selected))
            if (res.success) { toast.success(`${selected.size} ${selected.size === 1 ? 'country' : 'countries'} added`); onAdded(); onClose() }
            else toast.error(res.error || 'Failed to add')
        })
    }

    return (
        <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div onClick={e => e.stopPropagation()}
                className="w-full max-w-[900px] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl border-2 animate-in fade-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b"
                    style={{ background: 'var(--app-background)', borderColor: 'var(--app-border)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, black))' }}>
                            <Globe size={18} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-black text-app-foreground">Add Sourcing Countries</h3>
                            <div className="flex items-center gap-2.5 mt-0.5">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-app-muted-foreground">{available.length} available</span>
                                {selected.size > 0 && (
                                    <span className="flex items-center gap-1 text-[10px] font-black text-white px-2 py-0.5 rounded-full"
                                        style={{ background: 'var(--app-primary)' }}>
                                        <Check size={10} strokeWidth={3} />{selected.size} selected
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center border text-app-muted-foreground hover:text-app-foreground transition-colors"
                        style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Search */}
                <div className="px-6 py-3 border-b" style={{ background: 'var(--app-background)', borderColor: 'var(--app-border)' }}>
                    <div className="relative">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input type="text" placeholder="Search countries…" value={search} onChange={e => setSearch(e.target.value)} autoFocus
                            className="w-full text-[12px] font-medium pl-10 pr-8 py-2.5 rounded-xl border outline-none"
                            style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-foreground)' }} />
                        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted-foreground"><X size={12} /></button>}
                    </div>
                </div>

                {/* Region tabs */}
                {regionList.length > 1 && (
                    <div className="flex gap-1.5 px-6 py-2 overflow-x-auto border-b" style={{ borderColor: 'var(--app-border)' }}>
                        <RegionPill label="All" active={!activeRegion} onClick={() => setActiveRegion(null)} color="var(--app-primary)" />
                        {regionList.map(([r, n]) => (
                            <RegionPill key={r} label={`${r} (${n})`} active={activeRegion === r}
                                onClick={() => setActiveRegion(activeRegion === r ? null : r)} color={rc(r)} />
                        ))}
                    </div>
                )}

                {/* Grid */}
                <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[200px] custom-scrollbar">
                    {available.length === 0 ? (
                        <div className="text-center py-16">
                            <Globe size={28} className="mx-auto mb-3 text-app-muted-foreground opacity-30" />
                            <p className="text-sm font-bold text-app-foreground">{search ? 'No matching countries' : 'All countries added'}</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1">{search ? 'Try a different search' : 'You\'ve sourced from every country!'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {available.map(c => {
                                const sel = selected.has(c.id)
                                return (
                                    <button key={c.id} onClick={() => toggle(c.id)}
                                        className="text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                                        style={{
                                            background: sel ? 'var(--app-primary)' : 'var(--app-surface)',
                                            border: `2px solid ${sel ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-border) 60%, transparent)'}`,
                                            boxShadow: sel ? '0 4px 12px color-mix(in srgb, var(--app-primary) 20%, transparent)' : 'none',
                                        }}>
                                        <FlagImg iso2={c.iso2} size={24} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-bold truncate" style={{ color: sel ? 'white' : 'var(--app-foreground)' }}>{c.name}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[9px] font-bold" style={{ color: sel ? 'rgba(255,255,255,0.7)' : 'var(--app-muted-foreground)' }}>{c.iso2}</span>
                                                {c.default_currency_code && (
                                                    <>
                                                        <div className="w-1 h-1 rounded-full" style={{ background: sel ? 'rgba(255,255,255,0.5)' : 'var(--app-muted-foreground)' }} />
                                                        <span className="text-[9px] font-bold" style={{ color: sel ? 'rgba(255,255,255,0.8)' : 'var(--app-muted-foreground)' }}>{c.default_currency_code}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all"
                                            style={{
                                                background: sel ? 'white' : 'transparent',
                                                border: sel ? 'none' : '2px solid var(--app-border)',
                                            }}>
                                            {sel && <Check size={12} style={{ color: 'var(--app-primary)' }} strokeWidth={3} />}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-3.5 border-t"
                    style={{ background: 'var(--app-background)', borderColor: 'var(--app-border)' }}>
                    <div className="flex items-center gap-3">
                        {selected.size > 0 ? (
                            <>
                                <span className="text-[11px] font-black text-app-foreground">{selected.size} {selected.size === 1 ? 'country' : 'countries'}</span>
                                <button onClick={() => setSelected(new Set())} className="text-[10px] font-bold uppercase text-app-muted-foreground hover:text-app-foreground bg-transparent border-none cursor-pointer">Clear</button>
                            </>
                        ) : (
                            <span className="text-[11px] font-bold text-app-muted-foreground">Select countries to add</span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[12px] font-bold border transition-all"
                            style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                            Cancel
                        </button>
                        <button onClick={handleAdd} disabled={selected.size === 0 || isPending}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-black text-white border-none transition-all disabled:opacity-40"
                            style={{
                                background: selected.size > 0 ? 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 60%, black))' : 'var(--app-border)',
                                cursor: selected.size === 0 || isPending ? 'not-allowed' : 'pointer',
                            }}>
                            {isPending ? <><Loader2 size={14} className="animate-spin" /> Adding…</>
                                : <><Plus size={14} strokeWidth={2.5} /> Add {selected.size > 0 ? `${selected.size} ` : ''}{selected.size === 1 ? 'Country' : 'Countries'}</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
