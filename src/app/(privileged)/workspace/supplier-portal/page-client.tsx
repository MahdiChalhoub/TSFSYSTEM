'use client'

import { useState, useEffect } from 'react'
import { getSupplierProformas, getPriceChangeRequests, approvePriceRequest } from '@/app/actions/portal'
import { Truck, FileText, Tag, RefreshCw, CheckCircle, XCircle, Clock, DollarSign, TrendingUp, Package } from 'lucide-react'

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

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-900/40">
                        <Truck size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Supplier Portal Admin</h1>
                        <p className="text-sm text-gray-400 mt-0.5">Manage proformas and supplier price change requests</p>
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
                    { label: 'Proforma Value', value: `$${totalProformaValue.toFixed(2)}`, icon: DollarSign, color: 'rose' },
                    { label: 'Pending Price Requests', value: pendingPrice.length, icon: Tag, color: pendingPrice.length > 0 ? 'amber' : 'gray' },
                    { label: 'Total Proformas', value: proformas.length, icon: FileText, color: 'orange' },
                ].map(s => (
                    <div key={s.label} className="bg-[#0F1729] rounded-2xl border border-gray-800 p-5">
                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><s.icon size={14} />{s.label}</div>
                        <div className={`text-2xl font-bold text-${s.color}-400`}>{s.value}</div>
                    </div>
                ))}
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
                                    <div key={r.id} className="flex items-start gap-4 px-5 py-4 rounded-xl bg-[#0F1729] border border-gray-800">
                                        <Package size={16} className="text-rose-400 shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-sm text-white">{r.product?.name || r.product_name || '—'}</span>
                                                {r.product?.sku && <span className="font-mono text-xs text-gray-600">{r.product.sku}</span>}
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE[r.status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>{r.status}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5">{r.supplier?.name || r.supplier_name || '—'}{r.reason ? ` · ${r.reason}` : ''}</p>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className="text-xs text-gray-400">Current: <span className="text-white font-mono">${Number(r.current_price).toFixed(2)}</span></span>
                                                <span className="text-gray-700">→</span>
                                                <span className="text-xs text-gray-400">Requested: <span className="text-white font-mono">${Number(r.requested_price).toFixed(2)}</span></span>
                                                <span className={`text-xs font-bold ${isIncrease ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {isIncrease ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                        {r.status === 'PENDING' && (
                                            <button onClick={() => handleApprove(r.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0">
                                                <CheckCircle size={11} />Approve
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
