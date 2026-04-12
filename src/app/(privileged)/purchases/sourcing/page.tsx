import { erpFetch } from "@/lib/erp-api";
import {
    TrendingDown, Clock, ShieldCheck, ArrowRight,
    Search, Filter, ChevronRight, BarChart3, Users
} from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

async function getSourcingData() {
    try {
        return await erpFetch('sourcing/comparison/');
    } catch (e) {
        console.error("Sourcing Fetch Error:", e);
        return [];
    }
}

export default async function SourcingDashboardPage() {
    const data = await getSourcingData();

    const stats = {
        totalProducts: data.length,
        multiVendor: data.filter((d: Record<string, any>) => d.supplier_count > 1).length,
        avgLeadTime: data.length > 0 ? (data.reduce((acc: number, curr: Record<string, any>) => acc + curr.best_lead_time, 0) / data.length).toFixed(1) : 0,
        avgSavingsPotential: data.reduce((acc: number, curr: Record<string, any>) => acc + (curr.max_price - curr.min_price), 0)
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl lg:text-6xl font-black text-app-foreground tracking-tighter">
                        Sourcing <span className="text-emerald-500">Intelligence</span>
                    </h1>
                    <p className="text-app-muted-foreground font-bold mt-2">Evaluate vendor performance and optimization opportunities.</p>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Qualified Items', value: stats.totalProducts, icon: ShieldCheck, color: 'emerald' },
                    { label: 'Multi-Vendor Items', value: stats.multiVendor, icon: Users, color: 'blue' },
                    { label: 'Avg Lead Time', value: `${stats.avgLeadTime} Days`, icon: Clock, color: 'amber' },
                    { label: 'Savings Potential', value: `${stats.avgSavingsPotential.toLocaleString()} XOF`, icon: TrendingDown, color: 'rose' },
                ].map((kpi, idx) => (
                    <div key={idx} className="bg-app-surface p-8 rounded-[2.5rem] shadow-sm border border-app-border hover:shadow-xl hover:shadow-gray-100 transition-all group overflow-hidden relative">
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
                <div className="p-8 border-b border-app-border flex justify-between items-center bg-app-surface/50">
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
                                    <tr key={item.product_id} className="hover:bg-app-surface/50 transition-colors group">
                                        <td className="p-8">
                                            <div className="text-sm font-black text-app-foreground group-hover:text-emerald-600 transition-colors">{item.product__name}</div>
                                            <div className="text-[10px] text-app-muted-foreground font-mono mt-1">{item.product__sku}</div>
                                        </td>
                                        <td className="p-8">
                                            <span className="px-3 py-1.5 bg-app-surface-2 text-app-muted-foreground rounded-xl text-[10px] font-black uppercase tracking-wider">
                                                {item.product__category__name || 'Uncategorized'}
                                            </span>
                                        </td>
                                        <td className="p-8 text-center">
                                            <div className="inline-flex items-center justify-center w-8 h-8 bg-blue-50 text-blue-600 rounded-lg text-xs font-black shadow-sm border border-blue-100">
                                                {item.supplier_count}
                                            </div>
                                        </td>
                                        <td className="p-8 text-right font-black text-emerald-600">
                                            {parseFloat(item.min_price).toLocaleString()} XOF
                                        </td>
                                        <td className="p-8 text-right font-black text-rose-600">
                                            {parseFloat(item.max_price).toLocaleString()} XOF
                                        </td>
                                        <td className="p-8 text-right">
                                            {delta > 0 ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xs font-black text-emerald-500">-{pct}% Potential</span>
                                                    <span className="text-[10px] text-app-muted-foreground">Save {delta.toLocaleString()} XOF/unit</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-app-faint font-black uppercase">Optimized</span>
                                            )}
                                        </td>
                                        <td className="p-8 text-right">
                                            <div className="flex items-center justify-end gap-2 font-black text-app-foreground">
                                                <Clock size={14} className="text-amber-500" />
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
                        <div className="w-20 h-20 bg-app-surface rounded-full flex items-center justify-center text-gray-200">
                            <BarChart3 size={40} />
                        </div>
                        <div>
                            <h4 className="font-black text-app-foreground tracking-tight">No Intelligence Data Yet</h4>
                            <p className="text-sm text-app-muted-foreground font-medium">Complete more purchases to build your sourcing database.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
