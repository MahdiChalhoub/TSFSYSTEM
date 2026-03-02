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
 <header className="flex justify-between items-center border-b pb-6">
 <div className="flex items-center gap-4">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 rounded-2xl bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-200">
 <Activity size={28} className="text-white" />
 </div>
 <h1 className="page-header-title tracking-tighter">
 Stock <span className="text-rose-600">Health</span>
 </h1>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <Link
 href="/inventory/low-stock"
 className="bg-app-surface border border-app-border text-app-text-faint px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:text-rose-600 hover:border-rose-100 transition-all flex items-center gap-2 shadow-sm"
 >
 <BarChart3 size={14} />
 <span>Tactical Analysis</span>
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
 <div key={i} className="bg-app-surface p-6 rounded-[2rem] border border-gray-50 shadow-sm relative overflow-hidden group">
 {kpi.urgency && <div className="absolute top-0 right-0 p-3"><div className="w-2 h-2 bg-rose-500 rounded-full animate-ping" /></div>}
 <div className="text-[10px] font-black text-app-text-faint uppercase tracking-widest mb-1">{kpi.label}</div>
 <div className={`text-4xl font-black text-${kpi.color}-600 tracking-tighter`}>{kpi.val}</div>
 </div>
 ))}
 </div>
 <AlertsClient initialAlerts={alerts} />
 </div>
 );
}
