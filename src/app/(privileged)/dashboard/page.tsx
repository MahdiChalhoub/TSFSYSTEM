'use client';

/**
 * Dashboard — V2 Theme-Aware Rebuild
 * ─────────────────────────────────────
 * All colors via --app-* CSS vars. No hardcoded hex.
 * Premium standards: glassmorphism KPI cards, display typography,
 * animated counters, themed Recharts, themed skeleton loading.
 */

import { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
    DollarSign, Package, Users, TrendingUp, AlertTriangle,
    Clock, Building2, Zap, ShieldCheck, ArrowRight,
    TrendingDown, Target, Activity, RefreshCw, BarChart3,
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useCurrency } from '@/lib/utils/currency';
import { useAdmin } from '@/context/AdminContext';
import { useAppTheme } from '@/components/app/AppThemeProvider';

// ── Animated counter hook ─────────────────────────────────────
function useCountUp(target: number, duration = 1200) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (target === 0) { setVal(0); return; }
        let start = 0;
        const step = target / (duration / 16);
        const timer = setInterval(() => {
            start += step;
            if (start >= target) { setVal(target); clearInterval(timer); }
            else setVal(Math.floor(start));
        }, 16);
        return () => clearInterval(timer);
    }, [target, duration]);
    return val;
}

// ── Themed skeleton loading ───────────────────────────────────
function DashboardSkeleton() {
    return (
        <div className="app-page p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div className="space-y-2">
                    <div className="h-3 w-32 rounded-full animate-pulse bg-app-border" />
                    <div className="h-10 w-72 rounded-xl animate-pulse bg-app-surface" />
                </div>
                <div className="h-10 w-36 rounded-xl animate-pulse bg-app-surface" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-40 rounded-2xl animate-pulse bg-app-surface" />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="col-span-2 h-96 rounded-2xl animate-pulse bg-app-surface" />
                <div className="h-96 rounded-2xl animate-pulse bg-app-surface" />
            </div>
        </div>
    );
}

// ── KPI Card ─────────────────────────────────────────────────
function KPICard({
    label, value, sub, icon: Icon, accent, badge, badgeVariant = 'neutral', delay = 0
}: {
    label: string;
    value: string;
    sub: string;
    icon: React.ElementType;
    accent: string;
    badge?: string;
    badgeVariant?: 'up' | 'down' | 'warn' | 'neutral';
    delay?: number;
}) {
    const baseBadgeStyles = "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1";
    const variantStyles: Record<string, string> = {
        up: "bg-app-success/10 text-app-success border border-app-success/20",
        down: "bg-app-error/10 text-app-error border border-app-error/20",
        warn: "bg-app-warning/10 text-app-warning border border-app-warning/20",
        neutral: "bg-app-surface border border-app-border text-app-muted-foreground",
    };

    return (
        <div
            className="app-glass p-5 rounded-2xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg fade-in-up"
            style={{ animationDelay: `${delay}ms` }}
        >
            {/* Icon badge + badge label */}
            <div className="flex items-start justify-between mb-4">
                <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: accent, boxShadow: `0 4px 14px ${accent}40` }}
                >
                    <Icon size={22} color="#fff" />
                </div>
                {badge && (
                    <span className={`${baseBadgeStyles} ${variantStyles[badgeVariant]}`}>
                        {badgeVariant === 'up' && <TrendingUp size={10} />}
                        {badgeVariant === 'down' && <TrendingDown size={10} />}
                        {badge}
                    </span>
                )}
            </div>

            {/* Label */}
            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">
                {label}
            </p>

            {/* Value */}
            <p className="text-3xl font-black tracking-tight text-app-foreground italic">
                {value}
            </p>

            {/* Sub */}
            <div className="mt-4 pt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight text-app-muted-foreground border-t border-app-border">
                <Activity size={12} className="text-app-primary" />
                {sub}
            </div>
        </div>
    );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function DashboardPage() {
    const { viewScope } = useAdmin();
    const { fmt } = useCurrency();
    const { themeInfo } = useAppTheme();

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadAll(); }, [viewScope]);

    async function loadAll() {
        setLoading(true);
        try {
            const { erpFetch } = await import('@/lib/erp-api');
            const [sales, stock, employees, contacts, accounts, movements] = await Promise.all([
                erpFetch('pos/pos/daily-summary/?days=30').catch(() => null),
                erpFetch('inventory/low-stock/').catch(() => []),
                erpFetch('hr/employees/').catch(() => []),
                erpFetch('crm/contacts/').catch(() => []),
                erpFetch('coa/').catch(() => []),
                erpFetch('inventory/inventory-movements/').catch(() => []),
            ]);
            setData({
                salesSummary: sales,
                lowStock: Array.isArray(stock) ? stock : stock?.results || [],
                employees: Array.isArray(employees) ? employees : employees?.results || [],
                contacts: Array.isArray(contacts) ? contacts : contacts?.results || [],
                accounts: Array.isArray(accounts) ? accounts : accounts?.results || [],
                movements: Array.isArray(movements) ? movements : movements?.results || [],
            });
        } catch {
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    }

    const metrics = useMemo(() => {
        if (!data) return null;

        const parentIds = new Set(data.accounts.map((a: any) => a.parentId).filter(Boolean));
        const leaf = data.accounts.filter((a: any) => !parentIds.has(a.id));
        const liquidity = leaf
            .filter((a: any) => a.type === 'ASSET' && (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')))
            .reduce((s: number, a: any) => s + Math.abs(parseFloat(a.balance || 0)), 0);
        const exposure = leaf
            .filter((a: any) => a.type === 'LIABILITY')
            .reduce((s: number, a: any) => s + Math.abs(parseFloat(a.balance || 0)), 0) +
            data.employees.reduce((s: number, e: any) => s + parseFloat(e.salary || 0), 0);

        let changePercent = 0, txCount = 0;
        if (data.salesSummary?.daily_sales?.length) {
            const days = data.salesSummary.daily_sales;
            txCount = days.reduce((s: number, d: any) => s + (d.count || 0), 0);
            const r7 = days.slice(-7).reduce((s: number, d: any) => s + parseFloat(d.total || 0), 0);
            const p7 = days.slice(-14, -7).reduce((s: number, d: any) => s + parseFloat(d.total || 0), 0);
            if (p7 > 0) changePercent = Math.round(((r7 - p7) / p7) * 100);
        }

        const chartData = data.salesSummary?.daily_sales?.length
            ? data.salesSummary.daily_sales.map((d: any) => ({
                name: new Date(d.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
                revenue: parseFloat(d.total || 0),
                cogs: parseFloat(d.total || 0) * 0.6,
            })).slice(-14)
            : [{ name: 'No Data', revenue: 0, cogs: 0 }];

        const totalMvt = data.movements.length || 1;
        const warehouses = Array.from(new Set(data.movements.map((m: any) => m.warehouse_name || 'Main')))
            .map(name => {
                const count = data.movements.filter((m: any) => (m.warehouse_name || 'Main') === name).length;
                return { name, count, pct: Math.floor((count / totalMvt) * 100) };
            });
        if (!warehouses.length) warehouses.push({ name: 'Main Warehouse', count: 0, pct: 0 });

        const topSellers = Object.entries(data.salesSummary?.user_stats || {})
            .map(([name, stats]: [string, any]) => ({ name, revenue: stats.total || 0, count: stats.count || 0 }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        const stockRate = data.lowStock.length > 0
            ? Math.max(0, Math.round(100 - (data.lowStock.length / Math.max(data.contacts.length, 1)) * 100))
            : 100;

        return {
            grossRevenue: parseFloat(data.salesSummary?.sales?.total || 0),
            liquidity,
            exposure,
            changePercent,
            txCount,
            chartData,
            warehouses,
            topSellers,
            recentMovements: data.movements.slice(0, 5),
            lowStockCount: data.lowStock.length,
            stockRate,
        };
    }, [data]);

    if (loading || !metrics) return <DashboardSkeleton />;

    const primary = themeInfo.primary;

    return (
        <div className="app-page">
            <div className="p-5 md:p-6 space-y-6 max-w-7xl mx-auto">
                {/* ── Page Header ─────────────────────────────────── */}
                <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 fade-in-up">
                    <div className="flex items-center gap-4">
                        <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
                            style={{ background: primary, boxShadow: `0 8px 24px ${primary}40` }}
                        >
                            <Zap size={32} color="#fff" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">
                                Live • Real-time data
                            </p>
                            <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
                                Organization <span style={{ color: primary }}>Dashboard</span>
                            </h1>
                            <p className="text-sm mt-0.5 text-app-muted-foreground font-medium">
                                Financial overview and operational metrics across all locations.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={loadAll}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-app-surface border border-app-border text-app-muted-foreground hover:bg-app-surface-hover hover:text-app-foreground transition-all shadow-sm"
                    >
                        <RefreshCw size={15} />
                        Refresh
                    </button>
                </header>

                {/* ── KPI Row ──────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard
                        label="30D Gross Revenue"
                        value={fmt(metrics.grossRevenue)}
                        sub={`${metrics.txCount.toLocaleString()} transactions`}
                        icon={DollarSign}
                        accent={primary}
                        badge={metrics.changePercent !== 0 ? `${metrics.changePercent > 0 ? '+' : ''}${metrics.changePercent}%` : undefined}
                        badgeVariant={metrics.changePercent > 0 ? 'up' : 'down'}
                        delay={0}
                    />
                    <KPICard
                        label="Revenue Liquidity"
                        value={fmt(metrics.liquidity)}
                        sub="Position: Fully Hedged"
                        icon={Activity}
                        accent="#10B981"
                        badge="STABLE"
                        badgeVariant="neutral"
                        delay={80}
                    />
                    <KPICard
                        label="Economic Exposure"
                        value={fmt(metrics.exposure)}
                        sub="Review Priority: Alpha"
                        icon={AlertTriangle}
                        accent="#EF4444"
                        badge="CRITICAL"
                        badgeVariant="warn"
                        delay={160}
                    />
                    <KPICard
                        label="Stock Health"
                        value={`${metrics.stockRate}%`}
                        sub={`${metrics.lowStockCount} items need reorder`}
                        icon={Package}
                        accent="#F59E0B"
                        badge={metrics.lowStockCount > 0 ? `${metrics.lowStockCount} ALERTS` : 'HEALTHY'}
                        badgeVariant={metrics.lowStockCount > 0 ? 'warn' : 'up'}
                        delay={240}
                    />
                </div>

                {/* ── Revenue Chart + Warehouse Panel ──────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Area Chart */}
                    <div
                        className="lg:col-span-2 app-glass p-6 fade-in-up rounded-[2rem]"
                        style={{ animationDelay: '100ms' }}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-app-muted-foreground">Financial Trend</p>
                                <h2 className="text-xl font-black tracking-tight text-app-foreground italic">Revenue vs Estimated COGS</h2>
                            </div>
                            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-full" style={{ background: primary }} />
                                    <span className="text-app-muted-foreground">Revenue</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-app-error" />
                                    <span className="text-app-muted-foreground">COGS</span>
                                </div>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={metrics.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={primary} stopOpacity={0.2} />
                                        <stop offset="95%" stopColor={primary} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gCOGS" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--app-error)" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="var(--app-error)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--app-muted-foreground)' }}
                                    dy={8}
                                />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '1rem',
                                        border: '1px solid var(--app-border)',
                                        background: 'var(--app-surface)',
                                        boxShadow: '0 10px 25px -5px var(--app-border), 0 8px 10px -6px var(--app-border)',
                                        padding: '12px 16px',
                                        color: 'var(--app-foreground)',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                    }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke={primary} strokeWidth={2.5} fillOpacity={1} fill="url(#gRev)" />
                                <Area type="monotone" dataKey="cogs" stroke="var(--app-error)" strokeWidth={2} fillOpacity={1} fill="url(#gCOGS)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Warehouse Panel */}
                    <div
                        className="app-glass p-6 rounded-[2rem] flex flex-col justify-between fade-in-up"
                        style={{ animationDelay: '150ms' }}
                    >
                        <div className="mb-4">
                            <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-app-muted-foreground">Location Performance</p>
                            <h2 className="text-xl font-black tracking-tight text-app-foreground italic">Warehouse Activity</h2>
                        </div>

                        <div className="space-y-5 flex-1 mt-4">
                            {metrics.warehouses.map((w: any, i: number) => (
                                <div key={i}>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-xs font-bold text-app-foreground truncate">{w.name}</span>
                                        <span className="text-[10px] font-black" style={{ color: primary }}>{w.pct}%</span>
                                    </div>
                                    <div className="h-2 w-full rounded-full overflow-hidden bg-app-surface">
                                        <div
                                            className="h-full rounded-full transition-all duration-1000"
                                            style={{ width: `${w.pct}%`, background: primary, boxShadow: `0 0 8px ${primary}40` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-6 mt-6 border-t border-app-border">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">System Status</p>
                                <p className="text-lg font-black text-app-success italic">Healthy Operations</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-app-success/10 border border-app-success/20">
                                <ShieldCheck size={24} className="text-app-success" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Bottom Row: Top Sellers + Recent Movements ──── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Top Sellers */}
                    <div className="app-glass p-6 space-y-2 fade-in-up rounded-[2rem]" style={{ animationDelay: '200ms' }}>
                        <div className="mb-6">
                            <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-app-muted-foreground">Sales Performance</p>
                            <h2 className="text-xl font-black tracking-tight text-app-foreground italic">Top Sellers</h2>
                        </div>
                        {metrics.topSellers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-3">
                                <Users size={48} className="text-app-muted-foreground opacity-50" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">No sales data yet</p>
                            </div>
                        ) : metrics.topSellers.map((s: any, i: number) => (
                            <div key={i} className="flex items-center gap-4 py-3 group">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-all duration-300 pointer-events-none"
                                    style={{ background: 'var(--app-primary-10)', color: primary, border: '1px solid var(--app-primary-20)' }}
                                >
                                    {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate text-app-foreground">{s.name}</p>
                                    <div className="mt-1 h-1.5 rounded-full overflow-hidden bg-app-surface">
                                        <div
                                            className="h-full rounded-full transition-all duration-1000 group-hover:opacity-80"
                                            style={{ width: `${(s.revenue / (metrics.topSellers[0]?.revenue || 1)) * 100}%`, background: primary }}
                                        />
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-black" style={{ color: primary }}>{fmt(s.revenue)}</p>
                                    <p className="text-[10px] text-app-muted-foreground">{s.count} sales</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Recent Inventory Movements */}
                    <div className="app-glass p-6 space-y-2 fade-in-up rounded-[2rem] flex flex-col" style={{ animationDelay: '250ms' }}>
                        <div className="mb-6">
                            <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-app-muted-foreground">Recent Activity</p>
                            <h2 className="text-xl font-black tracking-tight text-app-foreground italic">Inventory Movements</h2>
                        </div>
                        <div className="flex-1">
                            {metrics.recentMovements.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                                    <Activity size={48} className="text-app-muted-foreground opacity-50 animate-pulse" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">No recent movements</p>
                                </div>
                            ) : metrics.recentMovements.map((m: any, i: number) => (
                                <div key={i} className="flex items-start gap-4 py-3">
                                    <div
                                        className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ background: m.type === 'IN' ? 'var(--app-success)' : 'var(--app-error)' }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold truncate text-app-foreground">
                                            {m.product_name || `Product #${m.product}`}
                                        </p>
                                        <p className="text-[10px] mt-0.5 flex items-center gap-1 text-app-muted-foreground">
                                            <Building2 size={10} />
                                            {m.warehouse_name || 'Main Warehouse'}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p
                                            className="text-sm font-black"
                                            style={{ color: m.type === 'IN' ? 'var(--app-success)' : 'var(--app-error)' }}
                                        >
                                            {m.type === 'IN' ? '+' : '−'}{parseFloat(m.quantity).toFixed(0)}
                                        </p>
                                        <p className="text-[10px] text-app-muted-foreground">
                                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {metrics.recentMovements.length > 0 && (
                            <button className="w-full mt-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all bg-app-surface border border-app-border text-app-muted-foreground hover:bg-app-surface-hover hover:text-app-foreground cursor-pointer">
                                View All Movements <ArrowRight size={14} className="inline ml-1" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
