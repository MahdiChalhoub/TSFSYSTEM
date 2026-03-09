// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchPurchaseOrders, fetchPurchaseOrder } from '@/app/actions/pos/purchases'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    ShoppingBag, RefreshCw, ChevronRight, Clock, CheckCircle, XCircle, Package,
    Truck, Calendar, Building2, FileText, ClipboardList, BookOpen, Search,
    ArrowUpDown, Filter, X, Eye, ChevronDown
} from 'lucide-react'
import Link from 'next/link'

type PO = {
    id: number
    po_number?: string
    supplier?: { id: number; name: string }
    supplier_name?: string
    supplier_display?: string
    status: string
    order_date: string
    expected_delivery?: string
    total_amount: number
    notes?: string
    priority?: string
    lines?: POLine[]
    created_at?: string
}

type POLine = {
    id: number
    product?: { id: number; name: string; sku?: string }
    product_name?: string
    quantity_ordered: number
    quantity_received?: number
    unit_price: number
    subtotal: number
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
    DRAFT: { label: 'Draft', class: 'bg-app-surface text-gray-600 bg-app-surface dark:text-gray-300' },
    SUBMITTED: { label: 'Pending', class: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
    APPROVED: { label: 'Approved', class: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    REJECTED: { label: 'Rejected', class: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
    ORDERED: { label: 'Ordered', class: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
    SENT: { label: 'Sent', class: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400' },
    CONFIRMED: { label: 'Confirmed', class: 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' },
    IN_TRANSIT: { label: 'In Transit', class: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
    PARTIALLY_RECEIVED: { label: 'Partial', class: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
    RECEIVED: { label: 'Received', class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
    INVOICED: { label: 'Invoiced', class: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
    COMPLETED: { label: 'Complete', class: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    CANCELLED: { label: 'Cancelled', class: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
}

export default function PurchaseOrdersPage() {
    const [orders, setOrders] = useState<PO[]>([])
    const [selected, setSelected] = useState<PO | null>(null)
    const [detail, setDetail] = useState<PO | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [showFilters, setShowFilters] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await fetchPurchaseOrders()
            const raw = Array.isArray(data) ? data : (data?.results ?? [])
            setOrders(raw)
        } catch { setOrders([]) }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    async function openDetail(po: PO) {
        setSelected(po)
        try {
            const d = await fetchPurchaseOrder(po.id)
            setDetail(d)
        } catch { setDetail(po) }
    }

    // Filtered orders
    const filtered = orders.filter(o => {
        if (statusFilter !== 'ALL' && o.status !== statusFilter) return false
        if (search) {
            const q = search.toLowerCase()
            const poNum = (o.po_number || `PO-${o.id}`).toLowerCase()
            const supplier = (o.supplier?.name || o.supplier_name || o.supplier_display || '').toLowerCase()
            if (!poNum.includes(q) && !supplier.includes(q)) return false
        }
        return true
    })

    const totalValue = filtered.reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const pending = filtered.filter(o => ['DRAFT', 'SUBMITTED', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(o.status)).length
    const completed = filtered.filter(o => ['RECEIVED', 'COMPLETED', 'INVOICED'].includes(o.status)).length

    return (
        <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-[1600px] mx-auto space-y-[var(--layout-section-spacing)]">

                {/* ── Header ── */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shadow-sm">
                            <ClipboardList size={24} className="text-blue-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-4xl font-black tracking-tight theme-text">
                                Purchase <span className="text-blue-500">Orders</span>
                            </h1>
                            <p className="text-xs md:text-sm font-medium theme-text-muted mt-0.5 hidden sm:block">
                                Order management & fulfillment tracking
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={load} className="min-h-[44px] md:min-h-[36px]">
                            <RefreshCw size={14} className="mr-1.5" /> Refresh
                        </Button>
                        <Link href="/purchases/new-order">
                            <Button size="sm" className="min-h-[44px] md:min-h-[36px] bg-blue-500 hover:bg-blue-600 text-white">
                                <FileText size={14} className="mr-1.5" /> New PO
                            </Button>
                        </Link>
                    </div>
                </header>

                {/* ── KPI Strip ── */}
                <section className="grid grid-cols-3 gap-3 md:gap-[var(--layout-element-gap)]" aria-label="PO statistics">
                    {[
                        { label: 'Total Value', value: `${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, icon: ShoppingBag, accent: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
                        { label: 'In Progress', value: pending, icon: Clock, accent: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
                        { label: 'Completed', value: completed, icon: CheckCircle, accent: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
                    ].map(s => (
                        <Card key={s.label} className="border shadow-sm">
                            <CardContent className="p-4 md:p-5 flex items-center gap-3 md:gap-4">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                                    <s.icon size={20} className={s.accent} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] md:text-[10px] font-black theme-text-muted uppercase tracking-wider">{s.label}</p>
                                    <p className={`text-lg md:text-2xl font-black ${s.accent} mt-0.5 truncate`}>{s.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </section>

                {/* ── Search & Filters ── */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" />
                        <Input
                            placeholder="Search POs, suppliers..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-10 min-h-[44px] md:min-h-[40px]"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'COMPLETED', 'CANCELLED'].map(s => (
                            <button key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap min-h-[44px] md:min-h-[32px] transition-all border ${statusFilter === s
                                    ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
                                    : 'theme-surface border-transparent theme-text-muted hover:border-app-border dark:hover:border-gray-700'
                                    }`}
                            >
                                {s === 'ALL' ? 'All' : (STATUS_CONFIG[s]?.label || s)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Content: List + Detail ── */}
                <div className="flex flex-col lg:flex-row gap-4 md:gap-[var(--layout-element-gap)]">

                    {/* Orders List */}
                    <div className="w-full lg:w-1/2 xl:w-5/12 flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-[72px] rounded-xl animate-pulse theme-surface" style={{ border: '1px solid var(--theme-border)' }} />
                            ))
                        ) : filtered.length === 0 ? (
                            <Card className="border shadow-sm">
                                <CardContent className="p-12 text-center">
                                    <ShoppingBag size={40} className="mx-auto theme-text-muted mb-3 opacity-30" />
                                    <p className="text-sm font-medium theme-text-muted">No purchase orders found</p>
                                    <Link href="/purchases/new-order" className="text-blue-500 text-sm font-bold mt-2 inline-block hover:underline">Create one →</Link>
                                </CardContent>
                            </Card>
                        ) : filtered.map(po => (
                            <button key={po.id} onClick={() => openDetail(po)}
                                className={`w-full text-left flex items-center gap-3 px-3 md:px-4 py-3 rounded-xl border transition-all shadow-sm min-h-[64px] ${selected?.id === po.id
                                        ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-600'
                                        : 'theme-surface hover:shadow-md'
                                    }`}
                                style={{ borderColor: selected?.id === po.id ? undefined : 'var(--theme-border)' }}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-bold text-sm theme-text">{po.po_number || `PO-${po.id}`}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${STATUS_CONFIG[po.status]?.class || 'bg-app-surface theme-text-muted'}`}>
                                            {STATUS_CONFIG[po.status]?.label || po.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs theme-text-muted truncate">
                                        <span className="flex items-center gap-1"><Building2 size={10} />{po.supplier?.name || po.supplier_name || po.supplier_display || '—'}</span>
                                        <span className="flex items-center gap-1"><Calendar size={10} />{po.order_date || (po.created_at ? new Date(po.created_at).toLocaleDateString('fr-FR') : '—')}</span>
                                    </div>
                                </div>
                                <div className="text-sm font-black theme-text shrink-0">{Number(po.total_amount || 0).toLocaleString()}</div>
                                <ChevronRight size={14} className="theme-text-muted shrink-0 hidden md:block" />
                            </button>
                        ))}
                    </div>

                    {/* Detail Panel */}
                    <div className="w-full lg:w-1/2 xl:w-7/12 lg:sticky lg:top-4 lg:self-start">
                        <Card className="border shadow-sm min-h-[300px]">
                            {!selected ? (
                                <CardContent className="flex flex-col items-center justify-center py-20 theme-text-muted gap-3">
                                    <ShoppingBag size={48} className="opacity-20" />
                                    <p className="text-sm font-medium">Select a purchase order to view details</p>
                                </CardContent>
                            ) : (
                                <>
                                    <CardHeader className="pb-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="min-w-0">
                                                <CardTitle className="text-xl font-black theme-text">{selected.po_number || `PO-${selected.id}`}</CardTitle>
                                                <div className="flex items-center gap-3 text-sm font-bold theme-text-muted mt-1 flex-wrap">
                                                    <span className="flex items-center gap-1.5"><Building2 size={14} /> {selected.supplier?.name || selected.supplier_name || selected.supplier_display}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs theme-text-muted mt-1 flex-wrap">
                                                    <span className="flex items-center gap-1"><Calendar size={10} />Ordered: {selected.order_date || '—'}</span>
                                                    {selected.expected_delivery && <span className="flex items-center gap-1"><Truck size={10} />Expected: {selected.expected_delivery}</span>}
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end gap-2 shrink-0">
                                                <div className="text-2xl font-black theme-text">{Number(selected.total_amount || 0).toLocaleString()}</div>
                                                <div className="flex gap-2 items-center flex-wrap justify-end">
                                                    <Link href={`/purchases/${selected.id}`}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all min-h-[32px] bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
                                                        <Eye size={12} /> Full View
                                                    </Link>
                                                    <Link href={`/finance/ledger?q=${selected.po_number || selected.id}`}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all min-h-[32px] theme-surface hover:opacity-80"
                                                        style={{ border: '1px solid var(--theme-border)' }}>
                                                        <BookOpen size={12} /> Ledger
                                                    </Link>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_CONFIG[selected.status]?.class || ''}`}>
                                                    {STATUS_CONFIG[selected.status]?.label || selected.status}
                                                </span>
                                            </div>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        {selected.notes && (
                                            <div className="flex items-start gap-2 p-4 rounded-xl theme-surface" style={{ border: '1px solid var(--theme-border)' }}>
                                                <FileText size={14} className="theme-text-muted shrink-0 mt-0.5" />
                                                <p className="text-sm font-medium theme-text-muted leading-relaxed">{selected.notes}</p>
                                            </div>
                                        )}

                                        {/* Order Lines */}
                                        {detail?.lines && detail.lines.length > 0 && (
                                            <div>
                                                <h3 className="text-xs font-black theme-text-muted uppercase tracking-wider mb-3">
                                                    Order Lines ({detail.lines.length})
                                                </h3>
                                                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                                                    {detail.lines.map(line => {
                                                        const received = Number(line.quantity_received || 0)
                                                        const ordered = Number(line.quantity_ordered || 0)
                                                        const pct = ordered > 0 ? Math.min((received / ordered) * 100, 100) : 0
                                                        return (
                                                            <div key={line.id} className="rounded-xl p-3 theme-surface" style={{ border: '1px solid var(--theme-border)' }}>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                                                        <Package size={14} className="text-blue-500" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-sm font-bold theme-text truncate">{line.product?.name || line.product_name || '—'}</div>
                                                                        {line.product?.sku && <div className="text-xs theme-text-muted font-mono mt-0.5">{line.product.sku}</div>}
                                                                    </div>
                                                                    <div className="text-right text-sm">
                                                                        <div className="theme-text-muted font-medium">{ordered} × {Number(line.unit_price || 0).toLocaleString()}</div>
                                                                        <div className="font-black theme-text mt-0.5">{Number(line.subtotal || 0).toLocaleString()}</div>
                                                                    </div>
                                                                </div>
                                                                {line.quantity_received != null && (
                                                                    <div className="mt-2">
                                                                        <div className="flex justify-between text-[10px] font-bold theme-text-muted mb-1 uppercase tracking-wider">
                                                                            <span>Received: {received} / {ordered}</span>
                                                                            <span>{pct.toFixed(0)}%</span>
                                                                        </div>
                                                                        <div className="h-1.5 rounded-full overflow-hidden bg-app-surface bg-app-surface">
                                                                            <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-gray-200'}`} style={{ width: `${pct}%` }} />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </>
                            )}
                        </Card>
                    </div>
                </div>
            </div>
        </main>
    )
}
