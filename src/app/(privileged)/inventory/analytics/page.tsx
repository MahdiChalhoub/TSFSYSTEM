'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import type { ComponentType } from 'react'
import {
    Search, Filter, Package, AlertTriangle, TrendingUp, ShoppingCart,
    Activity, Eye, EyeOff, RefreshCw, ChevronDown, ArrowUpDown,
    Heart, Zap, Clock, XCircle, CheckCircle2, BarChart3,
    FileText, Truck, Box
} from 'lucide-react'

type IconComponent = ComponentType<{ size?: number; className?: string }>
import {
    getProductAnalytics, getWarehouses, getCategories, getBrands,
    type ProductAnalytics, type AnalyticsFilters
} from '@/app/actions/inventory/product-analytics'
import {
    createOperationalRequest, addRequestLine
} from '@/app/actions/inventory/operational-requests'

// ─── TYPES ────────────────────────────────────────────────────────
interface Warehouse { id: number; name: string; code?: string }
interface Category { id: number; name: string }
interface Brand { id: number; name: string }

// ─── HELPERS ──────────────────────────────────────────────────────
function healthColor(score: number) {
    if (score >= 80) return 'from-emerald-500 to-green-400'
    if (score >= 60) return 'from-yellow-500 to-amber-400'
    if (score >= 40) return 'from-orange-500 to-amber-500'
    return 'from-red-500 to-rose-400'
}

function healthBg(score: number) {
    if (score >= 80) return 'bg-app-success-bg text-app-success ring-emerald-200'
    if (score >= 60) return 'bg-app-warning-bg text-app-warning ring-yellow-200'
    if (score >= 40) return 'bg-app-warning-bg text-app-warning ring-orange-200'
    return 'bg-app-error-bg text-app-error ring-red-200'
}

function statusBadge(status: string | null) {
    if (!status) return { label: 'Available', cls: 'bg-app-surface-2 text-app-muted-foreground ring-app-border', icon: CheckCircle2 as IconComponent }
    const map: Record<string, { label: string; cls: string; icon: IconComponent }> = {
        PENDING: { label: 'Requested', cls: 'bg-app-info-bg text-app-info ring-blue-200', icon: Clock },
        APPROVED: { label: 'Approved', cls: 'bg-app-info-bg text-app-info ring-indigo-200', icon: CheckCircle2 },
        CONVERTED: { label: 'Order Created', cls: 'bg-app-success-bg text-app-success ring-emerald-200', icon: FileText },
        REJECTED: { label: 'Failed', cls: 'bg-app-error-bg text-app-error ring-red-200', icon: XCircle },
        CANCELLED: { label: 'Cancelled', cls: 'bg-app-surface-2 text-app-muted-foreground ring-app-border', icon: XCircle },
    }
    return map[status] || { label: status, cls: 'bg-app-surface-2 text-app-muted-foreground ring-app-border', icon: Box as IconComponent }
}

function orderTypeBadge(type: string | null) {
    if (!type) return null
    const map: Record<string, { label: string; cls: string; icon: IconComponent }> = {
        stock_adjustment: { label: 'Adjustment', cls: 'bg-purple-50 text-purple-700', icon: BarChart3 },
        stock_transfer: { label: 'Transfer', cls: 'bg-app-info-soft text-app-info', icon: Truck },
        purchase_order: { label: 'Purchase', cls: 'bg-app-warning-bg text-app-warning', icon: ShoppingCart },
    }
    return map[type] || { label: type, cls: 'bg-app-surface text-app-muted-foreground', icon: FileText as IconComponent }
}

// ─── MAIN PAGE ────────────────────────────────────────────────────
export default function ProductAnalyticsPage() {
    // Data
    const [products, setProducts] = useState<ProductAnalytics[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)

    // Filters
    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('')
    const [selectedBrand, setSelectedBrand] = useState('')
    const [selectedWarehouse, setSelectedWarehouse] = useState('')
    const [selectedStatus, setSelectedStatus] = useState('')
    const [hideCompleted, setHideCompleted] = useState(true)
    const [page, setPage] = useState(0)
    const PAGE_SIZE = 50

    // Reference data
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [brands, setBrands] = useState<Brand[]>([])

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

    // Sort
    const [sortField, setSortField] = useState<string>('name')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

    // Request dialog
    const [showRequestDialog, setShowRequestDialog] = useState(false)
    const [requestType, setRequestType] = useState<'purchase_request' | 'transfer_request'>('purchase_request')
    const [requestProductIds, setRequestProductIds] = useState<number[]>([])
    const [requestLoading, setRequestLoading] = useState(false)

    // ── Load reference data ──
    useEffect(() => {
        Promise.all([getWarehouses(), getCategories(), getBrands()])
            .then(([wh, cat, br]) => {
                setWarehouses(Array.isArray(wh) ? wh : wh?.results || [])
                setCategories(Array.isArray(cat) ? cat : cat?.results || [])
                setBrands(Array.isArray(br) ? br : br?.results || [])
            })
    }, [])

    // ── Load analytics ──
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const filters: AnalyticsFilters = {
                search: search || undefined,
                category: selectedCategory || undefined,
                brand: selectedBrand || undefined,
                warehouse_id: selectedWarehouse || undefined,
                status: selectedStatus || undefined,
                hide_completed: hideCompleted,
                limit: PAGE_SIZE,
                offset: page * PAGE_SIZE,
            }
            const res = await getProductAnalytics(filters)
            setProducts(res.products)
            setTotal(res.total)
        } catch (e) {
            console.error('Failed to load analytics:', e)
        } finally {
            setLoading(false)
        }
    }, [search, selectedCategory, selectedBrand, selectedWarehouse, selectedStatus, hideCompleted, page])

    useEffect(() => { loadData() }, [loadData])

    // Debounced search
    const [searchDebounced, setSearchDebounced] = useState('')
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchDebounced), 300)
        return () => clearTimeout(t)
    }, [searchDebounced])

    // ── KPI calculations ──
    const kpis = useMemo(() => {
        const lowStock = products.filter(p => p.total_stock < p.min_stock_level).length
        const requested = products.filter(p => p.request_status === 'PENDING' || p.request_status === 'APPROVED').length
        const pending = products.filter(p => p.request_status === 'CONVERTED').length
        const failed = products.filter(p => p.request_status === 'REJECTED').length
        const avgHealth = products.length > 0
            ? Math.round(products.reduce((acc, p) => acc + p.health_score, 0) / products.length)
            : 0
        return { total, lowStock, requested, pending, failed, avgHealth }
    }, [products, total])

    // ── Sort ──
    const sorted = useMemo(() => {
        return [...products].sort((a, b) => {
            let av = (a as unknown as Record<string, unknown>)[sortField]
            let bv = (b as unknown as Record<string, unknown>)[sortField]
            if (typeof av === 'string') av = av.toLowerCase()
            if (typeof bv === 'string') bv = bv.toLowerCase()
            if (av == null) return 1
            if (bv == null) return -1
            if ((av as number | string) < (bv as number | string)) return sortDir === 'asc' ? -1 : 1
            if ((av as number | string) > (bv as number | string)) return sortDir === 'asc' ? 1 : -1
            return 0
        })
    }, [products, sortField, sortDir])

    const toggleSort = (field: string) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir('asc')
        }
    }

    // ── Selection helpers ──
    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }
    const toggleSelectAll = () => {
        if (selectedIds.size === products.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(products.map(p => p.id)))
        }
    }

    // ── Request creation ──
    const openRequest = (type: 'purchase_request' | 'transfer_request', ids: number[]) => {
        setRequestType(type)
        setRequestProductIds(ids)
        setShowRequestDialog(true)
    }

    const handleCreateRequest = async () => {
        setRequestLoading(true)
        try {
            const result = await createOperationalRequest({
                request_type: requestType,
                date: new Date().toISOString().split('T')[0],
                priority: 'MEDIUM',
                description: `Analytics batch request for ${requestProductIds.length} product(s)`,
            })
            if (result?.id) {
                for (const pid of requestProductIds) {
                    await addRequestLine(result.id, {
                        product: pid,
                        quantity: 1,
                    })
                }
            }
            setShowRequestDialog(false)
            setSelectedIds(new Set())
            loadData()
        } catch (e) {
            console.error('Failed to create request:', e)
        } finally {
            setRequestLoading(false)
        }
    }

    // ── Pagination ──
    const totalPages = Math.ceil(total / PAGE_SIZE)

    return (
        <div className="space-y-8">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-app-foreground tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-app-primary flex items-center justify-center shadow-lg shadow-violet-500/25">
                            <Activity size={22} className="text-white" />
                        </div>
                        Product Analytics
                    </h1>
                    <p className="text-app-muted-foreground mt-2 text-sm font-medium">
                        Live analytics with request lifecycle tracking — {total.toLocaleString()} products
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => loadData()}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-app-surface border border-app-border text-app-muted-foreground hover:bg-app-surface hover:border-app-border transition-all text-sm font-medium shadow-sm"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { label: 'Total Products', value: kpis.total, icon: Package, gradient: 'from-slate-600 to-slate-700', ring: 'ring-app-border' },
                    { label: 'Low Stock', value: kpis.lowStock, icon: AlertTriangle, gradient: 'from-red-500 to-rose-500', ring: 'ring-red-200' },
                    { label: 'Requested', value: kpis.requested, icon: Clock, gradient: 'from-blue-500 to-indigo-500', ring: 'ring-blue-200' },
                    { label: 'Orders Pending', value: kpis.pending, icon: FileText, gradient: 'from-emerald-500 to-green-500', ring: 'ring-emerald-200' },
                    { label: 'Failed', value: kpis.failed, icon: XCircle, gradient: 'from-orange-500 to-amber-500', ring: 'ring-orange-200' },
                    { label: 'Avg Health', value: `${kpis.avgHealth}%`, icon: Heart, gradient: healthColor(kpis.avgHealth), ring: 'ring-violet-200' },
                ].map((kpi, i) => (
                    <div key={i} className={`bg-app-surface rounded-2xl border border-app-border p-5 shadow-sm hover:shadow-md transition-shadow ring-1 ${kpi.ring}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center shadow-md`}>
                                <kpi.icon size={18} className="text-white" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-app-foreground tracking-tight">{typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}</p>
                        <p className="text-xs text-app-muted-foreground font-medium mt-1">{kpi.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Filters ── */}
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={16} className="text-app-muted-foreground" />
                    <span className="text-sm font-bold text-app-foreground">Filters</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                    {/* Search */}
                    <div className="lg:col-span-2 relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by name, SKU, or barcode..."
                            value={searchDebounced}
                            onChange={e => { setSearchDebounced(e.target.value); setPage(0) }}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-app-border text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all outline-none"
                        />
                    </div>

                    {/* Category */}
                    <select
                        value={selectedCategory}
                        onChange={e => { setSelectedCategory(e.target.value); setPage(0) }}
                        className="px-3 py-2.5 rounded-xl border border-app-border text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all outline-none bg-app-surface"
                    >
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    {/* Brand */}
                    <select
                        value={selectedBrand}
                        onChange={e => { setSelectedBrand(e.target.value); setPage(0) }}
                        className="px-3 py-2.5 rounded-xl border border-app-border text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all outline-none bg-app-surface"
                    >
                        <option value="">All Brands</option>
                        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>

                    {/* Status */}
                    <select
                        value={selectedStatus}
                        onChange={e => { setSelectedStatus(e.target.value); setPage(0) }}
                        className="px-3 py-2.5 rounded-xl border border-app-border text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all outline-none bg-app-surface"
                    >
                        <option value="">All Statuses</option>
                        <option value="AVAILABLE">Available</option>
                        <option value="REQUESTED">Requested</option>
                        <option value="ORDER_CREATED">Order Created</option>
                        <option value="FAILED">Failed</option>
                    </select>

                    {/* Hide completed toggle */}
                    <button
                        onClick={() => { setHideCompleted(!hideCompleted); setPage(0) }}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${hideCompleted
                            ? 'bg-violet-50 border-violet-200 text-violet-700'
                            : 'bg-app-surface border-app-border text-app-muted-foreground hover:bg-app-surface'
                            }`}
                    >
                        {hideCompleted ? <EyeOff size={16} /> : <Eye size={16} />}
                        {hideCompleted ? 'Hiding Done' : 'Show All'}
                    </button>
                </div>
            </div>

            {/* ── Batch Actions ── */}
            {selectedIds.size > 0 && (
                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex items-center justify-between animate-in slide-in-from-top-2">
                    <span className="text-sm font-bold text-violet-800">
                        {selectedIds.size} product{selectedIds.size > 1 ? 's' : ''} selected
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => openRequest('purchase_request', Array.from(selectedIds))}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm"
                        >
                            <ShoppingCart size={16} /> Purchase Request
                        </button>
                        <button
                            onClick={() => openRequest('transfer_request', Array.from(selectedIds))}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-app-info text-white text-sm font-semibold hover:bg-app-info transition-colors shadow-sm"
                        >
                            <Truck size={16} /> Transfer Request
                        </button>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="px-3 py-2 rounded-xl border border-violet-200 text-violet-600 text-sm font-medium hover:bg-violet-100 transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {/* ── Table ── */}
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-app-surface/80 border-b border-app-border">
                                <th className="p-4 text-left">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === products.length && products.length > 0}
                                        onChange={toggleSelectAll}
                                        className="rounded border-app-border text-violet-600 focus:ring-violet-500"
                                    />
                                </th>
                                {[
                                    { key: 'name', label: 'Product' },
                                    { key: 'total_stock', label: 'Stock' },
                                    { key: 'avg_daily_sales', label: 'Daily Sales' },
                                    { key: 'request_status', label: 'Request Status' },
                                    { key: 'order_type', label: 'Order' },
                                    { key: 'health_score', label: 'Health' },
                                    { key: 'actions', label: '' },
                                ].map(col => (
                                    <th
                                        key={col.key}
                                        onClick={() => col.key !== 'actions' && toggleSort(col.key)}
                                        className={`p-4 text-left text-xs font-bold text-app-muted-foreground uppercase tracking-wider ${col.key !== 'actions' ? 'cursor-pointer hover:text-app-foreground select-none' : ''}`}
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.label}
                                            {sortField === col.key && (
                                                <ArrowUpDown size={14} className="text-violet-500" />
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-app-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="p-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
                                            <span className="text-sm text-app-muted-foreground font-medium">Loading analytics...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : sorted.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-16 text-center">
                                        <div className="flex flex-col items-center gap-2 text-app-muted-foreground">
                                            <Package size={40} strokeWidth={1.5} />
                                            <p className="font-semibold text-base">No products found</p>
                                            <p className="text-sm">Try adjusting your filters</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : sorted.map(p => {
                                const sb = statusBadge(p.request_status)
                                const ob = orderTypeBadge(p.order_type)
                                const StatusIcon = sb.icon
                                return (
                                    <tr
                                        key={p.id}
                                        className="hover:bg-app-surface/50 transition-colors group"
                                    >
                                        {/* Select */}
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(p.id)}
                                                onChange={() => toggleSelect(p.id)}
                                                className="rounded border-app-border text-violet-600 focus:ring-violet-500"
                                            />
                                        </td>

                                        {/* Product */}
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-app-foreground">{p.name}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs font-mono text-app-muted-foreground">{p.sku}</span>
                                                    {p.category_name && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-app-surface-2 text-app-muted-foreground font-medium">
                                                            {p.category_name}
                                                        </span>
                                                    )}
                                                    {p.brand_name && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-medium">
                                                            {p.brand_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Stock */}
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className={`font-bold tabular-nums ${p.total_stock <= 0 ? 'text-app-error' :
                                                    p.total_stock < p.min_stock_level ? 'text-app-warning' :
                                                        'text-app-foreground'
                                                    }`}>
                                                    {p.total_stock.toLocaleString()}
                                                </span>
                                                <span className="text-xs text-app-muted-foreground">
                                                    min: {p.min_stock_level}
                                                    {p.stock_days_remaining !== null && (
                                                        <> · {p.stock_days_remaining}d left</>
                                                    )}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Daily Sales */}
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-app-foreground tabular-nums">{p.avg_daily_sales}/d</span>
                                                <span className="text-xs text-app-muted-foreground tabular-nums">{p.avg_monthly_sales} / 30d</span>
                                            </div>
                                        </td>

                                        {/* Request Status */}
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 ${sb.cls}`}>
                                                <StatusIcon size={14} />
                                                {sb.label}
                                            </span>
                                            {p.rejection_reason && (
                                                <div className="mt-1 flex items-center gap-1">
                                                    <span className="text-xs bg-app-error-bg text-app-error px-2 py-0.5 rounded-md font-medium truncate max-w-[160px]" title={p.rejection_reason}>
                                                        {p.rejection_reason}
                                                    </span>
                                                </div>
                                            )}
                                        </td>

                                        {/* Order */}
                                        <td className="p-4">
                                            {ob ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${ob.cls}`}>
                                                        <ob.icon size={12} />
                                                        {ob.label}
                                                    </span>
                                                    {p.order_id && (
                                                        <span className="text-xs text-app-muted-foreground font-mono">#{p.order_id}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-app-faint">—</span>
                                            )}
                                        </td>

                                        {/* Health */}
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-2 bg-app-surface-2 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full bg-gradient-to-r ${healthColor(p.health_score)} transition-all`}
                                                        style={{ width: `${p.health_score}%` }}
                                                    />
                                                </div>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ring-1 ${healthBg(p.health_score)}`}>
                                                    {p.health_score}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="p-4">
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openRequest('purchase_request', [p.id])}
                                                    title="Create Purchase Request"
                                                    className="p-2 rounded-lg hover:bg-violet-50 text-app-muted-foreground hover:text-violet-600 transition-colors"
                                                >
                                                    <ShoppingCart size={16} />
                                                </button>
                                                <button
                                                    onClick={() => openRequest('transfer_request', [p.id])}
                                                    title="Create Transfer Request"
                                                    className="p-2 rounded-lg hover:bg-app-info-soft text-app-muted-foreground hover:text-app-info transition-colors"
                                                >
                                                    <Truck size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* ── Pagination ── */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-app-border bg-app-surface/50">
                        <span className="text-sm text-app-muted-foreground">
                            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setPage(Math.max(0, page - 1))}
                                disabled={page === 0}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-app-border bg-app-surface hover:bg-app-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                                disabled={page >= totalPages - 1}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-app-border bg-app-surface hover:bg-app-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Request Dialog ── */}
            {showRequestDialog && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => !requestLoading && setShowRequestDialog(false)}>
                    <div
                        className="bg-app-surface rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95"
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-black text-app-foreground tracking-tight mb-2">
                            Create {requestType === 'purchase_request' ? 'Purchase' : 'Transfer'} Request
                        </h2>
                        <p className="text-sm text-app-muted-foreground mb-6">
                            This will create an operational request for <strong>{requestProductIds.length}</strong> product{requestProductIds.length > 1 ? 's' : ''}.
                        </p>

                        <div className="bg-app-surface rounded-xl p-4 mb-6">
                            <div className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-2">Products</div>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {requestProductIds.map(id => {
                                    const prod = products.find(p => p.id === id)
                                    return prod ? (
                                        <div key={id} className="flex items-center gap-2 text-sm">
                                            <span className="font-medium text-app-foreground">{prod.name}</span>
                                            <span className="text-xs text-app-muted-foreground font-mono">{prod.sku}</span>
                                        </div>
                                    ) : null
                                })}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowRequestDialog(false)}
                                disabled={requestLoading}
                                className="flex-1 px-4 py-3 rounded-xl border border-app-border text-sm font-semibold text-app-muted-foreground hover:bg-app-surface transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateRequest}
                                disabled={requestLoading}
                                className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-colors shadow-lg disabled:opacity-50 ${requestType === 'purchase_request'
                                    ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/25'
                                    : 'bg-app-info hover:bg-app-info shadow-cyan-500/25'
                                    }`}
                            >
                                {requestLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                        Creating...
                                    </span>
                                ) : (
                                    'Create Request'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
