import { erpFetch } from "@/lib/erp-api";
import { BarChart3, RefreshCw, Activity } from "lucide-react";
import { AlertsClient } from "./AlertsClient";
import Link from "next/link";

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

export default async function StockAlertsPage() {
    const [alerts, dashboard] = await Promise.all([
        getAlerts(),
        getDashboard(),
    ]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-rose-500 rounded-lg text-white shadow-lg shadow-rose-200">
                            <Activity size={16} />
                        </div>
                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em]">Health Monitoring</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tighter">
                        Stock <span className="text-rose-500">Alerts</span>
                    </h1>
                    <p className="mt-2 text-gray-500 font-medium max-w-xl">
                        Global inventory health feed. Tactical alerts require immediate intervention to maintain terminal service levels.
                    </p>
                </div>

                <div className="flex gap-3">
                    <Link
                        href="/inventory/low-stock"
                        className="bg-white border border-gray-100 text-gray-500 px-6 py-3 rounded-2xl font-bold hover:text-rose-600 hover:border-rose-100 transition-all flex items-center gap-2 shadow-sm"
                    >
                        <BarChart3 size={18} />
                        <span>Analysis Report</span>
                    </Link>
                </div>
            </header>

            {/* Premium KPI Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {[
                    { label: 'Active Issues', val: dashboard?.active || 0, color: 'rose' },
                    { label: 'Critical Ops', val: dashboard?.critical || 0, color: 'rose', urgency: true },
                    { label: 'Awaiting Action', val: dashboard?.acknowledged || 0, color: 'indigo' },
                    { label: 'Resolved (24h)', val: dashboard?.resolved_today || 0, color: 'emerald' }
                ].map((kpi, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm relative overflow-hidden group">
                        {kpi.urgency && <div className="absolute top-0 right-0 p-3"><div className="w-2 h-2 bg-rose-500 rounded-full animate-ping" /></div>}
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{kpi.label}</div>
                        <div className={`text-4xl font-black text-${kpi.color}-600 tracking-tighter`}>{kpi.val}</div>
                    </div>
                ))}
            </div>

            <AlertsClient initialAlerts={alerts} />
        </div>
    );
}
