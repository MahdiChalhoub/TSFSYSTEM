'use client'

import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { BarChart3, ShoppingCart, DollarSign, Package, TrendingUp, Clock, CheckCircle, Truck, RefreshCw, Eye } from 'lucide-react'

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
type RecentOrder = { id: number; order_number?: string; client?: { name: string }; client_name?: string; status: string; total_amount: number; created_at: string }

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    PLACED: { label: 'Placed', color: 'amber' },
    CONFIRMED: { label: 'Confirmed', color: 'blue' },
    PROCESSING: { label: 'Processing', color: 'violet' },
    SHIPPED: { label: 'Shipped', color: 'indigo' },
    DELIVERED: { label: 'Delivered', color: 'emerald' },
    CANCELLED: { label: 'Cancelled', color: 'red' },
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

    return (
        <div className="min-h-screen bg-[#070D1B] text-gray-100 p-6 flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/40">
                        <BarChart3 size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Storefront Overview</h1>
                        <p className="text-sm text-gray-400 mt-0.5">eCommerce performance at a glance</p>
                    </div>
                </div>
                <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm">
                    <RefreshCw size={14} />Refresh
                </button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Orders (recent)', value: loading ? '…' : recent.length, icon: ShoppingCart, color: 'blue', sub: `${pendingCount} pending` },
                    { label: 'Revenue (recent)', value: loading ? '…' : `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: 'emerald', sub: stats?.monthly_revenue ? `$${Number(stats.monthly_revenue).toFixed(0)} this month` : '' },
                    { label: 'Delivered', value: loading ? '…' : deliveredCount, icon: CheckCircle, color: 'teal', sub: `of ${recent.length} recent orders` },
                    { label: 'Shipped', value: loading ? '…' : recent.filter(o => o.status === 'SHIPPED').length, icon: Truck, color: 'indigo', sub: 'in transit' },
                ].map(k => (
                    <div key={k.label} className="bg-[#0F1729] rounded-2xl border border-gray-800 p-5">
                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-3">
                            <k.icon size={13} />
                            {k.label}
                        </div>
                        <div className={`text-2xl font-black text-${k.color}-400`}>{k.value}</div>
                        {k.sub && <p className="text-xs text-gray-600 mt-1">{k.sub}</p>}
                    </div>
                ))}
            </div>

            {/* Funnel */}
            <div className="bg-[#0F1729] rounded-2xl border border-gray-800 p-5">
                <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2"><TrendingUp size={14} className="text-blue-400" />Order Status Funnel</h3>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {Object.entries(STATUS_MAP).map(([key, { label, color }]) => {
                        const count = recent.filter(o => o.status === key).length
                        const pct = recent.length > 0 ? Math.round((count / recent.length) * 100) : 0
                        return (
                            <div key={key} className="flex flex-col items-center gap-2">
                                <div className={`w-full bg-gray-800 rounded-xl overflow-hidden`} style={{ height: 64 }}>
                                    <div className={`bg-${color}-500/40 border-t-2 border-${color}-500 w-full transition-all`} style={{ height: `${pct}%` }} />
                                </div>
                                <span className={`text-lg font-black text-${color}-400`}>{count}</span>
                                <span className="text-[10px] text-gray-600 text-center">{label}</span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Recent orders table */}
            <div className="bg-[#0F1729] rounded-2xl border border-gray-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                    <h3 className="font-semibold text-white text-sm flex items-center gap-2"><ShoppingCart size={14} className="text-blue-400" />Recent Orders</h3>
                    <a href="/ecommerce/orders" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">View all <Eye size={11} /></a>
                </div>
                {loading ? (
                    <div className="p-5 flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-gray-800/50 rounded-lg animate-pulse" />)}</div>
                ) : recent.length === 0 ? (
                    <div className="py-12 text-center text-gray-500 text-sm">No orders yet</div>
                ) : (
                    <div className="divide-y divide-gray-800/50">
                        {recent.map(o => {
                            const s = STATUS_MAP[o.status] || { label: o.status, color: 'gray' }
                            return (
                                <div key={o.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-800/30 transition-colors">
                                    <span className="font-mono text-sm text-white">{o.order_number || `#${o.id}`}</span>
                                    <span className="flex-1 text-xs text-gray-500 truncate">{o.client?.name || o.client_name || '—'}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border bg-${s.color}-900/40 text-${s.color}-400 border-${s.color}-800`}>{s.label}</span>
                                    <span className="font-mono text-sm font-bold text-white">${Number(o.total_amount || 0).toFixed(2)}</span>
                                    <span className="text-xs text-gray-600">{o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}</span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
