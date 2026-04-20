// @ts-nocheck
'use client';

/**
 * ProcurementIntelligenceDrawer — April 15 philosophy as a right-side drawer.
 * Shows: Dashboard KPIs / Recent POs / Monthly Spend Trend / Top Suppliers.
 * Opt-in (doesn't change the grid layout).
 */

import { useEffect, useState } from 'react';
import {
    BarChart3, X, Loader2, FileText, TrendingUp, Users, Zap,
} from 'lucide-react';
import { getProcurementIntelligence } from '@/app/actions/commercial/purchases';

interface Props {
    open: boolean;
    onClose: () => void;
}

export function ProcurementIntelligenceDrawer({ open, onClose }: Props) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        getProcurementIntelligence()
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [open]);

    if (!open) return null;

    const dashboard = data?.dashboard || {};
    const trend = data?.trend || [];
    const recent = data?.recent || [];
    const suppliers = data?.suppliers || [];
    const maxTrend = Math.max(...trend.map((t: any) => Number(t.total || 0)), 1);

    return (
        <>
            <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
            <div className="fixed right-0 top-0 bottom-0 w-[420px] max-w-[90vw] z-50 flex flex-col animate-in slide-in-from-right duration-200"
                style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)' }}>

                {/* Header */}
                <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
                    style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                            <BarChart3 size={15} />
                        </div>
                        <span className="text-[13px] font-black" style={{ color: 'var(--app-foreground)' }}>
                            Procurement Intelligence
                        </span>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={15} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    {loading && (
                        <div className="flex items-center justify-center py-16" style={{ color: 'var(--app-muted-foreground)' }}>
                            <Loader2 size={18} className="animate-spin" />
                        </div>
                    )}

                    {!loading && (
                        <>
                            {/* KPI strip */}
                            <section>
                                <div className="text-[10px] font-black uppercase tracking-widest mb-2"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    Dashboard
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Kpi label="Total POs" value={dashboard.total_pos ?? 0} />
                                    <Kpi label="Total Spend" value={`${Number(dashboard.total_spend ?? 0).toLocaleString()}`} />
                                    <Kpi label="Active Suppliers" value={dashboard.active_suppliers ?? 0} />
                                    <Kpi label="Pending" value={dashboard.pending_pos ?? 0} />
                                </div>
                            </section>

                            {/* Monthly trend — simple bar sparkline */}
                            {trend.length > 0 && (
                                <section>
                                    <div className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        <TrendingUp size={11} /> Monthly Spend Trend
                                    </div>
                                    <div className="flex items-end gap-1 h-20 px-2 py-2 rounded-lg"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                        {trend.slice(-12).map((t: any, i: number) => {
                                            const h = (Number(t.total || 0) / maxTrend) * 100;
                                            return (
                                                <div key={i} className="flex-1 rounded-t transition-all hover:opacity-80"
                                                    style={{
                                                        height: `${h}%`,
                                                        minHeight: '3px',
                                                        background: 'var(--app-primary)',
                                                    }}
                                                    title={`${t.month || ''}: ${Number(t.total || 0).toLocaleString()}`} />
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Top suppliers */}
                            {suppliers.length > 0 && (
                                <section>
                                    <div className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        <Users size={11} /> Top Suppliers
                                    </div>
                                    <div className="space-y-1.5">
                                        {suppliers.map((s: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg text-[12px]"
                                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                                <span className="font-bold truncate mr-2" style={{ color: 'var(--app-foreground)' }}>
                                                    {s.supplier_name || s.name || '—'}
                                                </span>
                                                <span className="font-mono tabular-nums text-[11px] flex-shrink-0"
                                                    style={{ color: 'var(--app-primary)' }}>
                                                    {Number(s.total_spend ?? s.total ?? 0).toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Recent POs */}
                            {recent.length > 0 && (
                                <section>
                                    <div className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        <FileText size={11} /> Recent Activity
                                    </div>
                                    <div className="space-y-1">
                                        {recent.slice(0, 8).map((po: any) => (
                                            <div key={po.id} className="px-3 py-2 rounded-lg"
                                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-mono text-[10px] font-black"
                                                        style={{ color: 'var(--app-primary)' }}>
                                                        {po.po_number || `#${po.id}`}
                                                    </span>
                                                    <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                                                        style={{
                                                            background: statusBg(po.status),
                                                            color: statusColor(po.status),
                                                        }}>
                                                        {po.status || '—'}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] font-bold truncate mt-0.5" style={{ color: 'var(--app-foreground)' }}>
                                                    {po.supplier_name || '—'}
                                                </div>
                                                <div className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                                                    {Number(po.total_amount ?? po.subtotal ?? 0).toLocaleString()} · {po.order_date ? new Date(po.order_date).toLocaleDateString() : ''}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {!dashboard && trend.length === 0 && suppliers.length === 0 && recent.length === 0 && (
                                <div className="text-center py-12 text-[11px]" style={{ color: 'var(--app-muted-foreground)' }}>
                                    No procurement data yet.
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="px-5 py-3 text-[10px] flex-shrink-0"
                    style={{ borderTop: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                    Live from <code>/api/analytics/procurement/*</code>
                </div>
            </div>
        </>
    );
}

function Kpi({ label, value }: { label: string; value: any }) {
    return (
        <div className="px-3 py-2 rounded-lg"
            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>{label}</div>
            <div className="text-[14px] font-black font-mono tabular-nums mt-0.5" style={{ color: 'var(--app-foreground)' }}>{String(value)}</div>
        </div>
    );
}

function statusBg(s: string) {
    const m: Record<string, string> = {
        APPROVED: 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)',
        PENDING: 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)',
        DRAFT: 'color-mix(in srgb, var(--app-muted-foreground) 12%, transparent)',
        RECEIVED: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)',
        INVOICED: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
        CANCELLED: 'color-mix(in srgb, var(--app-error, #ef4444) 12%, transparent)',
    };
    return m[s] || 'color-mix(in srgb, var(--app-muted-foreground) 12%, transparent)';
}
function statusColor(s: string) {
    const m: Record<string, string> = {
        APPROVED: 'var(--app-success, #22c55e)',
        PENDING: 'var(--app-warning, #f59e0b)',
        DRAFT: 'var(--app-muted-foreground)',
        RECEIVED: 'var(--app-info, #3b82f6)',
        INVOICED: 'var(--app-primary)',
        CANCELLED: 'var(--app-error, #ef4444)',
    };
    return m[s] || 'var(--app-muted-foreground)';
}
