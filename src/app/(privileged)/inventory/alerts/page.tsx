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
 <div className="app-page space-y-6 animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Bell size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Inventory</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Stock <span className="text-app-primary">Alerts</span>
          </h1>
        </div>
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
 <div key={i} className="bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm relative overflow-hidden group">
 {kpi.urgency && <div className="absolute top-0 right-0 p-3"><div className="w-2 h-2 bg-app-error rounded-full animate-ping" /></div>}
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">{kpi.label}</div>
 <div className={`text-4xl font-black text-${kpi.color}-600 tracking-tighter`}>{kpi.val}</div>
 </div>
 ))}
 </div>
 <AlertsClient initialAlerts={alerts} />
 </div>
 );
}
