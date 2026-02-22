'use client'

import { useState, useEffect, useCallback } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { ShoppingCart, Clock, CheckCircle, Truck, Package, Search, RefreshCw, ChevronRight, Circle, XCircle, DollarSign } from 'lucide-react'

type Order = {
    id: number
    order_number?: string
    client?: { name: string }
    client_name?: string
    status: string
    total_amount: number
    created_at: string
    items_count?: number
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    PLACED: { label: 'Placed', color: 'amber', icon: Clock },
    CONFIRMED: { label: 'Confirmed', color: 'blue', icon: CheckCircle },
    PROCESSING: { label: 'Processing', color: 'violet', icon: RefreshCw },
    SHIPPED: { label: 'Shipped', color: 'indigo', icon: Truck },
    DELIVERED: { label: 'Delivered', color: 'emerald', icon: CheckCircle },
    CANCELLED: { label: 'Cancelled', color: 'red', icon: XCircle },
}

const FILTERS = ['ALL', 'PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']

export default function EcommerceOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('ALL')
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Order | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const params = filter !== 'ALL' ? `?status=${filter}` : ''
            const data = await erpFetch(`client-portal/admin-orders/${params}`)
            setOrders(Array.isArray(data) ? data : (data?.results ?? []))
        } catch { setOrders([]) }
        setLoading(false)
    }, [filter])

    useEffect(() => { load() }, [load])

    const filtered = orders.filter(o => {
        const q = search.toLowerCase()
        return !q || o.order_number?.toLowerCase().includes(q) || o.client?.name?.toLowerCase().includes(q) || o.client_name?.toLowerCase().includes(q)
    })

    const stats: Record<string, number> = {}
    orders.forEach(o => { stats[o.status] = (stats[o.status] || 0) + 1 })

    return (
        <div className="min-h-screen bg-[#070D1B] text-gray-100 p-6 flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-900/40">
                        <ShoppingCart size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-[1.5rem] bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                                <ShoppingCart size={28} className="text-white" />
                            </div>
                            Online <span className="text-blue-600">Orders</span>
                        </h1>
                        <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">E-Commerce Orders</p>
                    </div>
                </div>
                <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm">
                    <RefreshCw size={14} />Refresh
                </button>
            </div>

            {/* Status summary */}
            <div className="flex gap-3 overflow-x-auto pb-1">
                {Object.entries(STATUS_MAP).map(([key, { label, color }]) => (
                    <div key={key} className={`shrink-0 bg-[#0F1729] border border-gray-800 rounded-2xl px-4 py-3 flex flex-col gap-0.5`}>
                        <span className={`text-xl font-black text-${color}-400`}>{stats[key] || 0}</span>
                        <span className="text-xs text-gray-500">{label}</span>
                    </div>
                ))}
            </div>

            {/* Filters + search */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by order or client…"
                        className="w-full pl-9 pr-4 py-2 bg-[#0F1729] border border-gray-800 rounded-xl text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-700"
                    />
                </div>
                <div className="flex gap-1 bg-[#0F1729] rounded-2xl border border-gray-800 p-1 flex-wrap">
                    {FILTERS.map(f => (
                        <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${filter === f ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                            {f === 'ALL' ? 'All' : STATUS_MAP[f]?.label || f}
                            {f !== 'ALL' && stats[f] ? <span className="ml-1.5 opacity-70">{stats[f]}</span> : null}
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders list */}
            <div className="flex gap-5">
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                    {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />) :
                        filtered.length === 0 ? (
                            <div className="bg-[#0F1729] rounded-2xl border border-gray-800 py-16 flex flex-col items-center gap-3 text-gray-500">
                                <ShoppingCart size={48} className="opacity-20" />
                                <p className="text-sm">No orders {filter !== 'ALL' ? `with status "${STATUS_MAP[filter]?.label}"` : ''}</p>
                            </div>
                        ) : (
                            filtered.map(o => {
                                const s = STATUS_MAP[o.status] || { label: o.status, color: 'gray', icon: Circle }
                                const Icon = s.icon
                                return (
                                    <button key={o.id} onClick={() => setSelected(selected?.id === o.id ? null : o)} className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all ${selected?.id === o.id ? 'bg-indigo-900/20 border-indigo-800/50' : 'bg-[#0F1729] border-gray-800 hover:border-gray-700'}`}>
                                        <Icon size={16} className={`text-${s.color}-400 shrink-0`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-semibold text-sm text-white">{o.order_number || `#${o.id}`}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border bg-${s.color}-900/40 text-${s.color}-400 border-${s.color}-800`}>{s.label}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5 truncate">{o.client?.name || o.client_name || '—'}{o.created_at ? ` · ${new Date(o.created_at).toLocaleDateString()}` : ''}</p>
                                        </div>
                                        <div className="text-sm font-bold font-mono text-white shrink-0">${Number(o.total_amount || 0).toFixed(2)}</div>
                                        <ChevronRight size={14} className="text-gray-600 shrink-0" />
                                    </button>
                                )
                            })
                        )
                    }
                </div>

                {/* Detail panel */}
                {selected && (
                    <div className="w-72 shrink-0 bg-[#0F1729] rounded-2xl border border-gray-800 p-5 flex flex-col gap-4 h-fit sticky top-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-white text-sm">Order Detail</h3>
                            <button onClick={() => setSelected(null)} className="text-gray-600 hover:text-gray-400 text-xs">✕</button>
                        </div>
                        <div className="flex flex-col gap-2 text-xs">
                            <div className="flex justify-between"><span className="text-gray-500">Order #</span><span className="font-mono text-white">{selected.order_number || `#${selected.id}`}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Client</span><span className="text-white">{selected.client?.name || selected.client_name || '—'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`font-bold text-${(STATUS_MAP[selected.status] || {}).color || 'gray'}-400`}>{STATUS_MAP[selected.status]?.label || selected.status}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-mono font-bold text-white">${Number(selected.total_amount || 0).toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="text-white">{selected.created_at ? new Date(selected.created_at).toLocaleDateString() : '—'}</span></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
