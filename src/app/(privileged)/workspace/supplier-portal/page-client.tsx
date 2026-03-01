'use client'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { getSupplierProformas, getPriceChangeRequests, approvePriceRequest } from '@/app/actions/portal'
import { Truck, FileText, Tag, RefreshCw, CheckCircle, XCircle, Clock, DollarSign, TrendingUp, Package, Activity } from 'lucide-react'
type Proforma = { id: number; proforma_number?: string; supplier?: { id: number; name: string }; supplier_name?: string; status: string; total_amount: number; created_at?: string }
type PriceRequest = { id: number; supplier?: { id: number; name: string }; supplier_name?: string; product?: { name: string; sku?: string }; product_name?: string; current_price: number; requested_price: number; status: string; reason?: string }
const STATUS_BADGE: Record<string, string> = {
    PENDING: 'bg-amber-900/40 text-amber-400 border-amber-700',
    APPROVED: 'bg-emerald-900/40 text-emerald-400 border-emerald-700',
    REJECTED: 'bg-red-900/40 text-red-400 border-red-800',
    DRAFT: 'bg-gray-800 text-gray-400 border-gray-700',
    SENT: 'bg-blue-900/40 text-blue-400 border-blue-800',
    ACCEPTED: 'bg-emerald-900/40 text-emerald-400 border-emerald-700',
}
export default function SupplierPortalAdminPage() {
    const [tab, setTab] = useState<'proformas' | 'pricing'>('pricing')
    const [proformas, setProformas] = useState<Proforma[]>([])
    const [priceReqs, setPriceReqs] = useState<PriceRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
    useEffect(() => { load() }, [])
    async function load() {
        setLoading(true)
        const [p, r] = await Promise.all([getSupplierProformas(), getPriceChangeRequests()])
        setProformas(p)
        setPriceReqs(r)
        setLoading(false)
    }
    async function handleApprove(id: number) {
        try {
            await approvePriceRequest(id)
            showToast('Price change approved', 'ok')
            load()
        } catch { showToast('Failed', 'err') }
    }
    function showToast(msg: string, type: 'ok' | 'err') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }
    const pendingPrice = priceReqs.filter(r => r.status === 'PENDING')
    const totalProformaValue = proformas.reduce((s, p) => s + Number(p.total_amount || 0), 0)
    return (
        <div className="min-h-screen bg-[#070D1B] text-gray-100 p-6 flex flex-col gap-6">
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium border ${toast.type === 'ok' ? 'bg-emerald-900/80 border-emerald-700 text-emerald-300' : 'bg-red-900/80 border-red-700 text-red-300'}`}>
                    {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}
            {/* Header: Supplier Operations */}
            <header className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[10px] uppercase tracking-widest px-3 py-1">
                            Active
                        </Badge>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-1">
                            <Activity size={12} /> Sync: Direct
                        </span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-[1.8rem] bg-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-200">
                            <Truck size={32} className="text-white fill-white" />
                        </div>
                        Supplier <span className="text-emerald-600">Ops</span>
                    </h1>
                </div>
                <div className="flex gap-3">
                    <button onClick={load} className="h-12 px-6 rounded-2xl bg-white border border-gray-100 shadow-sm font-bold text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-all">
                        <RefreshCw size={18} /> Refresh
                    </button>
                    <button className="h-12 px-6 rounded-2xl bg-emerald-600 text-white font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                        Vendor Audit <ChevronRight size={18} />
                    </button>
                </div>
            </header>
            {/* Premium KPI Node Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                            <DollarSign size={24} />
                        </div>
                        <Badge variant="outline" className="text-rose-500 bg-rose-50 border-0 font-black text-[10px]">
                            PROFORMA
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Total Value</p>
                    <h2 className="text-3xl font-black text-gray-900">${totalProformaValue.toFixed(2)}</h2>
                </div>
                <div className="bg-amber-900 p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-white">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-800/50 text-amber-100 flex items-center justify-center">
                            <Tag size={24} />
                        </div>
                        <Badge variant="outline" className="text-amber-200 bg-amber-800/30 border-0 font-black text-[10px]">
                            {pendingPrice.length} PENDING
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-amber-300 uppercase tracking-widest leading-none mb-1">Price Adjustments</p>
                    <h2 className="text-3xl font-black text-white">{pendingPrice.length} <span className="text-xs text-amber-200">REQUESTS</span></h2>
                </div>
                <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <FileText size={24} />
                        </div>
                        <Badge variant="outline" className="text-emerald-500 bg-emerald-50 border-0 font-black text-[10px]">
                            REGISTRY
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Total Proformas</p>
                    <h2 className="text-3xl font-black text-gray-900">{proformas.length}</h2>
                </div>
            </div>
            {/* Tabs */}
            <div className="flex gap-1 bg-[#0F1729] rounded-2xl border border-gray-800 p-1.5 w-fit">
                {([['pricing', 'Price Change Requests', Tag], ['proformas', 'Proformas', FileText]] as const).map(([key, label, Icon]) => (
                    <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === key ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/40' : 'text-gray-400 hover:text-gray-200'}`}>
                        <Icon size={14} />
                        {label}
                        {key === 'pricing' && pendingPrice.length > 0 && <span className="bg-amber-500 text-black text-[10px] font-bold px-1.5 rounded-full">{pendingPrice.length}</span>}
                    </button>
                ))}
            </div>
            {/* Tab content */}
            <div className="flex flex-col gap-2">
                {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-gray-800/50 rounded-xl animate-pulse" />) :
                    tab === 'pricing' ? (
                        priceReqs.length === 0 ? <div className="text-sm text-gray-500 py-8 text-center">No price change requests.</div> :
                            priceReqs.map(r => {
                                const pct = ((Number(r.requested_price) - Number(r.current_price)) / Number(r.current_price || 1)) * 100
                                const isIncrease = pct > 0
                                return (
                                    <div key={r.id} className="flex items-start gap-6 p-6 rounded-[2.5rem] bg-white shadow-sm border border-slate-50 transition-all hover:shadow-md group">
                                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                                            <Package size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="font-black text-sm text-gray-900 uppercase italic">{r.product?.name || r.product_name || '—'}</span>
                                                <Badge className={`${STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-400'} border-0 text-[8px] font-black px-3 py-0.5 rounded-full uppercase tracking-widest`}>{r.status}</Badge>
                                            </div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{r.supplier?.name || r.supplier_name || '—'}</span>
                                                {r.product?.sku && <span className="text-[10px] text-gray-300">·</span>}
                                                {r.product?.sku && <span className="text-[10px] font-bold text-gray-400 font-mono italic">{r.product.sku}</span>}
                                            </div>
                                            <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Current</span>
                                                    <span className="text-sm font-black text-gray-500 line-through">${Number(r.current_price).toFixed(2)}</span>
                                                </div>
                                                <ChevronRight size={16} className="text-gray-300 mt-4" />
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Requested</span>
                                                    <span className="text-xl font-black text-gray-900">${Number(r.requested_price).toFixed(2)}</span>
                                                </div>
                                                <div className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black ${isIncrease ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {isIncrease ? <TrendingUp size={12} /> : <TrendingUp size={12} className="rotate-180" />}
                                                    {Math.abs(pct).toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                        {r.status === 'PENDING' && (
                                            <button onClick={() => handleApprove(r.id)} className="h-12 px-6 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all self-center">
                                                Authorize
                                            </button>
                                        )}
                                    </div>
                                )
                            })
                    ) : (
                        proformas.length === 0 ? <div className="text-sm text-gray-500 py-8 text-center">No proformas received.</div> :
                            proformas.map(p => (
                                <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 rounded-xl bg-[#0F1729] border border-gray-800">
                                    <FileText size={16} className="text-orange-400 shrink-0" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-semibold text-sm text-white">{p.proforma_number || `#${p.id}`}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE[p.status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>{p.status}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">{p.supplier?.name || p.supplier_name || '—'}{p.created_at ? ` · ${new Date(p.created_at).toLocaleDateString()}` : ''}</p>
                                    </div>
                                    <div className="font-mono font-bold text-sm text-white">${Number(p.total_amount || 0).toFixed(2)}</div>
                                </div>
                            ))
                    )
                }
            </div>
        </div>
    )
}
