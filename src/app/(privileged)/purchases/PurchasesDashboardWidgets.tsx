'use client'

import React from 'react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts'
import {
    Zap, TrendingUp, AlertTriangle, CheckCircle2, Package, Truck,
    Clock, Building2, History as HistoryIcon, ArrowRight, ShieldAlert
} from 'lucide-react'
import Link from 'next/link'

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#f43f5e']

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Procurement Pulse (Area Chart)                                             */
/* ─────────────────────────────────────────────────────────────────────────── */
export function ProcurementPulse({ data }: { data: any[] }) {
    return (
        <div className="bg-app-surface/80 backdrop-blur-md rounded-[2rem] border border-app-border/50 p-6 h-[360px] flex flex-col hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-500">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-app-muted-foreground flex items-center gap-2">
                        <Zap size={12} className="text-app-info" />
                        Procurement Pulse
                    </h3>
                    <p className="text-[9px] font-bold text-app-muted-foreground/50 mt-0.5 uppercase tracking-wider">Volume & Velocity Matrix</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-app-primary/10 border border-app-success/20">
                    <TrendingUp size={11} className="text-app-success" />
                    <span className="text-[9px] font-black text-app-success uppercase tracking-tighter">+12.4%</span>
                </div>
            </div>
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorPulse" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(99,102,241,0.06)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: 'var(--app-muted-foreground)' }} dy={8} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: 'var(--app-muted-foreground)' }} />
                        <Tooltip
                            contentStyle={{
                                background: 'var(--app-surface)',
                                borderRadius: '1rem',
                                border: '1px solid var(--app-border)',
                                fontSize: '11px', fontWeight: 900,
                                boxShadow: '0 20px 40px -12px rgba(0,0,0,0.25)',
                                padding: '10px 16px',
                            }}
                            cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPulse)" dot={false} activeDot={{ r: 5, fill: '#6366f1', stroke: 'var(--app-surface)', strokeWidth: 3 }} animationDuration={1500} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Urgent Action Center                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */
export function UrgentActionCenter({ issues }: { issues: any[] }) {
    return (
        <div className="bg-app-surface/80 backdrop-blur-md rounded-[2rem] border border-app-border/50 p-6 h-[360px] flex flex-col">
            <div className="mb-5">
                <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-app-muted-foreground flex items-center gap-2">
                    <AlertTriangle size={12} className="text-app-error" />
                    Critical Operations
                </h3>
                <p className="text-[9px] font-bold text-app-muted-foreground/50 mt-0.5 uppercase tracking-wider">High-priority interventions needed</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                {issues.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-app-primary/5 rounded-2xl border border-dashed border-app-success/20">
                        <CheckCircle2 size={28} className="text-app-success/40 mb-3" />
                        <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest">All Clear</p>
                        <p className="text-[9px] text-app-muted-foreground/40 mt-1">No critical bottlenecks detected</p>
                    </div>
                ) : (
                    issues.map((issue, i) => (
                        <div
                            key={i}
                            className={`group flex items-center gap-3 p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${issue.type === 'overdue'
                                    ? 'bg-app-error/5 border-app-error/15 hover:bg-app-error/10'
                                    : 'bg-app-warning/5 border-app-warning/15 hover:bg-app-warning/10'
                                }`}
                        >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${issue.type === 'overdue' ? 'bg-app-error/10' : 'bg-app-warning/10'
                                }`}>
                                {issue.type === 'overdue'
                                    ? <ShieldAlert size={14} className="text-app-error" />
                                    : <Clock size={14} className="text-app-warning" />
                                }
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-black text-app-foreground uppercase tracking-tight truncate">{issue.title}</div>
                                <div className="text-[9px] font-bold text-app-muted-foreground/60 mt-0.5 truncate">{issue.desc}</div>
                            </div>
                            <ArrowRight size={12} className="text-app-muted-foreground/20 group-hover:text-app-muted-foreground/60 shrink-0 transition-colors" />
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Warehouse Distribution (Donut)                                              */
/* ─────────────────────────────────────────────────────────────────────────── */
export function WarehouseDistribution({ data }: { data: any[] }) {
    return (
        <div className="bg-app-surface/80 backdrop-blur-md rounded-[2rem] border border-app-border/50 p-6 h-[360px] flex flex-col">
            <div className="mb-3">
                <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-app-muted-foreground flex items-center gap-2">
                    <Package size={12} className="text-violet-500" />
                    Storage Topology
                </h3>
                <p className="text-[9px] font-bold text-app-muted-foreground/50 mt-0.5 uppercase tracking-wider">Warehouse Distribution</p>
            </div>
            <div className="flex-1 w-full min-h-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} innerRadius={60} outerRadius={90} paddingAngle={6} dataKey="value" animationDuration={1200}>
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                background: 'var(--app-surface)', borderRadius: '1rem', border: '1px solid var(--app-border)',
                                fontSize: '11px', fontWeight: 900, padding: '8px 14px',
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest leading-none">Total</span>
                    <span className="text-2xl font-black text-app-foreground tracking-tighter mt-0.5">
                        {data.reduce((acc, d) => acc + d.value, 0)}
                    </span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
                {data.slice(0, 4).map((d, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-app-background/50 border border-app-border/30">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-[9px] font-bold text-app-muted-foreground uppercase truncate">{d.name}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Supplier Performance (Leaderboard bars)                                     */
/* ─────────────────────────────────────────────────────────────────────────── */
export function SupplierPerformance({ data }: { data: any[] }) {
    return (
        <div className="bg-app-surface/80 backdrop-blur-md rounded-[2rem] border border-app-border/50 p-6 h-[360px] flex flex-col">
            <div className="mb-5">
                <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-app-muted-foreground flex items-center gap-2">
                    <Truck size={12} className="text-app-info" />
                    Top Suppliers
                </h3>
                <p className="text-[9px] font-bold text-app-muted-foreground/50 mt-0.5 uppercase tracking-wider">By procurement volume</p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar">
                {data.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-[10px] font-bold text-app-muted-foreground/40 uppercase tracking-widest">No supplier data yet</p>
                    </div>
                ) : data.map((s, i) => (
                    <div key={i} className="space-y-1.5">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <span
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black text-white shrink-0"
                                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                                >
                                    {i + 1}
                                </span>
                                <span className="text-[10px] font-black text-app-foreground uppercase tracking-tight truncate max-w-[120px]">{s.name}</span>
                            </div>
                            <span className="text-[10px] font-black" style={{ color: COLORS[i % COLORS.length] }}>
                                {Number(s.value).toLocaleString()}
                            </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-app-background border border-app-border/40 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-1000"
                                style={{ width: `${s.pct}%`, backgroundColor: COLORS[i % COLORS.length], opacity: 0.7 }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <Link
                href="/purchases/dashboard"
                className="mt-5 flex items-center justify-center gap-2 py-3 rounded-2xl bg-app-background/60 hover:bg-indigo-500/8 border border-app-border/50 hover:border-app-info/20 text-[10px] font-black uppercase tracking-[0.18em] text-app-muted-foreground hover:text-app-info transition-all"
            >
                Full Analytics <ArrowRight size={11} />
            </Link>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Procurement Activity Feed (Timeline)                                        */
/* ─────────────────────────────────────────────────────────────────────────── */
export function ProcurementActivityFeed({ orders }: { orders: any[] }) {
    return (
        <div className="bg-app-surface/80 backdrop-blur-md rounded-[2rem] border border-app-border/50 p-6 h-[360px] flex flex-col hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-500">
            <div className="mb-5">
                <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-app-muted-foreground flex items-center gap-2">
                    <HistoryIcon size={12} className="text-app-info" />
                    Recent Activity
                </h3>
                <p className="text-[9px] font-bold text-app-muted-foreground/50 mt-0.5 uppercase tracking-wider">Live transaction stream</p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {orders.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-[10px] font-bold text-app-muted-foreground/40 uppercase tracking-widest">No activity yet</p>
                    </div>
                ) : (
                    <div className="space-y-0">
                        {orders.slice(0, 12).map((order, i) => (
                            <div key={i} className="group relative pl-5 pb-5 border-l border-app-border/40 last:border-0 last:pb-0">
                                {/* Timeline dot */}
                                <div className="absolute left-[-4.5px] top-1 w-2 h-2 rounded-full bg-indigo-500 border-2 border-app-surface ring-2 ring-indigo-500/20" />

                                <Link href={`/purchases/${order.id}`} className="flex items-start justify-between gap-2 hover:bg-app-background/50 rounded-xl px-3 py-2.5 -mx-3 transition-colors">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[11px] font-black text-app-foreground uppercase tracking-tight">
                                                {order.po_number || `PO-${order.id}`}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-app-info text-[8px] font-black uppercase tracking-wider">
                                                {order.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-app-muted-foreground/60 mt-1">
                                            <Building2 size={9} />
                                            {order.supplier_display || order.supplier_name || 'Unknown Vendor'}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-[9px] font-black text-app-foreground tabular-nums">
                                            {Number(order.total_amount).toLocaleString()}
                                        </div>
                                        <div className="text-[8px] font-bold text-app-muted-foreground/40 tabular-nums mt-0.5">
                                            {new Date(order.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
