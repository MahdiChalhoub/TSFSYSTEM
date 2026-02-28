'use client'

import { useState, useEffect } from 'react'
import { getPurchaseOrders, getPurchaseOrder } from '@/app/actions/inventory/locations'
import { ShoppingBag, RefreshCw, ChevronRight, Clock, CheckCircle, XCircle, Package, Truck, Calendar, User, Building2, FileText, ClipboardList } from 'lucide-react'

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

export default function PurchaseInvoicesPage() {
    const [orders, setOrders] = useState<PO[]>([])
    const [selected, setSelected] = useState<PO | null>(null)
    const [detail, setDetail] = useState<PO | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => { load() }, [])

    async function load() {
        setLoading(true)
        const data = await getPurchaseOrders()
        const raw = Array.isArray(data) ? data : (data?.results ?? [])
        // Filter to only show records where invoicing/billing is the focus
        setOrders(raw.filter((o: PO) => ['RECEIVED', 'INVOICED', 'COMPLETED'].includes(o.status)))
        setLoading(false)
    }

    async function openDetail(po: PO) {
        setSelected(po)
        const d = await getPurchaseOrder(po.id)
        setDetail(d)
    }

    const pending = orders.filter(o => ['RECEIVED', 'INVOICED'].includes(o.status))
    const totalValue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const received = orders.filter(o => o.status === 'COMPLETED').length

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
                            <FileText size={28} className="text-white" />
                        </div>
                        Purchase <span className="text-purple-600">Invoices</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Supplier Billing & Settlement Tracking</p>
                </div>
                <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-100 hover:bg-gray-50 text-gray-600 font-medium text-sm shadow-sm transition-all">
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Total Invoiced', value: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: FileText, color: 'purple' },
                    { label: 'Pending Payment', value: pending.length, icon: Clock, color: 'amber' },
                    { label: 'Received', value: received, icon: CheckCircle, color: 'emerald' },
                ].map(s => (
                    <div key={s.label} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 group">
                        <div className={`w-12 h-12 rounded-xl bg-${s.color}-50 flex items-center justify-center group-hover:bg-${s.color}-100 transition-colors`}>
                            <s.icon size={22} className={`text-${s.color}-600`} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{s.label}</p>
                            <p className={`text-2xl font-black text-${s.color}-600 mt-0.5`}>{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex gap-6">
                {/* Orders list */}
                <div className="w-1/2 flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-2">
                    {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />) :
                        orders.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 font-medium text-sm shadow-sm">No purchase orders found.</div>
                        ) : orders.map(po => (
                            <button key={po.id} onClick={() => openDetail(po)} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all shadow-sm ${selected?.id === po.id ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-bold text-sm text-gray-900">{po.po_number || `PO-${po.id}`}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${STATUS_STYLES[po.status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>{po.status.replace('_', ' ')}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                        <span className="flex items-center gap-1"><Building2 size={10} />{po.supplier?.name || po.supplier_name || '—'}</span>
                                        <span className="flex items-center gap-1"><Calendar size={10} />{po.order_date}</span>
                                    </div>
                                </div>
                                <div className="text-sm font-black text-gray-900 shrink-0">${Number(po.total_amount || 0).toFixed(2)}</div>
                                <ChevronRight size={14} className="text-gray-400 shrink-0" />
                            </button>
                        ))}
                </div>

                {/* Detail panel */}
                <div className="w-1/2 bg-white rounded-2xl border border-gray-100 p-6 flex flex-col gap-5 shadow-sm">
                    {!selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 py-12">
                            <ShoppingBag size={48} className="text-gray-200" />
                            <p className="text-sm font-medium">Select a purchase order to view details</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-black text-gray-900">{selected.po_number || `PO-${selected.id}`}</h2>
                                    <div className="flex items-center gap-3 text-sm font-bold text-gray-700 mt-1">
                                        <span className="flex items-center gap-1.5"><Building2 size={14} className="text-gray-400" /> {selected.supplier?.name || selected.supplier_name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                        <span className="flex items-center gap-1"><Calendar size={10} />Ordered: {selected.order_date}</span>
                                        {selected.expected_delivery && <span className="flex items-center gap-1"><Truck size={10} />Expected: {selected.expected_delivery}</span>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black text-gray-900">${Number(selected.total_amount || 0).toFixed(2)}</div>
                                    <span className={`px-2 py-0.5 mt-1 inline-block rounded-full text-[10px] font-black uppercase tracking-wider border ${STATUS_STYLES[selected.status] || ''}`}>{selected.status.replace('_', ' ')}</span>
                                </div>
                            </div>

                            {selected.notes && (
                                <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <FileText size={14} className="text-gray-400 shrink-0 mt-0.5" />
                                    <p className="text-sm font-medium text-gray-600 leading-relaxed">{selected.notes}</p>
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
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                                                            <Package size={14} className="text-purple-600" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-bold text-gray-900 truncate">{line.product?.name || line.product_name || '—'}</div>
                                                            {line.product?.sku && <div className="text-xs text-gray-400 font-mono mt-0.5 font-medium">{line.product.sku}</div>}
                                                        </div>
                                                        <div className="text-right text-sm">
                                                            <div className="text-gray-500 font-medium">{ordered} × ${Number(line.unit_price || 0).toFixed(2)}</div>
                                                            <div className="font-black text-gray-900 mt-0.5">${Number(line.subtotal || 0).toFixed(2)}</div>
                                                        </div>
                                                    </div>
                                                    {line.quantity_received != null && (
                                                        <div className="mt-2">
                                                            <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
                                                                <span>Received: {received} / {ordered}</span>
                                                                <span>{pct.toFixed(0)}%</span>
                                                            </div>
                                                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-gray-300'}`} style={{ width: `${pct}%` }} />
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
