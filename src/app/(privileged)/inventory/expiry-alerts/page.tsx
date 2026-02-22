import { getExpiryAlerts } from "@/app/actions/inventory/expiry-alerts";
import { Clock, Download, FileText } from "lucide-react";
import { ExpiryAlertsClient } from "./ExpiryAlertsClient";

export const dynamic = 'force-dynamic';

export default async function ExpiryAlertsPage() {
    const initialData = await getExpiryAlerts();
    const stats = initialData?.stats || { expired: 0, critical: 0, warning: 0, total_value: 0, total_quantity: 0 };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-200">
                            <Clock size={16} />
                        </div>
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">Batch Management</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tighter">
                        Expiry <span className="text-indigo-600">Timeline</span>
                    </h1>
                    <p className="mt-2 text-gray-500 font-medium max-w-xl">
                        Monitor product lifecycles and batch integrity. Identify financial risks before expiration events occur.
                    </p>
                </div>

                <div className="flex gap-3">
                    <button className="bg-white border border-gray-100 text-gray-500 px-6 py-3 rounded-2xl font-bold hover:text-indigo-600 hover:border-indigo-100 transition-all flex items-center gap-2 shadow-sm">
                        <FileText size={18} />
                        <span>Export Report</span>
                    </button>
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
                    <div key={i} className={`bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm relative overflow-hidden group ${kpi.wide ? 'md:col-span-1' : ''}`}>
                        {kpi.urgency && <div className="absolute top-0 right-0 p-3"><div className="w-2 h-2 bg-rose-500 rounded-full animate-ping" /></div>}
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{kpi.label}</div>
                        <div className={`text-3xl font-black text-${kpi.color}-600 tracking-tighter`}>{kpi.val}</div>
                    </div>
                ))}
            </div>

            <ExpiryAlertsClient initialData={initialData} />
        </div>
    );
}
