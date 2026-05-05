'use client'

/**
 * Product Packaging Management
 * =============================
 * Manages packaging levels across all products.
 * COA / Categories design language.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import {
    Package, Search, ArrowRight, Box, Barcode, Plus, X,
    ChevronRight, ChevronDown, Layers, Tag, DollarSign,
    Maximize2, Minimize2, Loader2, ShoppingCart, Truck,
    ExternalLink, RefreshCcw, ChevronsUpDown, ChevronsDownUp
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════ */
interface PackagingLevel {
    id: number
    name?: string
    display_name?: string
    level: number
    ratio: number
    barcode?: string
    unit_name?: string
    is_default_sale?: boolean
    is_default_purchase?: boolean
    effective_selling_price?: number
}

interface ProductWithPackaging {
    id: number
    name: string
    sku?: string
    barcode?: string
    unit_name?: string
    packaging_levels: PackagingLevel[]
}

/* ═══════════════════════════════════════════════════════════
 *  PRODUCT PICKER MODAL
 * ═══════════════════════════════════════════════════════════ */
function ProductPickerModal({ allProducts, onClose, onSelect }: {
    allProducts: any[]
    onClose: () => void
    onSelect: (productId: number) => void
}) {
    const [pickerSearch, setPickerSearch] = useState('')

    const pickerProducts = allProducts.filter(p =>
        !pickerSearch || p.name?.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        p.sku?.toLowerCase().includes(pickerSearch.toLowerCase())
    ).slice(0, 20)

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[70vh] flex flex-col"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            >
                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Package size={15} className="text-white" />
                        </div>
                        <div>
                            <h3>Select Product</h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground">
                                Choose a product to configure packaging
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* Search */}
                <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input
                            value={pickerSearch}
                            onChange={e => setPickerSearch(e.target.value)}
                            placeholder="Search by name or SKU..."
                            autoFocus
                            className="w-full pl-8 pr-3 py-2 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {pickerProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <Box size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">No products found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-app-border/30">
                            {pickerProducts.map((p: any) => (
                                <button
                                    key={p.id}
                                    onClick={() => onSelect(p.id)}
                                    className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-app-surface/50 transition-all group text-left"
                                >
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                        <Box size={13} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[12px] font-bold text-app-foreground truncate">{p.name}</div>
                                        <div className="flex items-center gap-2 text-[10px] text-app-muted-foreground">
                                            {p.sku && <span className="font-mono">{p.sku}</span>}
                                            {p.unit_name && <span>· {p.unit_name}</span>}
                                            {p.packaging_levels?.length > 0 && (
                                                <span className="font-bold" style={{ color: 'var(--app-accent)' }}>
                                                    · {p.packaging_levels.length} pkg
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ExternalLink size={12} className="text-app-muted-foreground opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  PRODUCT ROW (expandable tree-style)
 * ═══════════════════════════════════════════════════════════ */
function ProductPackagingRow({
    product, forceExpanded, searchQuery,
}: {
    product: ProductWithPackaging
    forceExpanded?: boolean
    searchQuery: string
}) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(forceExpanded ?? false)
    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    useEffect(() => { if (forceExpanded !== undefined) setIsOpen(forceExpanded) }, [forceExpanded])

    const hasChildren = product.packaging_levels && product.packaging_levels.length > 0
    const pkgCount = product.packaging_levels?.length || 0

    return (
        <div>
            {/* ── PRODUCT ROW ── */}
            <div
                className={`
                    group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer
                    border-b border-app-border/30
                    hover:bg-app-surface py-2.5 md:py-3
                `}
                style={{
                    paddingLeft: '12px',
                    paddingRight: '12px',
                    background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))',
                    borderLeft: '3px solid var(--app-primary)',
                }}
                onClick={() => hasChildren && setIsOpen(!isOpen)}
            >
                {/* Toggle */}
                <button
                    className={`w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0 ${hasChildren ? 'hover:bg-app-border/50 text-app-muted-foreground' : 'text-app-border'}`}
                >
                    {hasChildren ? (
                        isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />
                    ) : (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-primary)' }} />
                    )}
                </button>

                {/* Icon */}
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                        color: 'var(--app-primary)',
                    }}
                >
                    <Box size={14} />
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                    <span className="truncate text-[13px] font-bold text-app-foreground">{product.name}</span>
                    {product.sku && (
                        <span
                            className="hidden md:inline font-mono text-[11px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{
                                background: 'color-mix(in srgb, var(--app-background) 60%, transparent)',
                                color: 'var(--app-foreground)',
                            }}
                        >
                            {product.sku}
                        </span>
                    )}
                    {product.unit_name && (
                        <span className="hidden md:inline text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider bg-app-border/30 px-1.5 py-0.5 rounded flex-shrink-0">
                            {product.unit_name}
                        </span>
                    )}
                </div>

                {/* Package count */}
                <div className="hidden sm:flex w-24 flex-shrink-0">
                    <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                        style={{
                            color: pkgCount > 0 ? 'var(--app-info, #3b82f6)' : 'var(--app-muted-foreground)',
                            background: pkgCount > 0 ? 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)' : 'transparent',
                        }}
                    >
                        <Package size={10} />
                        {pkgCount} pkg
                    </span>
                </div>

                {/* Navigate */}
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={e => { e.stopPropagation(); router.push(`/inventory/products/${product.id}?tab=packaging`) }}
                        className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-primary transition-colors"
                        title="Edit packaging"
                    >
                        <ExternalLink size={12} />
                    </button>
                </div>
            </div>

            {/* ── PACKAGING LEVELS ── */}
            {hasChildren && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {product.packaging_levels.map((pkg) => (
                        <PackagingLevelRow key={pkg.id} pkg={pkg} level={1} />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  PACKAGING LEVEL ROW (leaf node)
 * ═══════════════════════════════════════════════════════════ */
function PackagingLevelRow({ pkg, level }: { pkg: PackagingLevel; level: number }) {
    const pkgColor = pkg.is_default_sale
        ? 'var(--app-success, #22c55e)'
        : pkg.is_default_purchase
            ? 'var(--app-info, #3b82f6)'
            : 'var(--app-accent)'

    return (
        <div
            className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-default border-b border-app-border/30 hover:bg-app-surface/40 py-1.5 md:py-2"
            style={{
                paddingLeft: `${12 + level * 20}px`,
                paddingRight: '12px',
                borderLeft: `1px solid color-mix(in srgb, var(--app-border) 40%, transparent)`,
                marginLeft: `${12 + (level - 1) * 20 + 10}px`,
            }}
        >
            {/* Dot */}
            <div className="w-5 flex-shrink-0 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: pkgColor }} />
            </div>

            {/* Icon */}
            <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                    background: `color-mix(in srgb, ${pkgColor} 10%, transparent)`,
                    color: pkgColor,
                }}
            >
                <Package size={13} />
            </div>

            {/* Name + Details */}
            <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                <span className="text-[13px] font-medium text-app-foreground">
                    {pkg.name || pkg.display_name || `Level ${pkg.level}`}
                </span>
                <span
                    className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--app-background) 60%, transparent)',
                        color: 'var(--app-foreground)',
                    }}
                >
                    L{pkg.level} · {pkg.ratio}×
                </span>
                {pkg.unit_name && (
                    <span
                        className="hidden md:inline text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                            color: 'var(--app-primary)',
                        }}
                    >
                        {pkg.unit_name}
                    </span>
                )}
                {pkg.is_default_sale && (
                    <span
                        className="hidden sm:inline text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
                            color: 'var(--app-success, #22c55e)',
                            border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)',
                        }}
                    >
                        <span className="flex items-center gap-1"><ShoppingCart size={8} /> Sale Default</span>
                    </span>
                )}
                {pkg.is_default_purchase && (
                    <span
                        className="hidden sm:inline text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)',
                            color: 'var(--app-info, #3b82f6)',
                            border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)',
                        }}
                    >
                        <span className="flex items-center gap-1"><Truck size={8} /> Purchase Default</span>
                    </span>
                )}
            </div>

            {/* Barcode */}
            <div className="hidden lg:flex w-36 items-center gap-1 flex-shrink-0">
                {pkg.barcode && (
                    <span className="text-[10px] font-mono font-bold bg-app-bg/80 text-app-muted-foreground px-1.5 py-0.5 rounded border border-app-border/50 flex items-center gap-1">
                        <Barcode size={9} />
                        {pkg.barcode}
                    </span>
                )}
            </div>

            {/* Price */}
            <div className="w-28 text-right font-mono text-[12px] font-bold flex-shrink-0 tabular-nums"
                style={{ color: pkg.effective_selling_price != null && Number(pkg.effective_selling_price) > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)' }}
            >
                {pkg.effective_selling_price != null
                    ? Number(pkg.effective_selling_price).toLocaleString(undefined, { minimumFractionDigits: 0 })
                    : '—'}
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════ */
export default function PackagingPage() {
    const router = useRouter()
    const [products, setProducts] = useState<ProductWithPackaging[]>([])
    const [allProducts, setAllProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showProductPicker, setShowProductPicker] = useState(false)
    const [focusMode, setFocusMode] = useState(false)
    const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined)
    const [expandKey, setExpandKey] = useState(0)
    const searchRef = useRef<HTMLInputElement>(null)

    // Keyboard shortcut: Cmd+K
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const data = await erpFetch('inventory/products/?page_size=200')
            const productList = Array.isArray(data) ? data : data?.results || []
            setAllProducts(productList)
            const withPackaging = productList.filter((p: any) =>
                p.packaging_levels && p.packaging_levels.length > 0
            )
            setProducts(withPackaging)
        } catch (e) {
            console.error('Failed to load products', e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const { filtered, stats } = useMemo(() => {
        let f = products
        if (search.trim()) {
            const q = search.toLowerCase()
            f = f.filter(p =>
                p.name?.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q) ||
                p.packaging_levels?.some(pkg =>
                    (pkg.name || pkg.display_name || '').toLowerCase().includes(q) ||
                    pkg.barcode?.toLowerCase().includes(q)
                )
            )
        }

        const totalPkgs = f.reduce((sum, p) => sum + (p.packaging_levels?.length || 0), 0)
        const saleDefaults = f.reduce((sum, p) => sum + (p.packaging_levels?.filter(pkg => pkg.is_default_sale)?.length || 0), 0)
        const purchaseDefaults = f.reduce((sum, p) => sum + (p.packaging_levels?.filter(pkg => pkg.is_default_purchase)?.length || 0), 0)

        return {
            filtered: f,
            stats: {
                total: products.length,
                filtered: f.length,
                totalPkgs,
                saleDefaults,
                purchaseDefaults,
            },
        }
    }, [products, search])

    return (
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

                {focusMode ? (
                    /* ── FOCUS MODE ── */
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                                <Package size={14} className="text-white" />
                            </div>
                            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Packaging</span>
                            <span className="text-[10px] font-bold text-app-muted-foreground">{stats.filtered}/{stats.total}</span>
                        </div>

                        <div className="flex-1 relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search..."
                                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all"
                            />
                        </div>

                        <button onClick={() => setShowProductPicker(true)}
                            className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0">
                            <Plus size={12} /><span className="hidden sm:inline">New</span>
                        </button>

                        <button onClick={() => setFocusMode(false)} title="Exit focus mode"
                            className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                            <Minimize2 size={13} />
                        </button>
                    </div>
                ) : (
                    /* ── NORMAL MODE ── */
                    <>
                        {/* Title Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                    <Package size={20} className="text-white" />
                                </div>
                                <div>
                                    <h1>
                                        Product Packaging
                                    </h1>
                                    <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                        {stats.total} Products · Multi-Level Packaging
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                <button
                                    onClick={() => loadData()}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                                >
                                    <RefreshCcw size={13} className={loading ? 'animate-spin' : ''} />
                                    <span className="hidden md:inline">Refresh</span>
                                </button>
                                <button
                                    onClick={() => setShowProductPicker(true)}
                                    className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                                >
                                    <Plus size={14} />
                                    <span className="hidden sm:inline">New Package</span>
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
                                { label: 'Products', value: stats.total, icon: <Box size={11} />, color: 'var(--app-primary)' },
                                { label: 'Packages', value: stats.totalPkgs, icon: <Package size={11} />, color: 'var(--app-info, #3b82f6)' },
                                { label: 'Sale Defaults', value: stats.saleDefaults, icon: <ShoppingCart size={11} />, color: 'var(--app-success, #22c55e)' },
                                { label: 'Purchase Defaults', value: stats.purchaseDefaults, icon: <Truck size={11} />, color: 'var(--app-accent)' },
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

                        {/* Search Bar */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search products or packages... (Ctrl+K)"
                                    className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                                />
                            </div>

                            <button
                                onClick={() => { setExpandAll(prev => !prev); setExpandKey(k => k + 1) }}
                                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-2 rounded-xl border transition-all flex-shrink-0"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)',
                                    color: 'var(--app-primary)',
                                    borderColor: 'color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                }}
                            >
                                {expandAll ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
                                <span className="hidden sm:inline">{expandAll ? 'Collapse' : 'Expand'}</span>
                            </button>

                            {search && (
                                <button onClick={() => setSearch('')}
                                    className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0"
                                    style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}>
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ═══════════════ MODALS ═══════════════ */}
            {showProductPicker && (
                <ProductPickerModal
                    allProducts={allProducts}
                    onClose={() => setShowProductPicker(false)}
                    onSelect={(id) => {
                        setShowProductPicker(false)
                        router.push(`/inventory/products/${id}?tab=packaging`)
                    }}
                />
            )}

            {/* ═══════════════ TREE TABLE ═══════════════ */}
            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                {/* Column Headers */}
                <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                    <div className="w-5 flex-shrink-0" />
                    <div className="w-7 flex-shrink-0" />
                    <div className="flex-1 min-w-0">Product / Package</div>
                    <div className="hidden sm:block w-24 flex-shrink-0">Packages</div>
                    <div className="hidden lg:block w-36 flex-shrink-0">Barcode</div>
                    <div className="w-28 text-right flex-shrink-0">Price</div>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={24} className="animate-spin text-app-primary" />
                        </div>
                    ) : filtered.length > 0 ? (
                        filtered.map((product) => (
                            <ProductPackagingRow
                                key={`${product.id}-${expandKey}`}
                                product={product}
                                forceExpanded={expandAll}
                                searchQuery={search}
                            />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <Package size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">
                                {search ? 'No matching packages' : 'No products with packaging yet'}
                            </p>
                            <p className="text-[11px] text-app-muted-foreground mt-1">
                                Click &ldquo;New Package&rdquo; to add packaging levels to a product.
                            </p>
                            {!search && (
                                <button
                                    onClick={() => setShowProductPicker(true)}
                                    className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-3 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                                >
                                    <Plus size={13} /> Add Packaging to a Product
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
