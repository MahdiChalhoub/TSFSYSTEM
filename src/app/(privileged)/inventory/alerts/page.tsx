import { erpFetch } from "@/lib/erp-api";
import Link from "next/link";
import {
    AlertTriangle, Bell, CheckCircle2, Clock, Package,
    TrendingDown, RefreshCw, ShieldAlert, BarChart3, XCircle
} from "lucide-react";

export const dynamic = 'force-dynamic';

async function getAlerts() {
    try {
        return await erpFetch('stock-alerts/');
    } catch (e) {
        console.error("Failed to fetch stock alerts:", e);
        return [];
    }
}

async function getDashboard() {
    try {
        return await erpFetch('stock-alerts/dashboard/');
    } catch (e) {
        return null;
    }
}

const SEVERITY_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    INFO: { label: 'Info', color: 'text-app-info', bg: 'bg-app-info-bg border-app-info', icon: Bell },
    WARNING: { label: 'Warning', color: 'text-app-warning', bg: 'bg-app-warning-bg border-app-warning', icon: AlertTriangle },
    CRITICAL: { label: 'Critical', color: 'text-app-error', bg: 'bg-app-error-bg border-app-error', icon: ShieldAlert },
    EMERGENCY: { label: 'Emergency', color: 'text-app-error', bg: 'bg-app-error-bg border-app-error', icon: XCircle },
};

const ALERT_TYPE_MAP: Record<string, { label: string; icon: any }> = {
    LOW_STOCK: { label: 'Low Stock', icon: TrendingDown },
    OUT_OF_STOCK: { label: 'Out of Stock', icon: XCircle },
    OVERSTOCK: { label: 'Overstock', icon: Package },
    REORDER: { label: 'Reorder Point', icon: RefreshCw },
    EXPIRY: { label: 'Expiring Soon', icon: Clock },
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
    ACTIVE: { label: 'Active', color: 'bg-app-error-bg text-app-error' },
    ACKNOWLEDGED: { label: 'Acknowledged', color: 'bg-app-warning-bg text-app-warning' },
    RESOLVED: { label: 'Resolved', color: 'bg-app-success-bg text-app-success' },
    SNOOZED: { label: 'Snoozed', color: 'bg-app-surface-2 text-app-muted-foreground' },
};

export default async function StockAlertsPage() {
    const [alerts, dashboard] = await Promise.all([
        getAlerts(),
        getDashboard(),
    ]);

    const activeCount = dashboard?.active || alerts?.filter?.((a: any) => a.status === 'ACTIVE')?.length || 0;
    const criticalCount = dashboard?.critical || 0;
    const acknowledgedCount = dashboard?.acknowledged || 0;
    const resolvedToday = dashboard?.resolved_today || 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1>
                        Stock <span className="text-app-error">Alerts</span>
                    </h1>
                    <p className="text-sm text-app-muted-foreground mt-1">Real-time inventory health monitoring and reorder alerts</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/inventory/low-stock"
                        className="bg-app-surface border-2 border-app-border text-app-muted-foreground px-6 py-3.5 rounded-2xl font-bold hover:text-app-error hover:border-red-100 transition-all flex items-center gap-2"
                    >
                        <BarChart3 size={18} />
                        <span>Low Stock Report</span>
                    </Link>
                    <form action={async () => {
                        'use server';
                        const { erpFetch } = await import("@/lib/erp-api");
                        await erpFetch('stock-alerts/scan-all/', { method: 'POST' });
                        const { revalidatePath } = await import('next/cache');
                        revalidatePath('/inventory/alerts');
                    }}>
                        <button
                            type="submit"
                            className="bg-app-error text-white px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-red-200 hover:bg-app-error transition-all flex items-center gap-2"
                        >
                            <RefreshCw size={18} />
                            <span>Scan All Stock</span>
                        </button>
                    </form>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="bg-app-surface p-6 rounded-3xl border border-red-100 shadow-sm">
                    <div className="text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-1">Active Alerts</div>
                    <div className="text-4xl font-black text-app-error">{activeCount}</div>
                    <div className="mt-2 text-[10px] text-app-muted-foreground font-bold uppercase tracking-tighter">Require attention</div>
                </div>
                <div className="bg-app-surface p-6 rounded-3xl border border-app-error shadow-sm">
                    <div className="text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-1">Critical</div>
                    <div className="text-4xl font-black text-app-error">{criticalCount}</div>
                    <div className="mt-2 text-[10px] text-app-muted-foreground font-bold uppercase tracking-tighter">Urgent stock issues</div>
                </div>
                <div className="bg-app-surface p-6 rounded-3xl border border-amber-100 shadow-sm">
                    <div className="text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-1">Acknowledged</div>
                    <div className="text-4xl font-black text-app-warning">{acknowledgedCount}</div>
                    <div className="mt-2 text-[10px] text-app-muted-foreground font-bold uppercase tracking-tighter">Being handled</div>
                </div>
                <div className="bg-app-surface p-6 rounded-3xl border border-emerald-100 shadow-sm">
                    <div className="text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-1">Resolved Today</div>
                    <div className="text-4xl font-black text-app-success">{resolvedToday}</div>
                    <div className="mt-2 text-[10px] text-app-muted-foreground font-bold uppercase tracking-tighter">Issues cleared</div>
                </div>
            </div>

            {/* Alert List */}
            <div className="bg-app-surface rounded-3xl shadow-xl border border-app-border overflow-hidden">
                <div className="p-6 border-b border-app-border bg-[#F8FAFC]">
                    <h2 className="text-app-muted-foreground uppercase">Alert Feed</h2>
                </div>
                <div className="divide-y divide-app-border">
                    {(!alerts || alerts.length === 0) ? (
                        <div className="p-20 text-center text-app-muted-foreground font-medium italic">
                            <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-300" />
                            <p>All clear — no stock alerts at this time.</p>
                            <p className="text-xs mt-1">Run a scan to check for potential issues.</p>
                        </div>
                    ) : (
                        alerts.map((alert: Record<string, any>) => {
                            const severity = SEVERITY_MAP[alert.severity] || SEVERITY_MAP.INFO;
                            const alertType = ALERT_TYPE_MAP[alert.alert_type] || { label: alert.alert_type, icon: Bell };
                            const statusBadge = STATUS_BADGE[alert.status] || STATUS_BADGE.ACTIVE;
                            const SeverityIcon = severity.icon;
                            const TypeIcon = alertType.icon;

                            return (
                                <div key={alert.id} className={`p-6 flex items-start gap-4 hover:bg-app-surface transition-colors ${alert.status === 'RESOLVED' ? 'opacity-50' : ''}`}>
                                    {/* Severity Icon */}
                                    <div className={`p-3 rounded-2xl ${severity.bg} border`}>
                                        <SeverityIcon size={20} className={severity.color} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <TypeIcon size={14} className="text-app-muted-foreground" />
                                            <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">{alertType.label}</span>
                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${statusBadge.color}`}>
                                                {statusBadge.label}
                                            </span>
                                        </div>
                                        <h3>
                                            {alert.product_display || alert.product_name || `Product #${alert.product}`}
                                        </h3>
                                        <p className="text-xs text-app-muted-foreground mt-0.5">{alert.message || 'Stock level requires attention'}</p>
                                        <div className="flex items-center gap-4 mt-2 text-[10px] text-app-muted-foreground">
                                            <span>Current: <strong className="text-app-muted-foreground">{alert.current_quantity ?? '—'}</strong></span>
                                            <span>Threshold: <strong className="text-app-muted-foreground">{alert.threshold ?? '—'}</strong></span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={10} />
                                                {alert.created_at ? new Date(alert.created_at).toLocaleString('fr-FR') : '—'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
