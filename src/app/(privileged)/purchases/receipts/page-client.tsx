// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchPurchaseOrders, fetchPurchaseOrder, receivePOLine } from '@/app/actions/pos/purchases'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
    RefreshCw, Clock, CheckCircle, Package, Truck, Building2,
    Calendar, Search, FileText, ShieldCheck, Loader2,
    PackageCheck, ChevronRight
} from 'lucide-react'
import Link from 'next/link'

type PO = {
    id: number
    po_number?: string
    supplier?: { id: number; name: string }
    supplier_name?: string
    supplier_display?: string
    status: string
    order_date?: string
    expected_date?: string
    total_amount: number
    notes?: string
    lines?: POLine[]
}

type POLine = {
    id: number
    product?: { id: number; name: string; sku?: string }
    product_name?: string
    quantity: number
    quantity_ordered?: number
    qty_received: number
    quantity_received?: number
    unit_price: number
    line_total?: number
    subtotal?: number
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
    ORDERED: { label: 'Ordered', class: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
    CONFIRMED: { label: 'Confirmed', class: 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' },
    IN_TRANSIT: { label: 'In Transit', class: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
    PARTIALLY_RECEIVED: { label: 'Partial', class: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
    RECEIVED: { label: 'Received', class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
}

export default function ReceiptsPage() {
    const [orders, setOrders] = useState<PO[]>([])
    const [selected, setSelected] = useState<PO | null>(null)
    const [detail, setDetail] = useState<PO | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showReceive, setShowReceive] = useState(false)
    const [receiveLine, setReceiveLine] = useState<POLine | null>(null)
    const [receiveQty, setReceiveQty] = useState('')
    const [actionLoading, setActionLoading] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await fetchPurchaseOrders()
            const raw = Array.isArray(data) ? data : (data?.results ?? [])
            setOrders(raw.filter((o: PO) =>
                ['ORDERED', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(o.status)
            ))
        } catch { setOrders([]) }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    async function openDetail(po: PO) {
        setSelected(po)
        setDetail(null)
        try {
            const d = await fetchPurchaseOrder(po.id)
            setDetail(d)
        } catch { setDetail(po) }
    }

    async function handleReceive() {
        if (!selected || !receiveLine || !receiveQty) return
        setActionLoading(true)
        try {
            await receivePOLine(selected.id, { line_id: receiveLine.id, quantity_received: Number(receiveQty) })
            toast.success('Goods received successfully')
            setShowReceive(false)
            setReceiveLine(null)
            setReceiveQty('')
            const updated = await fetchPurchaseOrder(selected.id)
            setDetail(updated)
            setSelected(updated)
            await load()
        } catch (e: any) { toast.error(e?.message || 'Failed to receive goods') }
        setActionLoading(false)
    }

    const filtered = orders.filter(o => {
        if (!search) return true
        const q = search.toLowerCase()
        return (o.po_number || '').toLowerCase().includes(q) ||
            (o.supplier?.name || o.supplier_name || o.supplier_display || '').toLowerCase().includes(q)
    })

    const pendingCount = orders.filter(o => ['ORDERED', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(o.status)).length
    const totalValue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const completedCount = orders.filter(o => o.status === 'RECEIVED').length

    return (
        <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-[1600px] mx-auto space-y-[var(--layout-section-spacing)]">

                {/* ── Header ── */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shadow-sm">
                            <Truck size={24} className="text-emerald-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-4xl font-black tracking-tight theme-text">
                                Stock <span className="text-emerald-500">Reception</span>
                            </h1>
                            <p className="text-xs md:text-sm font-medium theme-text-muted mt-0.5 hidden sm:block">
                                Inventory arrival & quality verification
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={load} className="min-h-[44px] md:min-h-[36px]">
                            <RefreshCw size={14} className="mr-1.5" /> Refresh
                        </Button>
                        <Link href="/purchases/receiving?mode=direct">
                            <Button size="sm" className="min-h-[44px] md:min-h-[36px] bg-emerald-500 hover:bg-emerald-600 text-white">
                                <Package size={14} className="mr-1.5" /> Direct Receipt
                            </Button>
                        </Link>
                    </div>
                </header>

                {/* ── KPI Strip ── */}
                <section className="grid grid-cols-3 gap-3 md:gap-[var(--layout-element-gap)]" aria-label="Reception statistics">
                    {[
                        { label: 'Pipeline Value', value: totalValue.toLocaleString(), icon: Package, accent: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
                        { label: 'Pending Receipt', value: pendingCount, icon: Clock, accent: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
                        { label: 'Received', value: completedCount, icon: CheckCircle, accent: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
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

                {/* ── Search ── */}
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" />
                    <Input placeholder="Search POs, suppliers..." value={search} onChange={e => setSearch(e.target.value)}
                        className="pl-10 min-h-[44px] md:min-h-[40px]" />
                </div>

                {/* ── Content ── */}
                <div className="flex flex-col lg:flex-row gap-4 md:gap-[var(--layout-element-gap)]">
                    {/* List */}
                    <div className="w-full lg:w-5/12 flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
                        {loading ? Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-[80px] rounded-xl animate-pulse theme-surface" style={{ border: '1px solid var(--theme-border)' }} />
                        )) : filtered.length === 0 ? (
                            <Card className="border shadow-sm">
                                <CardContent className="p-12 text-center">
                                    <Truck size={40} className="mx-auto theme-text-muted mb-3 opacity-30" />
                                    <p className="text-sm font-medium theme-text-muted">No incoming shipments</p>
                                    <p className="text-xs theme-text-muted mt-1">Orders will appear here when they're ready for receiving</p>
                                </CardContent>
                            </Card>
                        ) : filtered.map(po => {
                            const statusCfg = STATUS_CONFIG[po.status] || { label: po.status, class: 'bg-app-surface theme-text-muted' }
                            return (
                                <button key={po.id} onClick={() => openDetail(po)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all shadow-sm min-h-[72px] ${selected?.id === po.id ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-600' : 'theme-surface'
                                        }`}
                                    style={{ borderColor: selected?.id === po.id ? undefined : 'var(--theme-border)' }}
                                >
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono font-bold text-sm theme-text">{po.po_number || `PO-${po.id}`}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${statusCfg.class}`}>
                                                {statusCfg.label}
                                            </span>
                                        </div>
                                        <span className="text-sm font-black theme-text shrink-0">{Number(po.total_amount).toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs theme-text-muted">
                                        <span className="flex items-center gap-1 truncate"><Building2 size={10} />{po.supplier?.name || po.supplier_name || po.supplier_display || '—'}</span>
                                        <span className="flex items-center gap-1"><Calendar size={10} />{po.order_date || '—'}</span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    {/* Detail + Lines */}
                    <div className="w-full lg:w-7/12 lg:sticky lg:top-4 lg:self-start">
                        <Card className="border shadow-sm min-h-[400px]">
                            {!selected ? (
                                <CardContent className="flex flex-col items-center justify-center py-20 theme-text-muted gap-3">
                                    <Truck size={48} className="opacity-20" />
                                    <p className="text-sm font-medium">Select an order to inspect & receive</p>
                                </CardContent>
                            ) : (
                                <>
                                    <CardHeader>
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                            <div>
                                                <CardTitle className="text-xl md:text-2xl font-black theme-text flex items-center gap-3">
                                                    {selected.po_number || `PO-${selected.id}`}
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_CONFIG[selected.status]?.class || ''}`}>
                                                        {STATUS_CONFIG[selected.status]?.label || selected.status}
                                                    </span>
                                                </CardTitle>
                                                <div className="flex items-center gap-4 text-sm theme-text-muted mt-2 flex-wrap">
                                                    <span className="flex items-center gap-1.5"><Building2 size={14} />{selected.supplier?.name || selected.supplier_name || selected.supplier_display}</span>
                                                    {selected.expected_date && <span className="flex items-center gap-1.5"><Truck size={14} />ETA: {selected.expected_date}</span>}
                                                </div>
                                            </div>
                                            <div className="text-left md:text-right shrink-0">
                                                <div className="text-2xl md:text-3xl font-black theme-text">{Number(selected.total_amount).toLocaleString()}</div>
                                            </div>
                                        </div>
                                    </CardHeader>

                                    <CardContent>
                                        {selected.notes && (
                                            <div className="p-3 rounded-xl theme-surface text-sm theme-text-muted mb-4" style={{ border: '1px solid var(--theme-border)' }}>
                                                <FileText size={12} className="inline mr-1.5" />{selected.notes}
                                            </div>
                                        )}

                                        <h3 className="text-xs font-black theme-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Package size={14} className="text-emerald-500" /> Shipment Lines
                                        </h3>

                                        {!detail ? (
                                            <div className="space-y-2">
                                                {Array.from({ length: 3 }).map((_, i) => (
                                                    <div key={i} className="h-20 rounded-xl animate-pulse theme-surface" style={{ border: '1px solid var(--theme-border)' }} />
                                                ))}
                                            </div>
                                        ) : !detail.lines?.length ? (
                                            <div className="p-8 text-center text-sm theme-text-muted rounded-xl theme-surface" style={{ border: '1px solid var(--theme-border)' }}>
                                                No shipment lines found
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                                                {detail.lines.map(line => {
                                                    const ordered = Number(line.quantity || line.quantity_ordered || 0)
                                                    const received = Number(line.qty_received || line.quantity_received || 0)
                                                    const pct = ordered > 0 ? Math.round(Math.min((received / ordered) * 100, 100)) : 0
                                                    const isComplete = pct >= 100
                                                    const isReceivable = ['ORDERED', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(selected.status) && !isComplete

                                                    return (
                                                        <div key={line.id} className="p-3 md:p-4 rounded-xl theme-surface" style={{ border: '1px solid var(--theme-border)' }}>
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isComplete ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-app-surface bg-app-surface'}`}>
                                                                    {isComplete ? <ShieldCheck size={16} className="text-emerald-500" /> : <Package size={16} className="theme-text-muted" />}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-bold theme-text text-sm truncate">{line.product?.name || line.product_name || '—'}</div>
                                                                    <div className="flex items-center gap-3 text-xs theme-text-muted mt-0.5">
                                                                        {line.product?.sku && <span className="font-mono">{line.product.sku}</span>}
                                                                        <span>{Number(line.unit_price || 0).toLocaleString()} ea</span>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right shrink-0 hidden sm:block">
                                                                    <div className="font-black theme-text text-sm">{Number(line.line_total || line.subtotal || 0).toLocaleString()}</div>
                                                                </div>
                                                                {isReceivable && (
                                                                    <Button size="sm" className="min-h-[44px] md:min-h-[32px] bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
                                                                        onClick={() => { setReceiveLine(line); setReceiveQty(''); setShowReceive(true) }}>
                                                                        <PackageCheck size={12} className="mr-1" /> Receive
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            {/* Progress Bar */}
                                                            <div className="mt-2">
                                                                <div className="flex justify-between text-[10px] font-bold theme-text-muted mb-1">
                                                                    <span>{received} / {ordered} received</span>
                                                                    <span className={isComplete ? 'text-emerald-500' : 'text-amber-500'}>{pct}%</span>
                                                                </div>
                                                                <div className="h-2 rounded-full overflow-hidden bg-app-surface bg-app-surface">
                                                                    <div className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-gray-200'}`}
                                                                        style={{ width: `${pct}%` }} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </CardContent>
                                </>
                            )}
                        </Card>
                    </div>
                </div>
            </div>

            {/* ── Receive Dialog ── */}
            {showReceive && receiveLine && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowReceive(false)}>
                    <div className="w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-black theme-text mb-1 flex items-center gap-2">
                            <PackageCheck size={20} className="text-emerald-500" /> Receive Goods
                        </h3>
                        <p className="text-sm theme-text-muted mb-4">{receiveLine.product?.name || receiveLine.product_name || 'Product'}</p>
                        <div className="p-3 rounded-xl theme-surface mb-4 text-xs theme-text-muted" style={{ border: '1px solid var(--theme-border)' }}>
                            <span>Ordered: {receiveLine.quantity || receiveLine.quantity_ordered}</span>
                            <span className="mx-2">•</span>
                            <span>Already received: {receiveLine.qty_received || receiveLine.quantity_received || 0}</span>
                        </div>
                        <div className="space-y-3 mb-6">
                            <Label className="text-sm font-bold">Quantity to Receive</Label>
                            <Input type="number" value={receiveQty} onChange={e => setReceiveQty(e.target.value)} placeholder="Enter quantity" className="min-h-[48px]" autoFocus />
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1 min-h-[48px]" onClick={() => setShowReceive(false)}>Cancel</Button>
                            <Button className="flex-1 min-h-[48px] bg-emerald-500 hover:bg-emerald-600 text-white" onClick={handleReceive} disabled={!receiveQty || actionLoading}>
                                {actionLoading ? <Loader2 size={14} className="animate-spin mr-2" /> : null} Confirm Receipt
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}
