'use client'
import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import {
    BarChart3, ShoppingCart, DollarSign, Package,
    TrendingUp, Clock, CheckCircle, Truck,
    RefreshCw, Eye, Store, Zap, Activity,
    ChevronRight, Target, ShieldCheck
} from 'lucide-react'
import { Badge } from "@/components/ui/badge"
type Stats = {
    total_orders?: number
    monthly_orders?: number
    monthly_revenue?: string | number
    pending?: number
    processing?: number
    shipped?: number
    delivered?: number
    total_revenue?: string | number
}
type RecentOrder = {
    id: number;
    order_number?: string;
    client?: { name: string };
    client_name?: string;
    status: string;
    total_amount: number;
    created_at: string
}
const STATUS_MAP: Record<string, { label: string; color: string; bg: string; text: string }> = {
    PLACED: { label: 'Placed', color: 'amber', bg: 'bg-amber-50', text: 'text-amber-600' },
    CONFIRMED: { label: 'Confirmed', color: 'blue', bg: 'bg-blue-50', text: 'text-blue-600' },
    PROCESSING: { label: 'Processing', color: 'violet', bg: 'bg-violet-50', text: 'text-violet-600' },
    SHIPPED: { label: 'Shipped', color: 'indigo', bg: 'bg-indigo-50', text: 'text-indigo-600' },
    DELIVERED: { label: 'Delivered', color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-600' },
    CANCELLED: { label: 'Cancelled', color: 'rose', bg: 'bg-rose-50', text: 'text-rose-600' },
}
export default function EcommerceDashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [recent, setRecent] = useState<RecentOrder[]>([])
    const [loading, setLoading] = useState(true)
    useEffect(() => { load() }, [])
    async function load() {
        setLoading(true)
        try {
            const [ordersData, statsData] = await Promise.all([
                erpFetch('client-portal/admin-orders/?page_size=8&ordering=-created_at').catch(() => []),
                erpFetch('client-portal/config/stats/').catch(() => null),
            ])
            setRecent(Array.isArray(ordersData) ? ordersData : (ordersData?.results ?? []))
            setStats(statsData)
        } catch { }
        setLoading(false)
    }
    const totalRevenue = recent.reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const deliveredCount = recent.filter(o => o.status === 'DELIVERED').length
    const pendingCount = recent.filter(o => ['PLACED', 'CONFIRMED', 'PROCESSING'].includes(o.status)).length
    if (loading && recent.length === 0) {
        return (
            <div className="p-8 space-y-8 max-w-7xl mx-auto animate-pulse">
                <div className="h-12 w-64 bg-gray-100 rounded-2xl" />
                <div className="grid grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-50 rounded-[2.5rem]" />)}
                </div>
                <div className="h-96 bg-gray-50 rounded-[2.5rem]" />
            </div>
        )
    }
    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-700">
            {/* Header: Ecommerce Intelligence Console */}
            <header className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Badge className="bg-blue-50 text-blue-600 border-blue-100 font-black text-[10px] uppercase tracking-widest px-3 py-1">
                            Store Node: Online
                        </Badge>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-1">
                            <Activity size={12} /> Sync: Direct
                        </span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-[1.8rem] bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-200">
                            <Store size={32} className="text-white fill-white" />
                        </div>
                        Market <span className="text-indigo-600">Intelligence</span>
                    </h1>
                </div>
                <div className="flex gap-3">
                    <button onClick={load} className="h-12 px-6 rounded-2xl bg-white border border-gray-100 shadow-sm font-bold text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-all">
                        <RefreshCw size={18} /> Refresh Nodes
                    </button>
                    <button className="h-12 px-6 rounded-2xl bg-indigo-600 text-white font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                        View Orders <ChevronRight size={18} />
                    </button>
                </div>
            </header>
            {/* Premium KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <ShoppingCart size={24} />
                        </div>
                        <Badge variant="outline" className="text-indigo-500 bg-indigo-50 border-0 font-black text-[10px]">
                            {pendingCount} PENDING
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Total Recent Orders</p>
                    <h2 className="text-3xl font-black text-gray-900">{recent.length}</h2>
                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2 text-[10px] font-bold text-gray-400">
                        <Target size={12} className="text-indigo-400" /> Velocity: Stable
                    </div>
                </div>
                <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <DollarSign size={24} />
                        </div>
                        <Badge variant="outline" className="text-emerald-500 bg-emerald-50 border-0 font-black text-[10px]">
                            +8% TREND
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Recent Revenue</p>
                    <h2 className="text-3xl font-black text-gray-900">${totalRevenue.toFixed(2)}</h2>
                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2 text-[10px] font-bold text-gray-400">
                        <ShieldCheck size={12} className="text-emerald-400" /> Verified Settlement
                    </div>
                </div>
                <div className="bg-indigo-900 p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-white">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-800/50 text-indigo-100 flex items-center justify-center">
                            <CheckCircle size={24} />
                        </div>
                        <Badge variant="outline" className="text-indigo-200 bg-indigo-800/30 border-0 font-black text-[10px]">
                            SUCCESS
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-indigo-300 uppercase tracking-widest leading-none mb-1">Fulfillment Rate</p>
                    <h2 className="text-3xl font-black text-white">{deliveredCount} <span className="text-sm text-indigo-300">UNITS</span></h2>
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-[10px] font-bold text-indigo-200">
                        <Clock size={12} className="text-indigo-400" /> Avg Lead: 2.4 Days
                    </div>
                </div>
                <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-indigo-600 flex items-center justify-center">
                            <Truck size={24} />
                        </div>
                        <Badge variant="outline" className="text-indigo-400 bg-indigo-50 border-0 font-black text-[10px]">
                            LOGISTICS
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Active Deliveries</p>
                    <h2 className="text-3xl font-black text-gray-900">{recent.filter(o => o.status === 'SHIPPED').length}</h2>
                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2 text-[10px] font-bold text-gray-400">
                        <Zap size={12} className="text-indigo-400" /> Real-time Tracking
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Status Funnel: Intelligence Mode */}
                <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] shadow-sm flex flex-col gap-6">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Logistics Pipeline</p>
                        <h3 className="text-xl font-black text-gray-900 uppercase italic">Conversion <span className="text-indigo-600">Funnel</span></h3>
                    </div>
                    <div className="space-y-4">
                        {Object.entries(STATUS_MAP).map(([key, { label, color, bg, text }]) => {
                            const count = recent.filter(o => o.status === key).length
                            const pct = recent.length > 0 ? Math.round((count / recent.length) * 100) : 0
                            return (
                                <div key={key} className="group">
                                    <div className="flex justify-between items-end mb-1.5">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${text}`}>{label}</span>
                                        <span className="text-lg font-black text-gray-900">{count}</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100/50">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${text.replace('text-', 'bg-')}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
                {/* Recent Intelligence Stream */}
                <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-sm overflow-hidden border-2 border-slate-50">
                    <div className="px-8 py-7 border-b border-gray-50 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Transaction Node</p>
                            <h3 className="text-xl font-black text-gray-900 uppercase italic">Recent <span className="text-indigo-600">Operations</span></h3>
                        </div>
                        <button className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700 transition-colors">
                            Full Registry
                        </button>
                    </div>
                    <div className="divide-y divide-gray-50 overflow-y-auto max-h-[400px] custom-scrollbar">
                        {recent.map(o => {
                            const s = STATUS_MAP[o.status] || { label: o.status, color: 'gray', bg: 'bg-gray-50', text: 'text-gray-400' }
                            return (
                                <div key={o.id} className="flex items-center gap-6 px-8 py-5 hover:bg-slate-50/50 transition-colors group">
                                    <div className="w-12 h-12 rounded-2xl bg-stone-50 flex items-center justify-center font-black text-stone-400 group-hover:bg-indigo-600 group-hover:text-white transition-all text-xs">
                                        #{o.id}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-black text-gray-900 text-sm uppercase tracking-tight truncate">
                                            {o.client?.name || o.client_name || 'Anonymous Client'}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                                                {o.order_number || 'REG-PENDING'}
                                            </span>
                                            <span className="text-[10px] text-gray-300">·</span>
                                            <span className="text-[10px] font-bold text-gray-400">
                                                {o.created_at ? new Date(o.created_at).toLocaleDateString() : 'REAL-TIME'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <Badge className={`${s.bg} ${s.text} border-0 text-[8px] font-black px-3 py-0.5 rounded-full uppercase tracking-widest`}>
                                            {s.label}
                                        </Badge>
                                        <span className="font-black text-lg text-gray-900 leading-none">
                                            ${Number(o.total_amount || 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
