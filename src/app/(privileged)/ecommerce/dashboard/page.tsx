'use client'
import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import {
    BarChart3, ShoppingCart, DollarSign, TrendingUp,
    RefreshCw, Package, CheckCircle, XCircle, Clock,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────
interface StatsSummary {
    gmv: string
    orders_count: number
    aov: string
    paid_count: number
    cancelled_count: number
    pending_payment_count: number
}
interface SeriesPoint { date: string; gmv: string; orders_count: number }
interface TopProduct { product_id: number; name: string; revenue: string; qty_sold: string; orders_count: number }
interface ByStatus { [key: string]: number }
interface StatsPayload {
    period: { from: string; to: string; grouping: string }
    summary: StatsSummary
    by_status: ByStatus
    top_products: TopProduct[]
    series: SeriesPoint[]
}

const STATUS_COLOR: Record<string, string> = {
    PLACED: 'bg-amber-400', CONFIRMED: 'bg-sky-400', PROCESSING: 'bg-violet-400',
    SHIPPED: 'bg-indigo-400', DELIVERED: 'bg-emerald-400', CANCELLED: 'bg-rose-400',
    RETURNED: 'bg-slate-400',
}

// ── KPI Card ──────────────────────────────────────────────────────────────
function KPI({ label, value, sub, icon: Icon, accent = false }: {
    label: string; value: string; sub?: string; icon: React.ElementType; accent?: boolean
}) {
    return (
        <div className={`app-card flex flex-col gap-2 ${accent ? 'border-[var(--app-accent)]/40' : ''}`}>
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[var(--app-text-muted)] uppercase tracking-wider">{label}</p>
                <Icon size={16} className={accent ? 'text-[var(--app-accent)]' : 'text-[var(--app-text-muted)]'} />
            </div>
            <p className={`text-2xl font-bold ${accent ? 'text-[var(--app-accent)]' : 'text-[var(--app-text)]'}`}>{value}</p>
            {sub && <p className="text-xs text-[var(--app-text-muted)]">{sub}</p>}
        </div>
    )
}

// ── Mini Bar Chart (CSS-only) ──────────────────────────────────────────────
function MiniBarChart({ series }: { series: SeriesPoint[] }) {
    if (!series.length) return <p className="text-xs text-[var(--app-text-muted)] p-4">No data</p>
    const maxGmv = Math.max(...series.map(s => parseFloat(s.gmv) || 0), 1)
    return (
        <div className="flex items-end gap-0.5 h-20 w-full px-1">
            {series.map((pt, i) => {
                const pct = Math.max(4, (parseFloat(pt.gmv) / maxGmv) * 100)
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative" title={`${pt.date}: ${parseFloat(pt.gmv).toLocaleString()}`}>
                        <div className="w-full rounded-t transition-all duration-300 group-hover:opacity-80 bg-[var(--app-accent)]"
                            style={{ height: `${pct}%` }} />
                    </div>
                )
            })}
        </div>
    )
}

// ── Dashboard ─────────────────────────────────────────────────────────────
export default function EcommerceDashboardPage() {
    const [stats, setStats] = useState<StatsPayload | null>(null)
    const [period, setPeriod] = useState('30')  // days lookback
    const [loading, setLoading] = useState(true)

    const load = async () => {
        setLoading(true)
        try {
            const to = new Date().toISOString().slice(0, 10)
            const from = new Date(Date.now() - +period * 86400_000).toISOString().slice(0, 10)
            const data = await erpFetch(`ecommerce/orders/stats/?from=${from}&to=${to}&period=daily`)
            if (data && data.summary) setStats(data)
        } catch { }
        setLoading(false)
    }

    useEffect(() => { load() }, [period])

    const fmt = (v: string | number) => parseFloat(String(v)).toLocaleString(undefined, { maximumFractionDigits: 0 })

    return (
        <div className="app-page space-y-6">
            {/* Header */}
            <div className="app-page-header">
                <div>
                    <h1 className="app-page-title">eCommerce Analytics</h1>
                    <p className="app-page-subtitle">
                        {stats?.period ? `${stats.period.from} → ${stats.period.to}` : 'Loading…'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        className="app-input text-sm w-36"
                        value={period}
                        onChange={e => setPeriod(e.target.value)}
                        id="dashboard-period"
                    >
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="365">Last 12 months</option>
                    </select>
                    <button
                        onClick={load}
                        className="app-btn app-btn-ghost"
                        disabled={loading}
                        id="dashboard-refresh"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPI label="GMV" icon={DollarSign} accent
                    value={stats ? fmt(stats.summary.gmv) : '—'}
                    sub="Gross Merchandise Volume" />
                <KPI label="Orders" icon={ShoppingCart}
                    value={stats ? String(stats.summary.orders_count) : '—'}
                    sub={stats ? `${stats.summary.paid_count} paid` : ''} />
                <KPI label="Avg Order Value" icon={TrendingUp}
                    value={stats ? fmt(stats.summary.aov) : '—'}
                    sub="Per placed order" />
                <KPI label="Cancelled" icon={XCircle}
                    value={stats ? String(stats.summary.cancelled_count) : '—'}
                    sub={stats ? `${stats.summary.pending_payment_count} pending payment` : ''} />
            </div>

            {/* GMV Trend + Status Funnel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* GMV Trend */}
                <div className="lg:col-span-2 app-card space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[var(--app-text)]">GMV Trend</p>
                        <p className="text-xs text-[var(--app-text-muted)]">Daily · {stats?.series.length ?? 0} points</p>
                    </div>
                    <MiniBarChart series={stats?.series ?? []} />
                    <div className="flex justify-between text-xs text-[var(--app-text-muted)] px-1">
                        <span>{stats?.period.from}</span>
                        <span>{stats?.period.to}</span>
                    </div>
                </div>

                {/* Status Funnel */}
                <div className="app-card space-y-3">
                    <p className="text-sm font-semibold text-[var(--app-text)]">Order Pipeline</p>
                    <div className="space-y-2">
                        {stats && Object.entries(stats.by_status).map(([status, count]) => {
                            const total = stats.summary.orders_count || 1
                            const pct = Math.round((count / total) * 100)
                            return (
                                <div key={status}>
                                    <div className="flex justify-between text-xs mb-0.5">
                                        <span className="text-[var(--app-text-muted)]">{status}</span>
                                        <span className="font-semibold text-[var(--app-text)]">{count}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[var(--app-border)] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${STATUS_COLOR[status] ?? 'bg-[var(--app-accent)]'}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                        {!stats && <p className="text-xs text-[var(--app-text-muted)]">Loading…</p>}
                    </div>
                </div>
            </div>

            {/* Top Products */}
            {stats && stats.top_products.length > 0 && (
                <div className="app-card">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold text-[var(--app-text)]">Top Products by Revenue</p>
                        <Package size={14} className="text-[var(--app-text-muted)]" />
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--app-border)] text-[var(--app-text-muted)]">
                                <th className="text-left pb-2">#</th>
                                <th className="text-left pb-2">Product</th>
                                <th className="text-right pb-2">Revenue</th>
                                <th className="text-right pb-2">Units</th>
                                <th className="text-right pb-2">Orders</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.top_products.map((p, i) => (
                                <tr key={p.product_id} className="border-b border-[var(--app-border)]">
                                    <td className="py-2 text-[var(--app-text-muted)] text-xs">{i + 1}</td>
                                    <td className="py-2 text-[var(--app-text)] font-medium">{p.name}</td>
                                    <td className="py-2 text-right font-semibold text-[var(--app-text)]">{fmt(p.revenue)}</td>
                                    <td className="py-2 text-right text-[var(--app-text-muted)]">{fmt(p.qty_sold)}</td>
                                    <td className="py-2 text-right text-[var(--app-text-muted)]">{p.orders_count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
