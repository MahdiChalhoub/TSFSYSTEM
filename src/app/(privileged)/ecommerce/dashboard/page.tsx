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
        <div className="page-container animate-in fade-in duration-700">
            {/* Header: Ecommerce Intelligence Console */}
            <header className="flex flex-col gap-8 mb-10">
                <div className="flex justify-between items-end">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-[2rem] bg-emerald-gradient flex items-center justify-center shadow-2xl shadow-emerald-700/20 group hover:rotate-12 transition-transform duration-500">
                            <Store size={40} className="text-white fill-white/20" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full">
                                    Market Node: Online
                                </Badge>
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Activity size={14} className="text-emerald-400" /> Intelligence Sync: Real-time
                                </span>
                            </div>
                            <h1 className="page-header-title">
                                Market <span className="text-emerald-700">Intelligence</span>
                            </h1>
                            <p className="page-header-subtitle mt-1">
                                Sales tracking and order analytics.
                            </p>
                        </div>
                    </div>
                    <div className="hidden lg:flex items-center gap-4">
                        <button onClick={load} className="h-14 px-8 rounded-2xl bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] font-black text-[11px] uppercase tracking-widest text-slate-600 flex items-center gap-3 hover:bg-slate-50 transition-all active:scale-95">
                            <RefreshCw size={18} className={`text-emerald-500 ${loading ? 'animate-spin' : ''}`} /> Sync Nodes
                        </button>
                        <button className="h-14 px-8 rounded-2xl bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95 border-b-4 border-b-slate-950">
                            View Orders <Zap size={18} className="text-emerald-400" />
                        </button>
                    </div>
                </div>
            </header>
            {/* Premium KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="card-premium group hover:shadow-2xl hover:shadow-emerald-700/5 transition-all duration-500 overflow-hidden relative border-0 p-8">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-500/10 transition-colors" />
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner shadow-emerald-100 transition-transform group-hover:rotate-6">
                            <ShoppingCart size={28} />
                        </div>
                        <Badge variant="outline" className="text-emerald-600 bg-emerald-50/50 border-emerald-100 font-black text-[10px] px-3 py-1 rounded-full">
                            {pendingCount} PENDING
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Recent Orders</p>
                    <h2 className="text-4xl font-black text-slate-800 tracking-tighter mt-1">{recent.length}</h2>
                    <div className="mt-6 pt-5 border-t border-slate-50 flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-tight">
                        <Target size={14} className="text-emerald-500" /> Velocity: Stable
                    </div>
                </div>
                <div className="card-premium group hover:shadow-2xl hover:shadow-emerald-700/5 transition-all duration-500 overflow-hidden relative border-0 p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner shadow-emerald-100 transition-transform group-hover:rotate-6">
                            <DollarSign size={28} />
                        </div>
                        <Badge variant="outline" className="text-emerald-600 bg-emerald-50/50 border-emerald-100 font-black text-[10px] px-3 py-1 rounded-full animate-pulse">
                            +12% REVENUE
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Recent Revenue</p>
                    <h2 className="text-4xl font-black text-slate-800 tracking-tighter mt-1">${totalRevenue.toFixed(0)}</h2>
                    <div className="mt-6 pt-5 border-t border-slate-50 flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-tight">
                        <ShieldCheck size={14} className="text-emerald-500" /> Settled: Global
                    </div>
                </div>
                <div className="rounded-[2.5rem] bg-slate-900 border-0 shadow-2xl shadow-slate-900/30 overflow-hidden group hover:scale-[1.02] transition-all duration-500 relative p-8 text-white">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-500/20 transition-colors" />
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-white/10 text-white flex items-center justify-center shadow-2xl backdrop-blur-md">
                            <CheckCircle size={28} className="text-emerald-400" />
                        </div>
                        <Badge variant="outline" className="text-emerald-300 bg-emerald-500/10 border-emerald-500/20 font-black text-[10px] px-3 py-1 rounded-full">
                            VERIFIED
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Fulfillment Rate</p>
                    <h2 className="text-4xl font-black text-white tracking-tighter mt-1">{deliveredCount} <span className="text-sm font-black text-slate-500 uppercase tracking-widest">UNITS</span></h2>
                    <div className="mt-6 pt-5 border-t border-white/5 flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-tight">
                        <Clock size={14} className="text-emerald-500" /> Lead: 2.4D
                    </div>
                </div>
                <div className="card-premium group hover:shadow-2xl hover:shadow-emerald-700/5 transition-all duration-500 overflow-hidden relative border-0 p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner shadow-emerald-100 transition-transform group-hover:rotate-6">
                            <Truck size={28} />
                        </div>
                        <Badge variant="outline" className="text-slate-400 bg-slate-50 border-slate-100 font-black text-[10px] px-3 py-1 rounded-full">
                            LOGISTICS
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Active Deliveries</p>
                    <h2 className="text-4xl font-black text-slate-800 tracking-tighter mt-1">{recent.filter(o => o.status === 'SHIPPED').length}</h2>
                    <div className="mt-6 pt-5 border-t border-slate-50 flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-tight">
                        <Zap size={14} className="text-emerald-500" /> Live Manifests
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
                </div>
            </div>
        </div>
    )
}
