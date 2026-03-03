import { getExpiryAlerts } from "@/app/actions/inventory/expiry-alerts";
import { Clock, Download, FileText } from "lucide-react";
import { ExpiryAlertsClient } from "./ExpiryAlertsClient";

export const dynamic = 'force-dynamic';

export default async function ExpiryAlertsPage() {
 const initialData = await getExpiryAlerts();
 const stats = initialData?.stats || { expired: 0, critical: 0, warning: 0, total_value: 0, total_quantity: 0 };

 return (
 <div className="app-page space-y-6 animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Clock size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Inventory</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Expiry <span className="text-app-primary">Alerts</span>
          </h1>
        </div>
      </div>
    </header>

 {/* Premium KPI Bar */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
 {[
 { label: 'Expired Items', val: stats.expired, color: 'rose', urgency: stats.expired > 0 },
 { label: 'Critical (30d)', val: stats.critical, color: 'orange' },
 { label: 'Warning (60d)', val: stats.warning, color: 'amber' },
 { label: 'Value at Risk', val: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(stats.total_value), color: 'rose', wide: true }
 ].map((kpi, i) => (
 <div key={i} className={`bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm relative overflow-hidden group ${kpi.wide ? 'md:col-span-1' : ''}`}>
 {kpi.urgency && <div className="absolute top-0 right-0 p-3"><div className="w-2 h-2 bg-app-error rounded-full animate-ping" /></div>}
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">{kpi.label}</div>
 <div className={`text-3xl font-black text-${kpi.color}-600 tracking-tighter`}>{kpi.val}</div>
 </div>
 ))}
 </div>

 <ExpiryAlertsClient initialData={initialData} />
 </div>
 );
}
