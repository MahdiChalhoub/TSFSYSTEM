'use client'

import { useState, useEffect } from 'react'
import { getPurchaseOrders, getPurchaseOrder } from '@/app/actions/inventory/locations'
import { ShoppingBag, RefreshCw, ChevronRight, Clock, CheckCircle, XCircle, Package, Truck, Calendar, User, Building2, FileText , ClipboardList } from 'lucide-react'

type PO = {
    id: number
    po_number?: string
    supplier?: { id: number; name: string }
    supplier_name?: string
    status: string
    order_date: string
    expected_delivery?: string
    total_amount: number
    notes?: string
    lines?: POLine[]
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

const STATUS_STYLES: Record<string, string> = {
    DRAFT: 'bg-gray-800 text-gray-400 border-gray-700',
    SENT: 'bg-blue-900/40 text-blue-400 border-blue-800',
    PARTIALLY_RECEIVED: 'bg-amber-900/40 text-amber-400 border-amber-700',
    RECEIVED: 'bg-emerald-900/40 text-emerald-400 border-emerald-700',
    CANCELLED: 'bg-red-900/40 text-red-400 border-red-800',
}

export default function PurchaseOrdersPage() {
    const [orders, setOrders] = useState<PO[]>([])
    const [selected, setSelected] = useState<PO | null>(null)
    const [detail, setDetail] = useState<PO | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => { load() }, [])

    async function load() {
        setLoading(true)
        const data = await getPurchaseOrders()
        setOrders(Array.isArray(data) ? data : (data?.results ?? []))
        setLoading(false)
    }

    async function openDetail(po: PO) {
        setSelected(po)
        const d = await getPurchaseOrder(po.id)
        setDetail(d)
    }

    const pending = orders.filter(o => ['DRAFT', 'SENT', 'PARTIALLY_RECEIVED'].includes(o.status))
    const totalValue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const received = orders.filter(o => o.status === 'RECEIVED').length

    return (
        <div className="min-h-screen bg-[#070D1B] text-gray-100 p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-900/40">
                        <ShoppingBag size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-[1.5rem] bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                                <ClipboardList size={28} className="text-white" />
                            </div>
                            Purchase <span className="text-blue-600">Orders</span>
                        </h1>
                        <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Order Management</p>
                    </div>
                </div>
                <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm">
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total PO Value', value: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: ShoppingBag, color: 'indigo' },
                    { label: 'In Progress', value: pending.length, icon: Clock, color: 'amber' },
                    { label: 'Received', value: received, icon: CheckCircle, color: 'emerald' },
                ].map(s => (
                    <div key={s.label} className="bg-[#0F1729] rounded-2xl border border-gray-800 p-5">
                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><s.icon size={14} />{s.label}</div>
                        <div className={`text-2xl font-bold text-${s.color}-400`}>{s.value}</div>
                    </div>
                ))}
            </div>

            <div className="flex gap-6">
                {/* Orders list */}
                <div className="w-1/2 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                    {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />) :
                        orders.length === 0 ? (
                            <div className="bg-[#0F1729] rounded-2xl border border-gray-800 p-12 text-center text-gray-500 text-sm">No purchase orders found.</div>
                        ) : orders.map(po => (
                            <button key={po.id} onClick={() => openDetail(po)} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${selected?.id === po.id ? 'bg-indigo-900/20 border-indigo-700' : 'bg-[#0F1729] border-gray-800 hover:border-gray-700'}`}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-semibold text-sm text-white">{po.po_number || `PO-${po.id}`}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLES[po.status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>{po.status.replace('_', ' ')}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                        <span className="flex items-center gap-1"><Building2 size={10} />{po.supplier?.name || po.supplier_name || '—'}</span>
                                        <span className="flex items-center gap-1"><Calendar size={10} />{po.order_date}</span>
                                    </div>
                                </div>
                                <div className="text-sm font-semibold text-white shrink-0">${Number(po.total_amount || 0).toFixed(2)}</div>
                                <ChevronRight size={14} className="text-gray-600 shrink-0" />
                            </button>
                        ))}
                </div>

                {/* Detail panel */}
                <div className="w-1/2 bg-[#0F1729] rounded-2xl border border-gray-800 p-6 flex flex-col gap-5">
                    {!selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-3 py-12">
                            <ShoppingBag size={48} className="opacity-20" />
                            <p className="text-sm">Select a purchase order to view details</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-lg font-bold text-white">{selected.po_number || `PO-${selected.id}`}</h2>
                                    <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                                        <span className="flex items-center gap-1"><Building2 size={12} />{selected.supplier?.name || selected.supplier_name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                        <span className="flex items-center gap-1"><Calendar size={10} />Ordered: {selected.order_date}</span>
                                        {selected.expected_delivery && <span className="flex items-center gap-1"><Truck size={10} />Expected: {selected.expected_delivery}</span>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-white">${Number(selected.total_amount || 0).toFixed(2)}</div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLES[selected.status] || ''}`}>{selected.status.replace('_', ' ')}</span>
                                </div>
                            </div>

                            {selected.notes && (
                                <div className="flex items-start gap-2 bg-[#070D1B] rounded-xl p-3 border border-gray-800">
                                    <FileText size={13} className="text-gray-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-gray-400">{selected.notes}</p>
                                </div>
                            )}

                            {/* Order lines */}
                            {detail?.lines && detail.lines.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Order Lines</h3>
                                    <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                                        {detail.lines.map(line => {
                                            const received = Number(line.quantity_received || 0)
                                            const ordered = Number(line.quantity_ordered || 0)
                                            const pct = ordered > 0 ? Math.min((received / ordered) * 100, 100) : 0
                                            return (
                                                <div key={line.id} className="bg-[#070D1B] rounded-xl border border-gray-800 p-3">
                                                    <div className="flex items-center gap-2">
                                                        <Package size={13} className="text-indigo-400 shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm text-white truncate">{line.product?.name || line.product_name || '—'}</div>
                                                            {line.product?.sku && <div className="text-xs text-gray-500 font-mono">{line.product.sku}</div>}
                                                        </div>
                                                        <div className="text-right text-xs">
                                                            <div className="text-gray-400">{ordered} × ${Number(line.unit_price || 0).toFixed(2)}</div>
                                                            <div className="font-semibold text-white">${Number(line.subtotal || 0).toFixed(2)}</div>
                                                        </div>
                                                    </div>
                                                    {line.quantity_received != null && (
                                                        <div className="mt-2">
                                                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                                                <span>Received: {received} / {ordered}</span>
                                                                <span>{pct.toFixed(0)}%</span>
                                                            </div>
                                                            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-gray-700'}`} style={{ width: `${pct}%` }} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
