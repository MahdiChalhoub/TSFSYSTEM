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
    INFO: { label: 'Info', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Bell },
    WARNING: { label: 'Warning', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle },
    CRITICAL: { label: 'Critical', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: ShieldAlert },
    EMERGENCY: { label: 'Emergency', color: 'text-red-800', bg: 'bg-red-100 border-red-400', icon: XCircle },
};

const ALERT_TYPE_MAP: Record<string, { label: string; icon: any }> = {
    LOW_STOCK: { label: 'Low Stock', icon: TrendingDown },
    OUT_OF_STOCK: { label: 'Out of Stock', icon: XCircle },
    OVERSTOCK: { label: 'Overstock', icon: Package },
    REORDER: { label: 'Reorder Point', icon: RefreshCw },
    EXPIRY: { label: 'Expiring Soon', icon: Clock },
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
    ACTIVE: { label: 'Active', color: 'bg-red-100 text-red-700' },
    ACKNOWLEDGED: { label: 'Acknowledged', color: 'bg-amber-100 text-amber-700' },
    RESOLVED: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-700' },
    SNOOZED: { label: 'Snoozed', color: 'bg-slate-100 text-slate-600' },
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
                    <h1 className="text-4xl font-black text-gray-900 tracking-tighter">
                        Stock <span className="text-red-500">Alerts</span>
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Real-time inventory health monitoring and reorder alerts</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/inventory/low-stock"
                        className="bg-white border-2 border-gray-100 text-gray-500 px-6 py-3.5 rounded-2xl font-bold hover:text-red-600 hover:border-red-100 transition-all flex items-center gap-2"
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
                            className="bg-red-600 text-white px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-all flex items-center gap-2"
                        >
                            <RefreshCw size={18} />
                            <span>Scan All Stock</span>
                        </button>
                    </form>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="bg-white p-6 rounded-3xl border border-red-100 shadow-sm">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Active Alerts</div>
                    <div className="text-4xl font-black text-red-600">{activeCount}</div>
                    <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Require attention</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-red-200 shadow-sm">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Critical</div>
                    <div className="text-4xl font-black text-red-800">{criticalCount}</div>
                    <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Urgent stock issues</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Acknowledged</div>
                    <div className="text-4xl font-black text-amber-600">{acknowledgedCount}</div>
                    <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Being handled</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Resolved Today</div>
                    <div className="text-4xl font-black text-emerald-600">{resolvedToday}</div>
                    <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Issues cleared</div>
                </div>
            </div>

            {/* Alert List */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-[#F8FAFC]">
                    <h2 className="text-sm font-black text-gray-600 uppercase tracking-widest">Alert Feed</h2>
                </div>
                <div className="divide-y divide-gray-50">
                    {(!alerts || alerts.length === 0) ? (
                        <div className="p-20 text-center text-gray-400 font-medium italic">
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
                                <div key={alert.id} className={`p-6 flex items-start gap-4 hover:bg-gray-50 transition-colors ${alert.status === 'RESOLVED' ? 'opacity-50' : ''}`}>
                                    {/* Severity Icon */}
                                    <div className={`p-3 rounded-2xl ${severity.bg} border`}>
                                        <SeverityIcon size={20} className={severity.color} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <TypeIcon size={14} className="text-gray-400" />
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{alertType.label}</span>
                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${statusBadge.color}`}>
                                                {statusBadge.label}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-gray-900 text-sm">
                                            {alert.product_display || alert.product_name || `Product #${alert.product}`}
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-0.5">{alert.message || 'Stock level requires attention'}</p>
                                        <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                                            <span>Current: <strong className="text-gray-600">{alert.current_quantity ?? '—'}</strong></span>
                                            <span>Threshold: <strong className="text-gray-600">{alert.threshold ?? '—'}</strong></span>
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
