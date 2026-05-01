'use client'

/**
 * Stock Cross-Analysis Matrix
 * ============================
 * Multi-dimensional stock analysis — compare similar products across
 * countries, brands, parfums (variants), and sizes.
 *
 * Follows the Categories / COA viewer design language exactly.
 *
 * View 1: By Product  → ProductGroup > Parfum > Country × Size
 * View 2: By Country  → Country > ProductGroup > Parfum > Products
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
    Globe, Package, ChevronRight, ChevronDown, Search,
    Filter, BarChart3, Layers, Droplets, MapPin, Box,
    RefreshCcw, X, Maximize2, Minimize2,
    ChevronsUpDown, ChevronsDownUp, Loader2,
    Tag, Hash, DollarSign, Building2, Tags,
    TrendingUp, TrendingDown, Minus, Calendar
} from 'lucide-react'
import {
    getStockMatrixByCountry,
    getStockMatrixByProduct,
    getStockMatrixFilters,
    getProductSalesPeriods,
    type MatrixCountry,
    type MatrixGroup,
    type MatrixBrandGroup,
    type MatrixVariant,
    type MatrixFilters,
    type MatrixParfum,
    type MatrixCountrySize,
    type MatrixProduct,
    type SalesPeriodsResponse,
} from '@/app/actions/inventory/stock-matrix'

/* ═══════════════════════════════════════════════════════════
 *  DIMENSION COLORS
 * ═══════════════════════════════════════════════════════════ */
const DIM_COLORS = {
    country: 'var(--app-primary)',
    group: 'var(--app-info, #3b82f6)',
    parfum: 'var(--app-accent)',
    product: 'var(--app-success, #22c55e)',
    stock: 'var(--app-warning, #f59e0b)',
}

/* ═══════════════════════════════════════════════════════════
 *  TREND BADGE
 * ═══════════════════════════════════════════════════════════ */
function TrendBadge({ trend }: { trend?: 'UP' | 'DOWN' | 'STABLE' }) {
    if (!trend || trend === 'STABLE') {
        return (
            <div className="w-16 flex items-center justify-center flex-shrink-0">
                <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ color: 'var(--app-muted-foreground)', background: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                    <Minus size={10} /> Stable
                </span>
            </div>
        )
    }
    if (trend === 'UP') {
        return (
            <div className="w-16 flex items-center justify-center flex-shrink-0">
                <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ color: 'var(--app-success, #22c55e)', background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)' }}>
                    <TrendingUp size={10} /> Up
                </span>
            </div>
        )
    }
    return (
        <div className="w-16 flex items-center justify-center flex-shrink-0">
            <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ color: 'var(--app-error, #ef4444)', background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)' }}>
                <TrendingDown size={10} /> Down
            </span>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  SALES PERIODS POPOVER
 * ═══════════════════════════════════════════════════════════ */
function SalesPeriodsPopover({ productId, periodDays }: { productId: number; periodDays: number }) {
    const [isOpen, setIsOpen] = useState(false)
    const [data, setData] = useState<SalesPeriodsResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const popoverRef = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [isOpen])

    const handleOpen = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (isOpen) { setIsOpen(false); return }
        setIsOpen(true)
        if (!data) {
            setLoading(true)
            const result = await getProductSalesPeriods(productId, periodDays)
            setData(result)
            setLoading(false)
        }
    }

    return (
        <div className="relative w-20 flex-shrink-0" ref={popoverRef}>
            <button
                onClick={handleOpen}
                className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded transition-all"
                style={{
                    color: isOpen ? 'var(--app-primary)' : 'var(--app-info, #3b82f6)',
                    background: isOpen
                        ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                        : 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                    border: isOpen ? '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' : '1px solid transparent',
                }}
            >
                <Calendar size={10} />
                View Sales
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 top-full mt-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                    style={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                        minWidth: '220px',
                        maxHeight: '360px',
                        overflow: 'hidden',
                    }}
                >
                    {/* Header */}
                    <div className="px-3 py-2 border-b border-app-border/50"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 5%, var(--app-surface))' }}>
                        <div className="text-[11px] font-black text-app-foreground">Sales Periods</div>
                        {data && (
                            <div className="text-[9px] font-bold text-app-muted-foreground mt-0.5">
                                {data.period_days}-day windows · Last {data.lookback_days} days
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="overflow-y-auto max-h-[260px] custom-scrollbar">
                        {loading ? (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 size={16} className="animate-spin text-app-primary" />
                            </div>
                        ) : data && data.periods.length > 0 ? (
                            <div className="py-1">
                                {data.periods.map((p, i) => {
                                    const maxQty = Math.max(...data.periods.map(pp => pp.qty_sold), 1)
                                    const barWidth = (p.qty_sold / maxQty) * 100

                                    return (
                                        <div key={i}
                                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-app-surface/80 transition-all"
                                        >
                                            {/* Period number */}
                                            <span className="text-[10px] font-mono font-bold text-app-muted-foreground w-4 text-right flex-shrink-0">
                                                {p.period_num}
                                            </span>

                                            {/* Bar */}
                                            <div className="flex-1 h-4 rounded-md overflow-hidden"
                                                style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                                <div
                                                    className="h-full rounded-md transition-all duration-300"
                                                    style={{
                                                        width: `${barWidth}%`,
                                                        background: p.qty_sold > 0
                                                            ? 'linear-gradient(90deg, color-mix(in srgb, var(--app-primary) 60%, transparent), var(--app-primary))'
                                                            : 'transparent',
                                                        minWidth: p.qty_sold > 0 ? '4px' : '0',
                                                    }}
                                                />
                                            </div>

                                            {/* Qty */}
                                            <span className="text-[11px] font-mono font-black tabular-nums w-8 text-right flex-shrink-0"
                                                style={{ color: p.qty_sold > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                                {Math.round(p.qty_sold)}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="py-4 text-center text-[10px] text-app-muted-foreground font-bold">
                                No sales data
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {data && (
                        <div className="px-3 py-2 border-t border-app-border/50"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))' }}>
                            <div className="flex items-center justify-between text-[10px] font-bold">
                                <span className="text-app-muted-foreground">Avg. Daily Sales:</span>
                                <span className="font-mono font-black text-app-foreground tabular-nums">
                                    {data.avg_daily_sales.toFixed(3)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-bold mt-0.5">
                                <span className="text-app-muted-foreground">Needed Quantity:</span>
                                <span className="font-mono font-black tabular-nums"
                                    style={{ color: data.needed_qty > 0 ? 'var(--app-warning, #f59e0b)' : 'var(--app-success, #22c55e)' }}>
                                    {data.needed_qty.toFixed(3)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
function ProductGroupRow({
    group, level, forceExpanded, searchQuery, periodDays,
}: {
    group: MatrixGroup & { total_stock: number; product_count: number }
    level: number
    forceExpanded?: boolean
    searchQuery: string
    periodDays: number
}) {
    const [isOpen, setIsOpen] = useState(forceExpanded ?? false)
    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    useEffect(() => { if (forceExpanded !== undefined) setIsOpen(forceExpanded) }, [forceExpanded])

    const hasChildren = group.parfums && group.parfums.length > 0

    return (
        <div>
            {/* ── GROUP ROW ── */}
            <div
                className={`
                    group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer
                    border-b border-app-border/30
                    hover:bg-app-surface py-2.5 md:py-3
                `}
                style={{
                    paddingLeft: '12px',
                    paddingRight: '12px',
                    background: 'color-mix(in srgb, var(--app-info, #3b82f6) 4%, var(--app-surface))',
                    borderLeft: `3px solid var(--app-info, #3b82f6)`,
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
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: DIM_COLORS.group }} />
                    )}
                </button>

                {/* Icon */}
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)',
                        color: 'var(--app-info, #3b82f6)',
                    }}
                >
                    <Package size={14} />
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                    <span className="truncate text-[13px] font-bold text-app-foreground">
                        {group.group_name}
                    </span>
                    {group.brand_name && (
                        <span className="hidden md:inline text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider bg-app-border/30 px-1.5 py-0.5 rounded flex-shrink-0">
                            {group.brand_name}
                        </span>
                    )}
                </div>

                {/* Parfums count */}
                <div className="hidden sm:flex w-20 flex-shrink-0">
                    <span className="text-[10px] font-bold text-app-muted-foreground">
                        {group.parfums.length} variant{group.parfums.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Products count */}
                <div className="hidden sm:flex w-20 flex-shrink-0">
                    <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                        style={{
                            color: 'var(--app-success, #22c55e)',
                            background: 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)',
                        }}
                    >
                        <Box size={10} />
                        {group.product_count}
                    </span>
                </div>

                {/* Stock */}
                <div className="w-28 text-right font-mono text-[12px] font-bold flex-shrink-0 tabular-nums"
                    style={{ color: group.total_stock > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}
                >
                    {Math.round(group.total_stock).toLocaleString()}
                </div>
            </div>

            {/* ── PARFUM CHILDREN ── */}
            {hasChildren && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {group.parfums.map((parfum, pi) => (
                        <ParfumRow
                            key={`p${pi}`}
                            parfum={parfum}
                            level={1}
                            forceExpanded={forceExpanded}
                            searchQuery={searchQuery}
                            mode="product"
                            periodDays={periodDays}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function ParfumRow({
    parfum, level, forceExpanded, searchQuery, mode, periodDays,
}: {
    parfum: MatrixParfum
    level: number
    forceExpanded?: boolean
    searchQuery: string
    mode: 'product' | 'country'
    periodDays: number
}) {
    const [isOpen, setIsOpen] = useState(forceExpanded ?? false)
    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    useEffect(() => { if (forceExpanded !== undefined) setIsOpen(forceExpanded) }, [forceExpanded])

    const hasChildren = mode === 'product'
        ? (parfum.country_sizes && parfum.country_sizes.length > 0)
        : (parfum.products && parfum.products.length > 0)

    return (
        <div>
            <div
                className={`
                    group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer
                    border-b border-app-border/30
                    hover:bg-app-surface/40 py-1.5 md:py-2
                `}
                style={{
                    paddingLeft: `${12 + level * 20}px`,
                    paddingRight: '12px',
                    borderLeft: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    marginLeft: `${12 + (level - 1) * 20 + 10}px`,
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
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: DIM_COLORS.parfum }} />
                    )}
                </button>

                {/* Icon */}
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--app-accent) 12%, transparent)',
                        color: 'var(--app-accent)',
                    }}
                >
                    <Droplets size={14} />
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-app-foreground">
                        {parfum.parfum_name}
                    </span>
                </div>

                {/* Stock */}
                <div className="w-28 text-right font-mono text-[12px] font-bold flex-shrink-0 tabular-nums"
                    style={{ color: parfum.total_stock > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}
                >
                    {Math.round(parfum.total_stock).toLocaleString()}
                </div>
            </div>

            {/* Children */}
            {hasChildren && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {mode === 'product' && (parfum.country_sizes || []).map((cs, ci) => (
                        <CountrySizeLeaf key={`cs${ci}`} cs={cs} level={level + 1} periodDays={periodDays} />
                    ))}
                    {mode === 'country' && (parfum.products || []).map((prod, pri) => (
                        <ProductLeaf key={`pr${pri}`} product={prod} level={level + 1} periodDays={periodDays} />
                    ))}
                </div>
            )}
        </div>
    )
}

function CountrySizeLeaf({ cs, level, periodDays }: { cs: MatrixCountrySize; level: number; periodDays: number }) {
    return (
        <div
            className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-default border-b border-app-border/30 hover:bg-app-surface/40 py-1.5 md:py-2"
            style={{
                paddingLeft: `${12 + level * 20}px`,
                paddingRight: '12px',
                borderLeft: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                marginLeft: `${12 + (level - 1) * 20 + 10}px`,
            }}
        >
            <div className="w-5 flex-shrink-0 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: DIM_COLORS.stock }} />
            </div>

            {/* Icon */}
            <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                    background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                    color: 'var(--app-warning, #f59e0b)',
                }}
            >
                <MapPin size={13} />
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                {cs.size_label && (
                    <span
                        className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-background) 60%, transparent)',
                            color: 'var(--app-foreground)',
                        }}
                    >
                        {cs.size_label}
                    </span>
                )}
                <span className="text-[12px] font-medium text-app-foreground">
                    {cs.country_name}
                </span>
            </div>

            {/* Cost */}
            <div className="hidden lg:flex w-24 flex-shrink-0">
                <span className="text-[10px] font-bold text-app-muted-foreground flex items-center gap-1">
                    <DollarSign size={9} />
                    {cs.cost_price.toFixed(2)}
                </span>
            </div>

            {/* Sell */}
            <div className="hidden lg:flex w-24 flex-shrink-0">
                <span
                    className="text-[10px] font-bold flex items-center gap-1"
                    style={{ color: 'var(--app-success, #22c55e)' }}
                >
                    <Tag size={9} />
                    {cs.selling_price.toFixed(2)}
                </span>
            </div>

            {/* Trend */}
            <div className="hidden md:flex">
                <TrendBadge trend={cs.product?.trend} />
            </div>

            {/* Sales Periods */}
            <div className="hidden md:flex">
                {cs.product && <SalesPeriodsPopover productId={cs.product.id} periodDays={periodDays} />}
            </div>

            {/* Available */}
            <div className="hidden sm:flex w-24 flex-shrink-0">
                <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={{
                        color: cs.available > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)',
                        background: cs.available > 0
                            ? 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)'
                            : 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)',
                    }}
                >
                    Avail: {Math.round(cs.available)}
                </span>
            </div>

            {/* Stock */}
            <div
                className="w-28 text-right font-mono text-[12px] font-bold flex-shrink-0 tabular-nums"
                style={{ color: cs.stock > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}
            >
                {Math.round(cs.stock).toLocaleString()}
            </div>
        </div>
    )
}

function ProductLeaf({ product, level, periodDays }: { product: MatrixProduct; level: number; periodDays: number }) {
    return (
        <div
            className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-default border-b border-app-border/30 hover:bg-app-surface/40 py-1.5 md:py-2"
            style={{
                paddingLeft: `${12 + level * 20}px`,
                paddingRight: '12px',
                borderLeft: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                marginLeft: `${12 + (level - 1) * 20 + 10}px`,
            }}
        >
            <div className="w-5 flex-shrink-0 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: DIM_COLORS.product }} />
            </div>

            <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                    background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                    color: 'var(--app-muted-foreground)',
                }}
            >
                <Box size={13} />
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                <span className="truncate text-[12px] font-medium text-app-foreground">{product.name}</span>
                {product.size_label && (
                    <span
                        className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                            color: 'var(--app-info, #3b82f6)',
                        }}
                    >
                        {product.size_label}
                    </span>
                )}
                <span className="hidden md:inline text-[10px] font-mono text-app-muted-foreground">
                    {product.sku}
                </span>
            </div>

            {/* Trend */}
            <div className="hidden md:flex">
                <TrendBadge trend={product.trend} />
            </div>

            {/* Sales Periods */}
            <div className="hidden md:flex">
                <SalesPeriodsPopover productId={product.id} periodDays={periodDays} />
            </div>

            {/* Available */}
            <div className="hidden sm:flex w-24 flex-shrink-0">
                <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={{
                        color: product.stock.available > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)',
                        background: product.stock.available > 0
                            ? 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)'
                            : 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)',
                    }}
                >
                    Avail: {Math.round(product.stock.available)}
                </span>
            </div>

            <div className="w-28 text-right font-mono text-[12px] font-bold flex-shrink-0 tabular-nums"
                style={{ color: product.stock.on_hand > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}
            >
                {Math.round(product.stock.on_hand).toLocaleString()}
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  COUNTRY VIEW — TREE ROW
 * ═══════════════════════════════════════════════════════════ */
function CountryGroupRow({
    country, forceExpanded, searchQuery, periodDays,
}: {
    country: MatrixCountry
    forceExpanded?: boolean
    searchQuery: string
    periodDays: number
}) {
    const [isOpen, setIsOpen] = useState(forceExpanded ?? false)
    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    useEffect(() => { if (forceExpanded !== undefined) setIsOpen(forceExpanded) }, [forceExpanded])

    const hasChildren = country.brands && country.brands.length > 0

    return (
        <div>
            <div
                className={`
                    group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer
                    border-b border-app-border/30 hover:bg-app-surface py-2.5 md:py-3
                `}
                style={{
                    paddingLeft: '12px',
                    paddingRight: '12px',
                    background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))',
                    borderLeft: '3px solid var(--app-primary)',
                }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <button className={`w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0 ${hasChildren ? 'hover:bg-app-border/50 text-app-muted-foreground' : 'text-app-border'}`}>
                    {hasChildren ? (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <div className="w-1.5 h-1.5 rounded-full" style={{ background: DIM_COLORS.country }} />}
                </button>

                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                    <Globe size={14} />
                </div>

                <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                    <span className="truncate text-[13px] font-bold text-app-foreground">{country.country_name || 'Unknown Origin'}</span>
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                        {country.country_code || 'N/A'}
                    </span>
                </div>

                <div className="hidden sm:flex w-20 flex-shrink-0">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                        style={{ color: 'var(--app-success, #22c55e)', background: 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)' }}>
                        <Box size={10} />
                        {country.product_count}
                    </span>
                </div>

                <div className="w-28 text-right font-mono text-[12px] font-bold flex-shrink-0 tabular-nums"
                    style={{ color: country.total_stock > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                    {Math.round(country.total_stock).toLocaleString()}
                </div>
            </div>

            {isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {hasChildren ? country.brands.map((brand, bi) => (
                        <CountryBrandRow key={`b${bi}`} brand={brand} level={1} forceExpanded={forceExpanded} searchQuery={searchQuery} periodDays={periodDays} />
                    )) : (
                        <div className="py-3 text-center text-[10px] font-bold text-app-muted-foreground italic" style={{ paddingLeft: '44px' }}>
                            No products in this country
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function CountryBrandRow({
    brand, level, forceExpanded, searchQuery, periodDays,
}: {
    brand: MatrixBrandGroup; level: number; forceExpanded?: boolean; searchQuery: string; periodDays: number
}) {
    const [isOpen, setIsOpen] = useState(forceExpanded ?? false)
    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    useEffect(() => { if (forceExpanded !== undefined) setIsOpen(forceExpanded) }, [forceExpanded])

    const hasChildren = brand.variants && brand.variants.length > 0

    return (
        <div>
            <div
                className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-1.5 md:py-2"
                style={{
                    paddingLeft: `${12 + level * 20}px`, paddingRight: '12px',
                    borderLeft: '1px solid color-mix(in srgb, var(--app-accent) 25%, transparent)',
                    marginLeft: `${12 + (level - 1) * 20 + 10}px`,
                }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <button className={`w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0 ${hasChildren ? 'hover:bg-app-border/50 text-app-muted-foreground' : 'text-app-border'}`}>
                    {hasChildren ? (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-accent)' }} />}
                </button>

                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-accent) 10%, transparent)', color: 'var(--app-accent)' }}>
                    <Building2 size={14} />
                </div>

                <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                    <span className="truncate text-[13px] font-medium text-app-foreground">{brand.brand_name}</span>
                    <span className="text-[10px] font-bold text-app-muted-foreground">
                        {brand.product_count} product{brand.product_count !== 1 ? 's' : ''}
                    </span>
                </div>

                <div className="w-28 text-right font-mono text-[12px] font-bold flex-shrink-0 tabular-nums"
                    style={{ color: brand.total_stock > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                    {Math.round(brand.total_stock).toLocaleString()}
                </div>
            </div>

            {isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {hasChildren ? brand.variants.map((variant, vi) => (
                        <CountryVariantRow key={`v${vi}`} variant={variant} level={level + 1} forceExpanded={forceExpanded} searchQuery={searchQuery} periodDays={periodDays} />
                    )) : (
                        <div className="py-2 text-center text-[10px] font-bold text-app-muted-foreground italic" style={{ paddingLeft: `${12 + (level+1) * 20}px` }}>
                            No variants
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function CountryVariantRow({
    variant, level, forceExpanded, searchQuery, periodDays,
}: {
    variant: MatrixVariant; level: number; forceExpanded?: boolean; searchQuery: string; periodDays: number
}) {
    const [isOpen, setIsOpen] = useState(forceExpanded ?? false)
    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    useEffect(() => { if (forceExpanded !== undefined) setIsOpen(forceExpanded) }, [forceExpanded])

    const hasProducts = variant.products && variant.products.length > 0

    return (
        <div>
            <div
                className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-1.5 md:py-2"
                style={{
                    paddingLeft: `${12 + level * 20}px`, paddingRight: '12px',
                    borderLeft: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 25%, transparent)',
                    marginLeft: `${12 + (level - 1) * 20 + 10}px`,
                }}
                onClick={() => hasProducts && setIsOpen(!isOpen)}
            >
                <button className={`w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0 ${hasProducts ? 'hover:bg-app-border/50 text-app-muted-foreground' : 'text-app-border'}`}>
                    {hasProducts ? (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-info, #3b82f6)' }} />}
                </button>

                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                    <Tags size={14} />
                </div>

                <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                    <span className="truncate text-[13px] font-medium text-app-foreground">{variant.variant_name}</span>
                    {variant.attr_group_name && (
                        <span className="hidden md:inline text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider bg-app-border/30 px-1.5 py-0.5 rounded flex-shrink-0">
                            {variant.attr_group_name}
                        </span>
                    )}
                    <span className="text-[10px] font-bold text-app-muted-foreground">
                        {variant.product_count} product{variant.product_count !== 1 ? 's' : ''}
                    </span>
                </div>

                <div className="w-28 text-right font-mono text-[12px] font-bold flex-shrink-0 tabular-nums"
                    style={{ color: variant.total_stock > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                    {Math.round(variant.total_stock).toLocaleString()}
                </div>
            </div>

            {hasProducts && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {variant.products.map((prod, pri) => (
                        <ProductLeaf key={`pr${pri}`} product={prod} level={level + 1} periodDays={periodDays} />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  MAIN VIEWER
 * ═══════════════════════════════════════════════════════════ */
export default function StockMatrixPage() {
    const [view, setView] = useState<'product' | 'country'>('product')
    const [countryData, setCountryData] = useState<MatrixCountry[]>([])
    const [productData, setProductData] = useState<(MatrixGroup & { total_stock: number; product_count: number })[]>([])
    const [filters, setFilters] = useState<MatrixFilters | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [focusMode, setFocusMode] = useState(false)
    const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined)
    const [expandKey, setExpandKey] = useState(0)
    const searchRef = useRef<HTMLInputElement>(null)

    // Filter state
    const [selectedBrand, setSelectedBrand] = useState<string>('')
    const [selectedCountry, setSelectedCountry] = useState<string>('')
    const [selectedGroup, setSelectedGroup] = useState<string>('')
    const [selectedParfum, setSelectedParfum] = useState<string>('')
    const [periodDays, setPeriodDays] = useState(7)

    // Keyboard shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const buildParams = useCallback(() => {
        const p: Record<string, any> = {}
        if (selectedBrand) p.brand_ids = [parseInt(selectedBrand)]
        if (selectedCountry) p.origin_country_ids = [parseInt(selectedCountry)]
        if (selectedGroup) p.group_ids = [parseInt(selectedGroup)]
        if (selectedParfum) p.parfum_ids = [parseInt(selectedParfum)]
        if (search.trim()) p.search = search.trim()
        return p
    }, [selectedBrand, selectedCountry, selectedGroup, selectedParfum, search])

    const filtersRef = useRef(filters)
    filtersRef.current = filters

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const params = buildParams()
            const [byCountry, byProduct, filterData] = await Promise.all([
                view === 'country' ? getStockMatrixByCountry(params) : Promise.resolve({ countries: [] }),
                view === 'product' ? getStockMatrixByProduct(params) : Promise.resolve({ product_groups: [] }),
                filtersRef.current ? Promise.resolve(filtersRef.current) : getStockMatrixFilters(),
            ])
            setCountryData(byCountry.countries)
            setProductData(byProduct.product_groups)
            if (!filtersRef.current) setFilters(filterData as MatrixFilters)
        } catch (e) {
            console.error('Failed to fetch matrix data:', e)
        } finally {
            setLoading(false)
        }
    }, [view, buildParams])

    useEffect(() => { fetchData() }, [fetchData])

    // Stats
    const stats = useMemo(() => {
        if (view === 'product') {
            const totalGroups = productData.length
            const totalProducts = productData.reduce((s, g) => s + (g.product_count || 0), 0)
            const totalStock = productData.reduce((s, g) => s + (g.total_stock || 0), 0)
            const totalCountries = new Set(
                productData.flatMap(g => g.parfums.flatMap(p => (p.country_sizes || []).map(cs => cs.country_id)))
            ).size
            return { totalGroups, totalProducts, totalStock, totalCountries }
        } else {
            const totalCountries = countryData.length
            const totalProducts = countryData.reduce((s, c) => s + (c.product_count || 0), 0)
            const totalStock = countryData.reduce((s, c) => s + (c.total_stock || 0), 0)
            const totalGroups = new Set(countryData.flatMap(c => (c.brands || c.groups || []).map((g: any) => g.brand_name || g.group_name))).size
            return { totalGroups, totalProducts, totalStock, totalCountries }
        }
    }, [view, productData, countryData])

    const hasFilters = selectedBrand || selectedCountry || selectedGroup || selectedParfum || search

    return (
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

                {focusMode ? (
                    /* ── FOCUS MODE: Compact bar ── */
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                                <BarChart3 size={14} className="text-white" />
                            </div>
                            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Matrix</span>
                            <span className="text-[10px] font-bold text-app-muted-foreground">{stats.totalProducts} products</span>
                        </div>

                        <div className="flex-1 relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && fetchData()}
                                placeholder="Search..."
                                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all"
                            />
                        </div>

                        <button onClick={() => fetchData()}
                            className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0">
                            <RefreshCcw size={12} />
                        </button>

                        <button onClick={() => setFocusMode(false)} title="Exit focus mode"
                            className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                            <Minimize2 size={13} />
                        </button>
                    </div>
                ) : (
                    /* ── NORMAL MODE: Full header ── */
                    <>
                        {/* Title Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                    <BarChart3 size={20} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
                                        Stock Cross-Analysis Matrix
                                    </h1>
                                    <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                        {stats.totalProducts} Products · {stats.totalCountries} Origins · Multi-Dimensional View
                                    </p>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                {/* View Toggle */}
                                <div className="flex items-center rounded-xl border border-app-border overflow-hidden">
                                    <button
                                        onClick={() => { setView('product'); setExpandAll(undefined); setExpandKey(k => k + 1) }}
                                        className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 transition-all ${view === 'product'
                                            ? 'bg-app-primary text-white'
                                            : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface'
                                            }`}
                                    >
                                        <Package size={13} />
                                        <span className="hidden md:inline">By Product</span>
                                    </button>
                                    <button
                                        onClick={() => { setView('country'); setExpandAll(undefined); setExpandKey(k => k + 1) }}
                                        className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 transition-all ${view === 'country'
                                            ? 'bg-app-primary text-white'
                                            : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface'
                                            }`}
                                    >
                                        <Globe size={13} />
                                        <span className="hidden md:inline">By Country</span>
                                    </button>
                                </div>

                                <button
                                    onClick={() => fetchData()}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                                >
                                    <RefreshCcw size={13} className={loading ? 'animate-spin' : ''} />
                                    <span className="hidden md:inline">Refresh</span>
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
                                { label: 'Countries', value: stats.totalCountries, icon: <Globe size={11} />, color: 'var(--app-primary)' },
                                { label: 'Groups', value: stats.totalGroups, icon: <Layers size={11} />, color: 'var(--app-info, #3b82f6)' },
                                { label: 'Products', value: stats.totalProducts, icon: <Box size={11} />, color: 'var(--app-success, #22c55e)' },
                                { label: 'Total Stock', value: Math.round(stats.totalStock).toLocaleString(), icon: <Package size={11} />, color: 'var(--app-warning, #f59e0b)' },
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

                        {/* Search + Filters */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && fetchData()}
                                    placeholder="Search products, brands, parfums... (Ctrl+K)"
                                    className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                                />
                            </div>

                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl border transition-all flex-shrink-0"
                                style={showFilters ? {
                                    background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                    color: 'var(--app-primary)',
                                    borderColor: 'color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                } : {
                                    background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    color: 'var(--app-muted-foreground)',
                                    borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                                }}
                            >
                                <Filter size={13} />
                                <span className="hidden sm:inline">Filters</span>
                            </button>

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

                            {hasFilters && (
                                <button
                                    onClick={() => { setSearch(''); setSelectedBrand(''); setSelectedCountry(''); setSelectedGroup(''); setSelectedParfum('') }}
                                    className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0"
                                    style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}
                                >
                                    <X size={13} />
                                </button>
                            )}

                            {/* Period Days Selector */}
                            <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                                <Calendar size={12} className="text-app-muted-foreground" />
                                <select
                                    value={periodDays}
                                    onChange={(e) => setPeriodDays(parseInt(e.target.value))}
                                    className="text-[11px] font-bold px-2 py-1.5 rounded-lg border outline-none"
                                    style={{
                                        background: 'var(--app-surface)',
                                        color: 'var(--app-foreground)',
                                        borderColor: 'var(--app-border)',
                                    }}
                                >
                                    <option value={7}>7-day</option>
                                    <option value={14}>14-day</option>
                                    <option value={30}>30-day</option>
                                </select>
                                <span className="text-[9px] font-bold text-app-muted-foreground hidden sm:inline">periods</span>
                            </div>
                        </div>

                        {/* Filter Panel */}
                        {showFilters && filters && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl animate-in slide-in-from-top-2 duration-200"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))',
                                    border: '1px solid var(--app-border)',
                                    borderLeft: '3px solid var(--app-primary)',
                                }}
                            >
                                {[
                                    { label: 'Country of Origin', value: selectedCountry, setter: setSelectedCountry, options: filters.countries },
                                    { label: 'Brand', value: selectedBrand, setter: setSelectedBrand, options: filters.brands },
                                    { label: 'Product Group', value: selectedGroup, setter: setSelectedGroup, options: filters.product_groups },
                                    { label: 'Parfum / Variant', value: selectedParfum, setter: setSelectedParfum, options: filters.parfums },
                                ].map(f => (
                                    <div key={f.label}>
                                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">{f.label}</label>
                                        <select
                                            value={f.value}
                                            onChange={e => f.setter(e.target.value)}
                                            className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-surface border border-app-border/50 rounded-xl text-app-foreground outline-none"
                                        >
                                            <option value="">All</option>
                                            {f.options.map((o: any) => (
                                                <option key={o.id} value={o.id}>{o.name} ({o.count})</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ═══════════════ TREE TABLE ═══════════════ */}
            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                {/* Column Headers */}
                <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                    <div className="w-5 flex-shrink-0" />
                    <div className="w-7 flex-shrink-0" />
                    <div className="flex-1 min-w-0">{view === 'product' ? 'Product Group / Variant' : 'Country / Group / Variant'}</div>
                    {view === 'product' && <div className="hidden sm:block w-20 flex-shrink-0">Variants</div>}
                    <div className="hidden sm:block w-20 flex-shrink-0">Products</div>
                    {view === 'product' && <div className="hidden lg:block w-24 flex-shrink-0">Cost</div>}
                    {view === 'product' && <div className="hidden lg:block w-24 flex-shrink-0">Sell</div>}
                    <div className="hidden md:block w-16 flex-shrink-0 text-center">Trend</div>
                    <div className="hidden md:block w-20 flex-shrink-0 text-center">Sales</div>
                    <div className="hidden sm:block w-24 flex-shrink-0">Available</div>
                    <div className="w-28 text-right flex-shrink-0">On Hand</div>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={24} className="animate-spin text-app-primary" />
                        </div>
                    ) : view === 'product' ? (
                        productData.length > 0 ? (
                            productData.map((group, gi) => (
                                <ProductGroupRow
                                    key={`${gi}-${expandKey}`}
                                    group={group}
                                    level={0}
                                    forceExpanded={expandAll}
                                    searchQuery={search}
                                    periodDays={periodDays}
                                />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                                <Package size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                                <p className="text-sm font-bold text-app-muted-foreground">No products found</p>
                                <p className="text-[11px] text-app-muted-foreground mt-1">
                                    Try adjusting your filters or search query.
                                </p>
                            </div>
                        )
                    ) : (
                        countryData.length > 0 ? (
                            countryData.map((country, ci) => (
                                <CountryGroupRow
                                    key={`${ci}-${expandKey}`}
                                    country={country}
                                    forceExpanded={expandAll}
                                    searchQuery={search}
                                    periodDays={periodDays}
                                />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                                <Globe size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                                <p className="text-sm font-bold text-app-muted-foreground">No country data found</p>
                                <p className="text-[11px] text-app-muted-foreground mt-1">
                                    Try adjusting your filters or search query.
                                </p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    )
}
