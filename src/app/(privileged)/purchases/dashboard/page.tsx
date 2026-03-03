// @ts-nocheck
'use client'
import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    ShoppingCart, Package, DollarSign, Clock,
    CheckCircle, AlertCircle, Truck, RefreshCw,
    ArrowUpRight, Activity, Plus, Zap, AlertTriangle,
    Building, TrendingDown, ShieldAlert, ChevronRight,
    RotateCcw, ShoppingBag
} from "lucide-react"
import { TypicalListView } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import Link from 'next/link'

const STATUS_CONFIG = {
    DRAFT: { label: 'Draft', color: 'bg-app-surface-2 text-app-muted-foreground border-app-border' },
    SUBMITTED: { label: 'Submitted', color: 'bg-sky-50 text-sky-700 border-sky-200' },
    APPROVED: { label: 'Approved', color: 'bg-app-info-bg text-app-info border-app-info' },
    ORDERED: { label: 'Ordered', color: 'bg-violet-50 text-app-primary border-violet-200' },
    CONFIRMED: { label: 'Confirmed', color: 'bg-app-info-bg text-app-info border-app-info/30' },
    IN_TRANSIT: { label: 'In Transit', color: 'bg-app-warning-bg text-app-warning border-app-warning' },
    PARTIALLY_RECEIVED: { label: 'Partial', color: 'bg-orange-50 text-orange-700 border-orange-200' },
    RECEIVED: { label: 'Received', color: 'bg-app-primary-light text-app-success border-app-success' },
    COMPLETED: { label: 'Completed', color: 'bg-app-primary-light text-app-success border-app-success/30' },
    REJECTED: { label: 'Rejected', color: 'bg-rose-50 text-rose-700 border-rose-200' },
    CANCELLED: { label: 'Cancelled', color: 'bg-rose-50 text-rose-700 border-rose-100' },
}

const PIPELINE_STAGES = [
    { key: 'SUBMITTED', label: 'Awaiting Approval', icon: Clock, color: 'var(--app-muted-foreground)' },
    { key: 'APPROVED', label: 'Approved', icon: CheckCircle, color: 'var(--app-info)' },
    { key: 'IN_TRANSIT', label: 'In Transit', icon: Truck, color: 'var(--app-warning)' },
    { key: 'PARTIALLY_RECEIVED', label: 'Partial', icon: Package, color: '#f97316' },
    { key: 'RECEIVED', label: 'Received', icon: CheckCircle, color: 'var(--app-success)' },
]

export default function PurchaseDashboardPage() {
    const { fmt } = useCurrency()
    const [orders, setOrders] = useState([])
    const [replenishments, setReplenishments] = useState([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState(null)
    const settings = useListViewSettings('purch_dashboard', {
        columns: ['ref_code', 'created_at', 'supplier_name', 'status', 'payment_method', 'total_amount'],
        pageSize: 15, sortKey: 'created_at', sortDir: 'desc'
    })

    useEffect(() => { loadAll() }, [])

    async function loadAll() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const [poData, repl] = await Promise.all([
                erpFetch('pos/purchase/').catch(() => []),
                erpFetch('pos/purchase/?status=DRAFT').catch(() => []),
            ])
            setOrders(Array.isArray(poData) ? poData : poData?.results || [])
            setReplenishments((Array.isArray(repl) ? repl : repl?.results || []).filter(p => p.notes?.includes('auto') || p.ref_code?.includes('AUTO')))
        } catch {
            toast.error("Failed to load procurement data")
        } finally {
            setLoading(false)
        }
    }

    const filteredOrders = useMemo(() => {
        if (!statusFilter) return orders
        return orders.filter(o => o.status === statusFilter)
    }, [orders, statusFilter])

    const stats = useMemo(() => {
        const total = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0)
        const completed = orders.filter(o => ['COMPLETED', 'RECEIVED'].includes(o.status)).reduce((s, o) => s + parseFloat(o.total_amount || 0), 0)
        const pending = orders.filter(o => ['SUBMITTED', 'APPROVED', 'ORDERED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(o.status)).reduce((s, o) => s + parseFloat(o.total_amount || 0), 0)
        const cancelled = orders.filter(o => o.status === 'CANCELLED').length
        const rejected = orders.filter(o => o.status === 'REJECTED').length
        const failureRate = orders.length > 0 ? Math.round(((cancelled + rejected) / orders.length) * 100) : 0

        const supplierMap = {}
        orders.forEach(o => {
            const name = o.supplier_name || o.contact_name || 'Unknown'
            if (!supplierMap[name]) supplierMap[name] = { name, total: 0, count: 0, failures: 0 }
            supplierMap[name].total += parseFloat(o.total_amount || 0)
            supplierMap[name].count += 1
            if (['CANCELLED', 'REJECTED'].includes(o.status)) supplierMap[name].failures += 1
        })
        const topSuppliers = Object.values(supplierMap)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5)

        return { total, completed, pending, count: orders.length, failureRate, cancelled, rejected, topSuppliers }
    }, [orders])

    const pipelineCounts = useMemo(() => {
        const counts = {}
        PIPELINE_STAGES.forEach(s => { counts[s.key] = orders.filter(o => o.status === s.key).length })
        return counts
    }, [orders])

    const columns = useMemo(() => [
        {
            key: 'ref_code', label: 'Order #',
            render: (o) => (
                <span className="font-mono text-[10px] font-black tracking-[0.1em] text-app-primary bg-app-primary-light px-2.5 py-1 rounded-full border border-app-success/30">
                    {o.ref_code || o.po_number || `PO-${o.id}`}
                </span>
            )
        },
        {
            key: 'created_at', label: 'Date', sortable: true,
            render: (o) => <span className="text-xs font-bold text-app-muted-foreground">
                {o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR') : '—'}
            </span>
        },
        {
            key: 'supplier_name', label: 'Supplier',
            render: (o) => (
                <div className="app-page flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-app-background border border-app-border flex items-center justify-center">
                        <Building size={12} className="text-app-muted-foreground" />
                    </div>
                    <span className="text-sm font-semibold text-app-foreground truncate max-w-[140px]">
                        {o.supplier_name || o.contact_name || 'Unknown'}
                    </span>
                </div>
            )
        },
        {
            key: 'status', label: 'Status',
            render: (o) => (
                <span className={`text-[9px] font-black uppercase tracking-widest border px-2.5 py-0.5 rounded-full ${STATUS_CONFIG[o.status]?.color || 'bg-app-background text-app-muted-foreground border-app-border'}`}>
                    {STATUS_CONFIG[o.status]?.label || o.status}
                </span>
            )
        },
        {
            key: 'total_amount', label: 'Total', align: 'right',
            render: (o) => <span className="font-black text-app-foreground">{fmt(parseFloat(o.total_amount || 0))}</span>
        }
    ], [fmt])

    if (loading && orders.length === 0) {
        return (
            <div className="p-6 space-y-6 max-w-7xl mx-auto">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-96 rounded-2xl" />
            </div>
        )
    }

    return (
        <div className="page-container animate-in fade-in duration-700 space-y-6">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <BarChart3 size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Procurement</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Procurement <span className="text-app-primary">Dashboard</span>
          </h1>
        </div>
      </div>
    </header>

            {/* ── KPI Cards ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Spend', value: fmt(stats.total), sub: `${stats.count} orders`, icon: DollarSign, accent: 'var(--app-success)' },
                    { label: 'Completed', value: fmt(stats.completed), sub: 'Received / Settled', icon: CheckCircle, accent: 'var(--app-info)' },
                    { label: 'In Pipeline', value: fmt(stats.pending), sub: 'Active purchase value', icon: Truck, accent: 'var(--app-warning)' },
                    { label: 'Failure Rate', value: `${stats.failureRate}%`, sub: `${stats.cancelled + stats.rejected} orders failed`, icon: ShieldAlert, accent: stats.failureRate > 10 ? '#ef4444' : 'var(--app-muted-foreground)', badge: stats.failureRate > 10 ? 'HIGH RISK' : undefined },
                ].map((kpi, i) => (
                    <div key={i} className="bg-app-surface border border-app-border rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: kpi.accent + '18' }}>
                                <kpi.icon size={18} style={{ color: kpi.accent }} />
                            </div>
                            {kpi.badge && (
                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border bg-rose-50 text-rose-600 border-rose-200">
                                    {kpi.badge}
                                </span>
                            )}
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">{kpi.label}</p>
                            <p className="text-2xl font-black text-app-foreground tracking-tight mt-1">{kpi.value}</p>
                        </div>
                        <p className="text-[10px] text-app-muted-foreground font-medium border-t border-app-border pt-2">{kpi.sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Pipeline Status Bar ──────────────────────────────────────── */}
            <div className="bg-app-surface border border-app-border rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-4 flex items-center gap-2">
                    <Zap size={12} className="text-app-warning" /> Procurement Pipeline
                </p>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {PIPELINE_STAGES.map((stage, i) => {
                        const count = pipelineCounts[stage.key] || 0
                        const Icon = stage.icon
                        return (
                            <div key={stage.key} className="flex items-center gap-2">
                                <button
                                    onClick={() => setStatusFilter(f => f === stage.key ? null : stage.key)}
                                    className="flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition-all"
                                    style={{
                                        background: statusFilter === stage.key ? stage.color + '15' : 'var(--app-background)',
                                        borderColor: statusFilter === stage.key ? stage.color : 'var(--app-border)',
                                    }}
                                >
                                    <Icon size={14} style={{ color: stage.color }} />
                                    <span className="text-[10px] font-black uppercase tracking-tight whitespace-nowrap" style={{ color: count > 0 ? stage.color : 'var(--app-muted-foreground)' }}>
                                        {count}
                                    </span>
                                    <span className="text-[9px] text-app-muted-foreground font-medium whitespace-nowrap">{stage.label}</span>
                                </button>
                                {i < PIPELINE_STAGES.length - 1 && <ChevronRight size={14} className="text-app-border flex-shrink-0" />}
                            </div>
                        )
                    })}
                    {statusFilter && (
                        <button onClick={() => setStatusFilter(null)} className="flex-shrink-0 ml-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase text-app-muted-foreground hover:text-app-foreground border border-dashed border-app-border transition-all">
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* ── Supplier Leaderboard + Replenishment Queue ─────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Supplier Leaderboard */}
                <div className="bg-app-surface border border-app-border rounded-2xl p-5 space-y-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Top Suppliers</p>
                        <h3 className="text-lg font-black text-app-foreground mt-0.5">Supplier Ranking</h3>
                    </div>
                    <div className="space-y-3">
                        {stats.topSuppliers.length === 0 ? (
                            <div className="py-8 text-center">
                                <Building size={32} className="text-app-border mx-auto mb-2" />
                                <p className="text-xs text-app-muted-foreground">No supplier data yet</p>
                            </div>
                        ) : stats.topSuppliers.map((s, i) => {
                            const failRate = Math.round((s.failures / s.count) * 100)
                            return (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-app-background border border-app-border flex items-center justify-center text-[9px] font-black text-app-muted-foreground flex-shrink-0">
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold text-app-foreground truncate">{s.name}</span>
                                            <span className="text-xs font-black text-app-primary ml-2 flex-shrink-0">{fmt(s.total)}</span>
                                        </div>
                                        <div className="h-1.5 bg-app-background rounded-full overflow-hidden">
                                            <div className="h-full bg-app-primary rounded-full" style={{ width: `${(s.total / (stats.topSuppliers[0]?.total || 1)) * 100}%` }} />
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] text-app-muted-foreground">{s.count} orders</span>
                                            {failRate > 0 && (
                                                <span className="text-[9px] text-rose-500 font-bold flex items-center gap-0.5">
                                                    <AlertTriangle size={9} /> {failRate}% fail
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Auto Replenishment Queue */}
                <div className="lg:col-span-2 bg-app-surface border border-app-border rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground flex items-center gap-2">
                                <RotateCcw size={11} className="text-app-primary" /> Min/Max Engine
                            </p>
                            <h3 className="text-lg font-black text-app-foreground mt-0.5">Auto-Replenishment Queue</h3>
                        </div>
                        <Link href="/purchases/purchase-orders">
                            <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-app-muted-foreground hover:text-app-primary">
                                All POs <ArrowUpRight size={12} className="ml-1" />
                            </Button>
                        </Link>
                    </div>

                    {replenishments.length === 0 ? (
                        <div className="py-10 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-app-primary-light border border-app-success/30 flex items-center justify-center mx-auto mb-3">
                                <CheckCircle size={28} className="text-app-primary" />
                            </div>
                            <p className="text-sm font-black text-app-foreground">Stock Levels OK</p>
                            <p className="text-xs text-app-muted-foreground mt-1">No auto-replenishment orders pending from the Min/Max engine.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {replenishments.slice(0, 6).map((po) => (
                                <div key={po.id} className="flex items-center gap-3 p-3 bg-app-warning-bg/60 border border-app-warning/30 rounded-xl">
                                    <div className="w-8 h-8 rounded-lg bg-app-warning-bg flex items-center justify-center flex-shrink-0">
                                        <AlertCircle size={15} className="text-app-warning" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-app-foreground truncate">{po.supplier_name || 'Auto-Generated PO'}</p>
                                        <p className="text-[10px] text-app-warning font-medium">{po.po_number || `PO-${po.id}`} · {fmt(parseFloat(po.total_amount || 0))}</p>
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-app-warning-bg text-app-warning flex-shrink-0">DRAFT</span>
                                </div>
                            ))}
                            {replenishments.length > 6 && (
                                <p className="text-center text-xs text-app-muted-foreground pt-1">+{replenishments.length - 6} more pending orders</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Full Orders Table ─────────────────────────────────────── */}
            <TypicalListView
                title="Purchase Orders"
                data={filteredOrders}
                loading={loading}
                getRowId={(o) => o.id}
                columns={columns}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={settings.setSort}
                className="rounded-2xl"
                headerExtra={
                    <div className="flex items-center gap-1 bg-app-background p-1 rounded-xl border border-app-border flex-wrap">
                        <button
                            onClick={() => setStatusFilter(null)}
                            className={`h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${!statusFilter ? 'bg-app-surface shadow text-app-primary' : 'text-app-muted-foreground hover:text-app-foreground'}`}
                        >
                            All ({orders.length})
                        </button>
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                            const count = orders.filter(o => o.status === key).length
                            if (count === 0) return null
                            return (
                                <button
                                    key={key}
                                    onClick={() => setStatusFilter(f => f === key ? null : key)}
                                    className={`h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${statusFilter === key ? 'bg-app-surface shadow text-app-primary' : 'text-app-muted-foreground hover:text-app-foreground'}`}
                                >
                                    {cfg.label} ({count})
                                </button>
                            )
                        })}
                    </div>
                }
            />
        </div>
    )
}
