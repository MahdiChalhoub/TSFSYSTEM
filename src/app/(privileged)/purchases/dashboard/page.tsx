// @ts-nocheck
'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useCallback } from "react"
import { fetchPurchaseOrders, fetchPODashboard } from '@/app/actions/pos/purchases'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    RefreshCw, Clock, CheckCircle, Package, Truck,
    TrendingUp, DollarSign, AlertTriangle, BarChart3,
    Building2, FileText, ArrowRight, ShoppingBag
} from "lucide-react"
import Link from "next/link"

type PO = {
    id: number
    po_number?: string
    supplier?: { id: number; name: string }
    supplier_name?: string
    status: string
    total_amount: number
    order_date?: string
}

const PIPELINE_STAGES = [
    { key: 'SUBMITTED', label: 'Awaiting Approval', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
    { key: 'APPROVED', label: 'Approved', icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
    { key: 'ORDERED', label: 'Ordered', icon: ShoppingBag, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
    { key: 'IN_TRANSIT', label: 'In Transit', icon: Truck, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/30' },
    { key: 'PARTIALLY_RECEIVED', label: 'Partial Recv', icon: Package, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
    { key: 'RECEIVED', label: 'Received', icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
]

export default function PurchaseDashboardPage() {
    const { fmt } = useCurrency()
    const [orders, setOrders] = useState<PO[]>([])
    const [dashboard, setDashboard] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [orderData, dashData] = await Promise.all([fetchPurchaseOrders(), fetchPODashboard()])
            setOrders(Array.isArray(orderData) ? orderData : (orderData?.results ?? []))
            setDashboard(dashData)
        } catch { setOrders([]) }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    // Compute metrics from orders
    const totalSpend = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const activeCount = orders.filter(o => !['COMPLETED', 'CANCELLED', 'DRAFT'].includes(o.status)).length
    const completedCount = orders.filter(o => o.status === 'COMPLETED').length
    const overdueCount = orders.filter(o => ['SUBMITTED', 'APPROVED'].includes(o.status)).length
    const pipeline = PIPELINE_STAGES.map(s => ({ ...s, count: orders.filter(o => o.status === s.key).length, value: orders.filter(o => o.status === s.key).reduce((sum, o) => sum + Number(o.total_amount || 0), 0) }))
    const maxPipelineCount = Math.max(...pipeline.map(p => p.count), 1)

    // Recent orders (last 5)
    const recentOrders = [...orders].sort((a, b) => (b.order_date || '').localeCompare(a.order_date || '')).slice(0, 5)

    return (
        <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-[1400px] mx-auto space-y-[var(--layout-section-spacing)]">

                {/* ── Header ── */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shadow-sm">
                            <BarChart3 size={24} className="text-blue-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-4xl font-black tracking-tight theme-text">
                                Procurement <span className="text-blue-500">Dashboard</span>
                            </h1>
                            <p className="text-xs md:text-sm font-medium theme-text-muted mt-0.5 hidden sm:block">
                                Overview of purchasing activity & pipeline
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={load} className="min-h-[44px] md:min-h-[36px]">
                        <RefreshCw size={14} className="mr-1.5" /> Refresh
                    </Button>
                </header>

                {/* ── KPI Strip ── */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-[var(--layout-element-gap)]" aria-label="Dashboard metrics">
                    {[
                        { label: 'Total Spend', value: fmt(totalSpend), icon: DollarSign, accent: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
                        { label: 'Active POs', value: activeCount, icon: ShoppingBag, accent: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
                        { label: 'Completed', value: completedCount, icon: CheckCircle, accent: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
                        { label: 'Pending Approval', value: overdueCount, icon: AlertTriangle, accent: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-[var(--layout-element-gap)]">
                    {/* ── Pipeline Funnel ── */}
                    <div className="lg:col-span-2">
                        <Card className="border shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-xs font-black uppercase tracking-wider theme-text-muted flex items-center gap-2">
                                    <TrendingUp size={14} className="text-blue-500" /> Order Pipeline
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {loading ? Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="h-12 rounded-xl animate-pulse theme-surface" style={{ border: '1px solid var(--theme-border)' }} />
                                )) : pipeline.map(stage => (
                                    <div key={stage.key} className="flex items-center gap-3 p-3 rounded-xl theme-surface" style={{ border: '1px solid var(--theme-border)' }}>
                                        <div className={`w-9 h-9 rounded-lg ${stage.bg} flex items-center justify-center shrink-0`}>
                                            <stage.icon size={16} className={stage.color} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-bold theme-text">{stage.label}</span>
                                                <span className={`text-xs font-black ${stage.color}`}>{stage.count}</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-app-surface bg-app-surface overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-700 ${stage.key === 'RECEIVED' ? 'bg-emerald-400' : 'bg-blue-400'}`}
                                                    style={{ width: `${(stage.count / maxPipelineCount) * 100}%` }} />
                                            </div>
                                        </div>
                                        <span className="text-xs theme-text-muted shrink-0 hidden sm:block">{fmt(stage.value)}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Sidebar ── */}
                    <div className="space-y-4">
                        {/* Quick Nav */}
                        <Card className="border shadow-sm">
                            <CardContent className="p-4 space-y-1">
                                <h3 className="text-xs font-black theme-text-muted uppercase tracking-wider mb-2">Quick Actions</h3>
                                {[
                                    { label: 'New Purchase Order', href: '/purchases/new-order', icon: ShoppingBag },
                                    { label: 'Request Quotation', href: '/purchases/quotations', icon: FileText },
                                    { label: 'Sourcing Hub', href: '/purchases/sourcing', icon: Building2 },
                                    { label: 'Goods Receipts', href: '/purchases/receipts', icon: Package },
                                ].map(a => (
                                    <Link key={a.label} href={a.href}
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold theme-text-muted hover:theme-text transition-colors min-h-[44px]">
                                        <a.icon size={14} /> {a.label}
                                        <ArrowRight size={12} className="ml-auto opacity-30" />
                                    </Link>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Recent Orders */}
                        <Card className="border shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-xs font-black uppercase tracking-wider theme-text-muted">Recent Orders</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {loading ? Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="h-14 rounded-xl animate-pulse theme-surface" style={{ border: '1px solid var(--theme-border)' }} />
                                )) : recentOrders.length === 0 ? (
                                    <p className="text-sm theme-text-muted text-center py-4">No recent orders</p>
                                ) : recentOrders.map(o => (
                                    <Link key={o.id} href={`/purchases/${o.id}`}
                                        className="flex items-center gap-3 p-3 rounded-xl theme-surface hover:shadow-sm transition-all min-h-[52px]"
                                        style={{ border: '1px solid var(--theme-border)' }}>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-black theme-text truncate">{o.po_number || `PO-${o.id}`}</div>
                                            <div className="text-[10px] theme-text-muted truncate">{o.supplier?.name || o.supplier_name || '—'}</div>
                                        </div>
                                        <span className="text-xs font-black theme-text shrink-0">{fmt(Number(o.total_amount || 0))}</span>
                                    </Link>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </main>
    )
}
