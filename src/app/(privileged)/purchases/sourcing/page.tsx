import { erpFetch } from "@/lib/erp-api";
import {
  TrendingDown, Clock, ShieldCheck, ArrowRight,
  Search, Filter, ChevronRight, BarChart3, Users, Briefcase
} from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

async function getOrgCurrency(): Promise<string> {
  try {
    const orgs = await erpFetch('organizations/')
    const org = Array.isArray(orgs) ? orgs[0] : orgs
    return org?.currency || org?.settings?.currency || 'USD'
  } catch { return 'USD' }
}

async function getSourcingData() {
  try {
    return await erpFetch('sourcing/comparison-dashboard/');
  } catch (e) {
    console.error("Sourcing Fetch Error:", e);
    return [];
  }
}

export default async function SourcingDashboardPage() {
  const [data, currency] = await Promise.all([getSourcingData(), getOrgCurrency()]);

  const stats = {
    totalProducts: data.length,
    multiVendor: data.filter((d: Record<string, any>) => d.supplier_count > 1).length,
    avgLeadTime: data.length > 0 ? (data.reduce((acc: number, curr: Record<string, any>) => acc + curr.best_lead_time, 0) / data.length).toFixed(1) : 0,
    avgSavingsPotential: data.reduce((acc: number, curr: Record<string, any>) => acc + (curr.max_price - curr.min_price), 0)
  };

  return (
    <div className="app-page space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
            <Briefcase size={32} className="text-app-primary" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Procurement</p>
            <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
              Supplier <span className="text-app-primary">Sourcing</span>
            </h1>
          </div>
        </div>
      </header>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Qualified Items', value: stats.totalProducts, icon: ShieldCheck, color: 'emerald' },
          { label: 'Multi-Vendor Items', value: stats.multiVendor, icon: Users, color: 'blue' },
          { label: 'Avg Lead Time', value: `${stats.avgLeadTime} Days`, icon: Clock, color: 'amber' },
          { label: 'Savings Potential', value: `${stats.avgSavingsPotential.toLocaleString()} ${currency}`, icon: TrendingDown, color: 'rose' },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-app-surface p-8 rounded-[2.5rem] shadow-sm border border-app-border hover:shadow-xl hover:shadow-app-border/20 transition-all group overflow-hidden relative">
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${kpi.color}-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500`} />
            <div className={`p-4 bg-${kpi.color}-50 text-${kpi.color}-600 rounded-2xl w-fit relative mb-6`}>
              <kpi.icon size={24} />
            </div>
            <div className="text-3xl font-black text-app-foreground mb-1">{kpi.value}</div>
            <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="bg-app-surface rounded-[3rem] shadow-xl border border-app-border overflow-hidden">
        <div className="p-8 border-b border-app-border flex justify-between items-center bg-app-surface-2/50">
          <div>
            <h3 className="text-xl font-black text-app-foreground tracking-tight">Market Benchmarking</h3>
            <p className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest mt-1">Cross-vendor cost analysis</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest bg-app-surface">
                <th className="p-8">Product / SKU</th>
                <th className="p-8">Category</th>
                <th className="p-8 text-center">Vendors</th>
                <th className="p-8 text-right">Min Price</th>
                <th className="p-8 text-right">Max Price</th>
                <th className="p-8 text-right">Potential Efficiency</th>
                <th className="p-8 text-right">Optimal Lead Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((item: Record<string, any>) => {
                const delta = item.max_price - item.min_price;
                const pct = item.max_price > 0 ? ((delta / item.max_price) * 100).toFixed(0) : 0;

                return (
                  <tr key={item.product_id} className="hover:bg-app-surface-2/50 transition-colors group">
                    <td className="p-8">
                      <div className="text-sm font-black text-app-foreground group-hover:text-app-primary transition-colors">{item.product__name}</div>
                      <div className="text-[10px] text-app-muted-foreground font-mono mt-1">{item.product__sku}</div>
                    </td>
                    <td className="p-8">
                      <span className="px-3 py-1.5 bg-app-surface-2 text-app-muted-foreground rounded-xl text-[10px] font-black uppercase tracking-wider">
                        {item.product__category__name || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="p-8 text-center">
                      <div className="inline-flex items-center justify-center w-8 h-8 bg-app-info-bg text-app-info rounded-lg text-xs font-black shadow-sm border border-app-info/30">
                        {item.supplier_count}
                      </div>
                    </td>
                    <td className="p-8 text-right font-black text-app-primary">
                      {parseFloat(item.min_price).toLocaleString()} {currency}
                    </td>
                    <td className="p-8 text-right font-black text-rose-600">
                      {parseFloat(item.max_price).toLocaleString()} {currency}
                    </td>
                    <td className="p-8 text-right">
                      {delta > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-black text-app-primary">-{pct}% Potential</span>
                          <span className="text-[10px] text-app-muted-foreground">Save {delta.toLocaleString()} {currency}/unit</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-app-muted-foreground font-black uppercase">Optimized</span>
                      )}
                    </td>
                    <td className="p-8 text-right">
                      <div className="flex items-center justify-end gap-2 font-black text-app-muted-foreground">
                        <Clock size={14} className="text-app-warning" />
                        <span>{item.best_lead_time} Days</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-app-background rounded-full flex items-center justify-center text-app-foreground">
              <BarChart3 size={40} />
            </div>
            <div>
              <h4 className="font-black text-app-foreground tracking-tight">No Sourcing Data Yet</h4>
              <p className="text-sm text-app-muted-foreground font-medium">Complete more purchases to build your sourcing database.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
