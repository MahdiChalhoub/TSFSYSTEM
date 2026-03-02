'use client'

import { useState, useEffect } from 'react'
import { getPurchaseOrders, getPurchaseOrder } from '@/app/actions/inventory/locations'
import {
    ShoppingBag, RefreshCw, ChevronRight, Clock, CheckCircle,
    XCircle, Package, Truck, Calendar, Building2, FileText,
    ArrowUpRight, Database, Search, Filter, ShieldCheck,
    AlertCircle, ListRestart, MoreHorizontal
} from 'lucide-react';
import { Plus } from 'lucide-react';
import ReceiveLineDialog from './ReceiveLineDialog'

type PO = {
    id: number
    po_number?: string
    supplier?: { id: number; name: string }
    supplier_name?: string
    status: string
    order_date: string
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
    qty_received: number
    unit_price: number
    line_total: number
}

const STATUS_STYLES: Record<string, { bg: string, text: string, border: string, icon: any }> = {
    DRAFT: { bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-200', icon: Clock },
    SUBMITTED: { bg: 'bg-blue-50', text: 'text-blue-500', border: 'border-blue-100', icon: ArrowUpRight },
    APPROVED: { bg: 'bg-indigo-50', text: 'text-indigo-500', border: 'border-indigo-100', icon: CheckCircle },
    ORDERED: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', icon: Truck },
    CONFIRMED: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-100', icon: CheckCircle },
    PARTIALLY_RECEIVED: { bg: 'bg-emerald-50/50', text: 'text-emerald-700', border: 'border-emerald-200', icon: AlertCircle },
    RECEIVED: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', icon: ShieldCheck },
    INVOICED: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100', icon: FileText },
    COMPLETED: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', icon: Database },
    CANCELLED: { bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-100', icon: XCircle },
}

export default function ReceiptsPage() {
    const [orders, setOrders] = useState<PO[]>([])
    const [selected, setSelected] = useState<PO | null>(null)
    const [detail, setDetail] = useState<PO | null>(null)
    const [loading, setLoading] = useState(true)
    const [receivingLine, setReceivingLine] = useState<POLine | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => { load() }, [])

    async function load() {
        setLoading(true)
        try {
            const data = await getPurchaseOrders()
            const raw = Array.isArray(data) ? data : (data?.results ?? [])
            // Filter to only show records in receivable states
            const receivable = raw.filter((o: PO) =>
                ['ORDERED', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(o.status)
            )
            setOrders(receivable)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    async function openDetail(po: PO) {
        setSelected(po)
        setDetail(null)
        try {
            const d = await getPurchaseOrder(po.id)
            setDetail(d)
        } catch (err) { console.error(err) }
    }

    const pendingCount = orders.filter(o => ['ORDERED', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(o.status)).length
    const totalValue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const receivedCount = orders.filter(o => o.status === 'RECEIVED').length

    const filteredOrders = orders.filter(o =>
        (o.po_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.supplier?.name || o.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="p-8 space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-700 pb-24">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white/40 p-8 rounded-[3rem] border border-white/60 shadow-xl shadow-gray-200/20 backdrop-blur-xl">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-[2.5rem] bg-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30 text-white transform hover:rotate-6 transition-transform">
                        <Truck size={38} strokeWidth={2.5} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => window.location.href = '/purchases/new'} className="h-14 px-8 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2">
                                <Plus size={16} />
                                Direct Operations
                            </button>
                            <h1 className="text-5xl font-black tracking-tighter text-gray-900 leading-tight">
                                Stock <span className="text-emerald-600">Reception</span>
                            </h1>
                            <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-200 shadow-sm">
                                Fulfillment Center
                            </div>
                        </div>
                        <p className="text-sm font-bold text-gray-400 mt-2 uppercase tracking-[0.2em] flex items-center gap-2">
                            <ShieldCheck size={14} className="text-emerald-500" />
                            Inventory Arrival and Quality Verification
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => window.location.href = '/purchases/new'} className="h-14 px-8 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2">
                        <Plus size={16} />
                        Direct Operations
                    </button>
                    <button onClick={load} className="h-14 px-8 rounded-2xl bg-white border-2 border-gray-50 text-gray-600 font-black text-xs uppercase tracking-widest hover:bg-gray-50 hover:border-gray-100 shadow-sm transition-all flex items-center gap-2 active:scale-95 group">
                        <RefreshCw size={16} className="group-active:rotate-180 transition-transform" />
                        Sync Data
                    </button>
                    <div className="w-px h-10 bg-gray-100 mx-2 hidden lg:block" />
                    <div className="flex flex-col items-end">
                        <div className="text-2xl font-black text-emerald-600 tracking-tighter">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Committed Pipeline</div>
                    </div>
                </div>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Inbound Pipeline', value: orders.length, icon: Package, color: 'emerald', desc: 'Current Active POs' },
                    { label: 'Pending Receipt', value: pendingCount, icon: Clock, color: 'amber', desc: 'Awaiting Fulfillment' },
                    { label: 'Recently Completed', value: receivedCount, icon: CheckCircle, color: 'blue', desc: '100% Stocked & Verified' },
                ].map(s => (
                    <div key={s.label} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/5 hover:-translate-y-2 transition-all group overflow-hidden relative">
                        <div className={`absolute top-0 right-0 w-32 h-32 bg-${s.color}-50/30 rounded-full -mr-16 -mt-16 blur-3xl`} />
                        <div className="flex items-center gap-5 relative z-10">
                            <div className={`w-14 h-14 rounded-2xl bg-${s.color}-50 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm`}>
                                <s.icon size={24} className={`text-${s.color}-600`} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.label}</p>
                                <p className={`text-3xl font-black text-gray-900 mt-0.5 tracking-tight`}>{s.value}</p>
                            </div>
                        </div>
                        <p className="text-[11px] font-bold text-gray-400 mt-4 px-1">{s.desc}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-col xl:flex-row gap-8 min-h-[600px]">
                {/* Left Panel: List */}
                <div className="w-full xl:w-[450px] space-y-4">
                    <div className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/10 flex items-center gap-3">
                        <Search size={18} className="text-gray-300 ml-3" />
                        <input
                            type="text"
                            placeholder="Find by PO#, Supplier..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 bg-transparent border-none outline-none font-bold text-sm text-gray-700 placeholder:text-gray-300"
                        />
                        <button className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:text-emerald-600 transition-colors">
                            <Filter size={16} />
                        </button>
                    </div>

                    <div className="flex flex-col gap-3 overflow-y-auto max-h-[800px] pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                        {loading ? Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-24 bg-white/50 border border-gray-100 rounded-[2rem] animate-pulse" />
                        )) : filteredOrders.length === 0 ? (
                            <div className="bg-white/50 rounded-[2rem] border-2 border-dashed border-gray-200 p-12 text-center opacity-40">
                                <ShoppingBag size={40} className="mx-auto mb-4" />
                                <p className="text-sm font-black uppercase tracking-widest text-emerald-900">No Orders Found</p>
                            </div>
                        ) : filteredOrders.map(po => {
                            const style = STATUS_STYLES[po.status] || STATUS_STYLES.DRAFT;
                            const Icon = style.icon;
                            return (
                                <button
                                    key={po.id}
                                    onClick={() => openDetail(po)}
                                    className={`w-full text-left p-6 rounded-[2rem] border-2 transition-all group relative overflow-hidden active:scale-95 ${selected?.id === po.id ? 'bg-white border-emerald-500 shadow-2xl shadow-emerald-500/10 ring-8 ring-emerald-500/5' : 'bg-white/60 border-transparent hover:border-gray-100 hover:bg-white hover:shadow-xl hover:shadow-gray-200/20'}`}
                                >
                                    {selected?.id === po.id && <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12" />}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-2 rounded-xl ${style.bg} ${style.text} border ${style.border}`}>
                                            <Icon size={16} />
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-black text-gray-900 tracking-tighter">${po.total_amount.toLocaleString()}</div>
                                            <div className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mt-0.5">Grand Total</div>
                                        </div>
                                    </div>

                                    <div className="font-mono font-black text-lg text-gray-900 tracking-tighter group-hover:text-emerald-700 transition-colors">
                                        {po.po_number || `PO-${po.id}`}
                                    </div>

                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${style.bg} ${style.text} ${style.border}`}>
                                            {po.status.replace('_', ' ')}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-50/50">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 truncate">
                                            <Building2 size={12} className="text-gray-300" />
                                            {po.supplier?.name || po.supplier_name}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 justify-end">
                                            <Calendar size={12} className="text-gray-300" />
                                            {po.order_date}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Detail Workspace */}
                <div className="flex-1 bg-white rounded-[3.5rem] border border-gray-100 shadow-2xl shadow-gray-200/10 overflow-hidden flex flex-col min-h-[800px]">
                    {!selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-6 opacity-40">
                            <div className="w-32 h-32 rounded-[3.5rem] bg-gray-50 flex items-center justify-center">
                                <ListRestart size={48} />
                            </div>
                            <div>
                                <p className="text-xl font-black uppercase tracking-widest text-center">Ready for Processing</p>
                                <p className="text-sm font-medium text-center mt-2">Select an order shipment to review its contents</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full animate-in slide-in-from-right-10 duration-500">
                            {/* Detail Header */}
                            <div className="p-10 border-b border-gray-50 bg-gray-50/30">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-4xl font-black text-gray-900 tracking-tighter">{selected.po_number || `PO-${selected.id}`}</h2>
                                            <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${STATUS_STYLES[selected.status]?.bg} ${STATUS_STYLES[selected.status]?.text} ${STATUS_STYLES[selected.status]?.border}`}>
                                                {selected.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-6">
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => window.location.href = '/purchases/new'} className="h-14 px-8 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2">
                                                    <Plus size={16} />
                                                    Direct Operations
                                                </button>
                                                <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                                                    <Building2 size={18} className="text-gray-400" />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier</div>
                                                    <div className="text-sm font-black text-gray-800">{selected.supplier?.name || selected.supplier_name}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => window.location.href = '/purchases/new'} className="h-14 px-8 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2">
                                                    <Plus size={16} />
                                                    Direct Operations
                                                </button>
                                                <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                                                    <Calendar size={18} className="text-gray-400" />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Shipment Logic</div>
                                                    <div className="text-sm font-black text-gray-800">{selected.expected_date || 'STANDARD ETA'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-5xl font-black text-gray-900 tracking-tighter tabular-nums">${selected.total_amount.toLocaleString()}</div>
                                        <p className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.3em] mt-3">Verified Document</p>
                                    </div>
                                </div>

                                {selected.notes && (
                                    <div className="mt-8 flex items-start gap-4 p-5 bg-white rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                                        <FileText size={20} className="text-gray-300 mt-1 shrink-0" />
                                        <p className="text-sm font-bold text-gray-600 leading-relaxed italic">{selected.notes}</p>
                                    </div>
                                )}
                            </div>

                            {/* Lines Table Section */}
                            <div className="flex-1 p-10 overflow-y-auto">
                                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Package size={14} /> Shipment Documentation Check-in
                                </h3>

                                <div className="space-y-4">
                                    {!detail ? Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="h-28 bg-gray-50 rounded-3xl animate-pulse" />
                                    )) : detail.lines?.length === 0 ? (
                                        <div className="p-12 bg-gray-50 rounded-3xl text-center font-bold text-gray-400">
                                            No shipment data attached to this PO.
                                        </div>
                                    ) : detail.lines?.map(line => {
                                        const received = Number(line.qty_received || 0);
                                        const ordered = Number(line.quantity || 0);
                                        const pct = ordered > 0 ? Math.min((received / ordered) * 100, 100) : 0;
                                        const isReceivable = ['ORDERED', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(selected.status) && received < ordered;

                                        return (
                                            <div key={line.id} className="group bg-white p-6 rounded-[2.5rem] border border-gray-100 hover:border-emerald-200 hover:shadow-2xl hover:shadow-gray-200/20 transition-all flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                                                <div className="flex items-center gap-6 flex-1 min-w-0">
                                                    <div className="w-16 h-16 rounded-2xl bg-gray-50 group-hover:bg-emerald-50 flex items-center justify-center transition-colors shrink-0">
                                                        <Package size={28} className="text-gray-300 group-hover:text-emerald-500 transition-colors" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-lg font-black text-gray-900 truncate group-hover:text-emerald-700 transition-colors">{line.product_name}</div>
                                                        <div className="flex items-center gap-4 mt-1.5">
                                                            <div className="text-xs font-mono font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">{line.product?.sku}</div>
                                                            <div className="text-xs font-bold text-gray-500">Unit Basis: ${Number(line.unit_price).toFixed(2)}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="w-full md:w-64 space-y-3">
                                                    <div className="flex justify-between items-end px-1">
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Progress</span>
                                                            <span className="text-sm font-black text-gray-900">{received} <span className="text-gray-300 font-medium">/</span> {ordered}</span>
                                                        </div>
                                                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${pct >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {pct.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                    <div className="h-3 bg-gray-50 rounded-full overflow-hidden border border-gray-100 relative">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-1000 ${pct >= 100 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-emerald-500'}`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 shrink-0">
                                                    <div className="text-right mr-4 hidden sm:block">
                                                        <div className="text-lg font-black text-gray-900">${Number(line.line_total).toLocaleString()}</div>
                                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Post-Tax Value</div>
                                                    </div>

                                                    {isReceivable && (
                                                        <button
                                                            onClick={() => setReceivingLine(line)}
                                                            className="h-14 px-8 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-2"
                                                        >
                                                            <CheckCircle size={16} />
                                                            Receive
                                                        </button>
                                                    )}

                                                    {!isReceivable && received >= ordered && (
                                                        <div className="h-14 px-8 bg-gray-50 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest border border-gray-100 flex items-center gap-2">
                                                            <ShieldCheck size={16} className="text-emerald-500" />
                                                            Completed
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Sticky Footer Audit Control */}
                            <div className="p-8 bg-white border-t border-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100">
                                        <AlertCircle size={24} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Status</div>
                                        <div className="text-sm font-black text-gray-700 mt-1 uppercase tracking-tighter">Awaiting Review</div>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <button className="h-14 w-14 rounded-2xl border-2 border-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all">
                                        <MoreHorizontal size={24} />
                                    </button>
                                    <button
                                        onClick={() => setSelected(null)}
                                        className="h-14 px-8 rounded-2xl bg-gray-900 text-white font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-900/10"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {receivingLine && selected && (
                <ReceiveLineDialog
                    po={selected}
                    line={receivingLine}
                    onClose={() => setReceivingLine(null)}
                    onSuccess={(updatedPo) => {
                        setDetail(updatedPo);
                        setOrders(prev => prev.map(o => o.id === updatedPo.id ? updatedPo : o));
                    }}
                />
            )}
        </div>
    )
}
