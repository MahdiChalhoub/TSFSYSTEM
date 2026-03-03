'use client'

/**
 * Sales Analytics — V2 themed rebuild
 * Full --app-* theming via CSS vars. No hardcoded colors.
 */

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect } from 'react'
import type { SalesAnalyticsData } from '@/types/erp'
import { getSalesAnalytics } from '@/app/actions/pos/sales-analytics'
import { toast } from 'sonner'
import {
 BarChart3, DollarSign, TrendingUp, ShoppingCart, Users,
 Package, CreditCard, Building2, Loader2
} from 'lucide-react'

// ── Themed KPI Card ──────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, accent }: {
 icon: React.ElementType
 label: string
 value: string
 accent?: string
}) {
 return (
 <div
 className="app-glass rounded-2xl p-5 flex items-center gap-4"
 style={{ border: '1px solid var(--app-border)' }}
 >
 <div
 className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
 style={{ background: accent ? `${accent}22` : 'var(--app-primary)/10' }}
 >
 <Icon size={20} style={{ color: accent ?? 'var(--app-primary)' }} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
 {label}
 </p>
 <p className="text-lg font-black tracking-tight leading-tight" style={{ color: 'var(--app-foreground)' }}>
 {value}
 </p>
 </div>
 </div>
 )
}

// ── Progress bar row ─────────────────────────────────────────────
function ProgressRow({ label, sub, value, pct }: { label: string; sub?: string; value: string; pct: number }) {
 return (
 <div className="app-page space-y-1">
 <div className="flex items-center justify-between">
 <div>
 <span className="text-sm font-semibold" style={{ color: 'var(--app-foreground)' }}>{label}</span>
 {sub && <span className="text-[10px] ml-2" style={{ color: 'var(--app-muted-foreground)' }}>{sub}</span>}
 </div>
 <span className="text-sm font-black" style={{ color: 'var(--app-primary)' }}>{value}</span>
 </div>
 <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--app-border)' }}>
 <div
 className="h-full rounded-full transition-all duration-500"
 style={{ width: `${Math.min(pct, 100)}%`, background: 'var(--app-primary)' }}
 />
 </div>
 </div>
 )
}

const PAYMENT_ICONS: Record<string, string> = {
 CASH: '💵', CARD: '💳', MOBILE: '📱', TRANSFER: '🏦', CHECK: '📝', CREDIT: '🧾'
}

export default function SalesAnalyticsPage() {
 const { fmt } = useCurrency()
 const [data, setData] = useState<SalesAnalyticsData | null>(null)
 const [loading, setLoading] = useState(true)
 const [period, setPeriod] = useState(30)

 useEffect(() => { loadData() }, [period])

 async function loadData() {
 setLoading(true)
 try {
 const result = await getSalesAnalytics(period)
 setData(result)
 } catch {
 toast.error('Failed to load sales analytics')
 } finally {
 setLoading(false)
 }
 }

 if (loading) {
 return (
 <div className="page-container flex flex-col items-center justify-center min-h-[60vh]">
 <Loader2 size={32} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
 <p className="text-sm mt-3 font-medium" style={{ color: 'var(--app-muted-foreground)' }}>Loading analytics…</p>
 </div>
 )
 }

 if (!data) return null

 const { overall, top_products, top_customers, daily_trend, payment_methods, site_performance } = data

 return (
 <div className="page-container">
 {/* Header */}
 <header className="flex items-center justify-between mb-8">
 <div className="flex items-center gap-4">
 <div
 className="w-14 h-14 rounded-[1.5rem] flex items-center justify-center shadow-lg"
 style={{ background: 'var(--app-primary)', boxShadow: 'var(--app-glow)' }}
 >
 <BarChart3 size={26} className="text-app-foreground" />
 </div>
 <div>
 <h1 className="page-header-title">
 Sales <span style={{ color: 'var(--app-primary)' }}>Analytics</span>
 </h1>
 <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
 {data.period?.start} → {data.period?.end}
 </p>
 </div>
 </div>

 {/* Period selector */}
 <div
 className="flex gap-0.5 p-1 rounded-xl"
 style={{ background: 'var(--app-surface-2)', border: '1px solid var(--app-border)' }}
 >
 {[7, 30, 90].map(d => (
 <button
 key={d}
 onClick={() => setPeriod(d)}
 className="px-4 py-1.5 rounded-lg text-xs font-black transition-all"
 style={
 period === d
 ? { background: 'var(--app-primary)', boxShadow: 'var(--app-glow)' }
 : { color: 'var(--app-muted-foreground)' }
 }
 >
 {d}d
 </button>
 ))}
 </div>
 </header>

 {/* KPI Row 1 */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
 <KpiCard icon={DollarSign} label="Revenue TTC" value={fmt(overall.revenue)} />
 <KpiCard icon={ShoppingCart} label="Orders" value={String(overall.orders)} />
 <KpiCard icon={TrendingUp} label="Avg Order" value={fmt(overall.avg_order)} />
 <KpiCard icon={DollarSign} label="Tax Collected" value={fmt(overall.tax)} />
 </div>

 {/* KPI Row 2 — Margin (only if COGS available) */}
 {(overall as any).cogs !== undefined && (
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
 <KpiCard icon={Package} label="COGS" value={fmt((overall as any).cogs)} />
 <div
 className="app-glass rounded-2xl p-5 col-span-2 flex items-center justify-between"
 style={{ border: '1px solid var(--app-border)' }}
 >
 <div className="flex items-center gap-4">
 <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--app-primary)/10' }}>
 <TrendingUp size={20} style={{ color: 'var(--app-primary)' }} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Gross Margin</p>
 <p className="text-lg font-black" style={{ color: 'var(--app-foreground)' }}>{fmt((overall as any).gross_margin)}</p>
 </div>
 </div>
 <div className="text-right">
 <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Margin %</p>
 <p className="text-2xl font-black" style={{ color: (overall as any).gross_margin_pct >= 20 ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }}>
 {((overall as any).gross_margin_pct ?? 0).toFixed(1)}%
 </p>
 </div>
 </div>
 <KpiCard icon={DollarSign} label="Discounts" value={fmt(overall.discount)} />
 </div>
 )}
 {(overall as any).cogs === undefined && (
 <div className="mb-4">
 <KpiCard icon={DollarSign} label="Discounts" value={fmt(overall.discount)} />
 </div>
 )}

 {/* Daily Revenue Trend */}
 {(daily_trend?.length ?? 0) > 0 && (
 <div className="app-glass rounded-2xl p-6 mb-4" style={{ border: '1px solid var(--app-border)' }}>
 <p className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--app-muted-foreground)' }}>
 <TrendingUp size={14} /> Daily Revenue Trend
 </p>
 <div className="flex items-end gap-1 h-28">
 {daily_trend?.map((d: Record<string, any>, i: number) => {
 const max = Math.max(...(daily_trend?.map((t: Record<string, any>) => t.revenue) ?? [0]))
 const pct = max ? (d.revenue / max * 100) : 0
 return (
 <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
 <div className="invisible group-hover:visible text-[9px] whitespace-nowrap font-bold" style={{ color: 'var(--app-primary)' }}>
 {fmt(d.revenue)}
 </div>
 <div
 className="w-full rounded-t transition-all duration-300"
 style={{
 height: `${Math.max(pct, 2)}%`,
 background: 'var(--app-primary)',
 opacity: 0.7,
 }}
 />
 <div className="text-[8px] transform -rotate-45 origin-top-left whitespace-nowrap" style={{ color: 'var(--app-muted-foreground)' }}>
 {new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
 </div>
 </div>
 )
 })}
 </div>
 </div>
 )}

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
 {/* Top Products */}
 <div className="app-glass rounded-2xl p-5" style={{ border: '1px solid var(--app-border)' }}>
 <p className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--app-muted-foreground)' }}>
 <Package size={14} /> Top Products
 </p>
 <div className="space-y-3">
 {top_products?.map((p: Record<string, any>, i: number) => (
 <div key={i} className="flex items-center gap-3">
 <span className="text-xs font-black w-5 text-center" style={{ color: 'var(--app-muted-foreground)' }}>
 {i + 1}
 </span>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold truncate" style={{ color: 'var(--app-foreground)' }}>{p.name || 'Unknown'}</p>
 <p className="text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>{Math.round(p.qty)} units sold</p>
 </div>
 <span className="text-sm font-black" style={{ color: 'var(--app-primary)' }}>{fmt(p.revenue)}</span>
 </div>
 ))}
 {(!top_products?.length) && (
 <p className="text-center py-6 text-sm" style={{ color: 'var(--app-muted-foreground)' }}>No product data yet</p>
 )}
 </div>
 </div>

 {/* Top Customers */}
 <div className="app-glass rounded-2xl p-5" style={{ border: '1px solid var(--app-border)' }}>
 <p className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--app-muted-foreground)' }}>
 <Users size={14} /> Top Customers
 </p>
 <div className="space-y-3">
 {top_customers?.map((c: Record<string, any>, i: number) => (
 <div key={i} className="flex items-center gap-3">
 <span className="text-xs font-black w-5 text-center" style={{ color: 'var(--app-muted-foreground)' }}>{i + 1}</span>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold truncate" style={{ color: 'var(--app-foreground)' }}>{c.name || 'Walk-in'}</p>
 <p className="text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>{c.orders} orders</p>
 </div>
 <span className="text-sm font-black" style={{ color: 'var(--app-primary)' }}>{fmt(c.spent)}</span>
 </div>
 ))}
 {(!top_customers?.length) && (
 <p className="text-center py-6 text-sm" style={{ color: 'var(--app-muted-foreground)' }}>No customer data yet</p>
 )}
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Payment Methods */}
 <div className="app-glass rounded-2xl p-5" style={{ border: '1px solid var(--app-border)' }}>
 <p className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--app-muted-foreground)' }}>
 <CreditCard size={14} /> Payment Methods
 </p>
 <div className="space-y-3">
 {payment_methods?.map((p: Record<string, any>) => (
 <ProgressRow
 key={p.method}
 label={`${PAYMENT_ICONS[p.method] ?? '💳'} ${p.method}`}
 sub={`${p.count} orders`}
 value={fmt(p.total)}
 pct={overall.revenue ? p.total / overall.revenue * 100 : 0}
 />
 ))}
 {(!payment_methods?.length) && (
 <p className="text-center py-6 text-sm" style={{ color: 'var(--app-muted-foreground)' }}>No payment data</p>
 )}
 </div>
 </div>

 {/* Site Performance */}
 <div className="app-glass rounded-2xl p-5" style={{ border: '1px solid var(--app-border)' }}>
 <p className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--app-muted-foreground)' }}>
 <Building2 size={14} /> Site Performance
 </p>
 <div className="space-y-3">
 {site_performance?.map((s: Record<string, any>) => (
 <ProgressRow
 key={s.site}
 label={s.site || 'Unknown'}
 sub={`${s.count} orders`}
 value={fmt(s.total)}
 pct={overall.revenue ? s.total / overall.revenue * 100 : 0}
 />
 ))}
 {(!site_performance?.length) && (
 <p className="text-center py-6 text-sm" style={{ color: 'var(--app-muted-foreground)' }}>No site data</p>
 )}
 </div>
 </div>
 </div>
 </div>
 )
}
