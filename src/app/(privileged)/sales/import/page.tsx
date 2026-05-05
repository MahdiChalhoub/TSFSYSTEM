import React from 'react';
import { SalesMapper } from './SalesMapper';
import { FileUp, Database, History, TrendingUp, HelpCircle } from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';

export default async function SalesImportPage() {
    const warehouses = await erpFetch('warehouses/');
    const accounts = await erpFetch('coa/?is_active=true');

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-app-bg p-8 rounded-[2.5rem] text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5">
                    <Database size={200} />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="p-3 bg-app-success rounded-2xl shadow-lg shadow-emerald-500/20">
                            <FileUp size={28} className="text-white" />
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tight">Sales Import Engine</h1>
                    </div>
                    <p className="text-app-muted-foreground text-sm max-w-xl font-medium leading-relaxed">
                        Batch process historical sales or external marketplace data. Map your CSV columns to the Blanc Engine core and generate stock-deducted ledger entries in seconds.
                    </p>
                </div>

                <div className="flex gap-4 relative z-10 font-bold uppercase tracking-tighter">
                    <div className="bg-slate-800/50 backdrop-blur-md p-4 rounded-2xl border border-slate-700/50 flex flex-col items-center justify-center min-w-[100px]">
                        <span className="text-2xl text-emerald-400">01</span>
                        <span className="text-[10px] text-app-muted-foreground">Upload</span>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur-md p-4 rounded-2xl border border-slate-700/50 flex flex-col items-center justify-center min-w-[100px]">
                        <span className="text-2xl text-blue-400">02</span>
                        <span className="text-[10px] text-app-muted-foreground">Map</span>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur-md p-4 rounded-2xl border border-slate-700/50 flex flex-col items-center justify-center min-w-[100px]">
                        <span className="text-2xl text-purple-400">03</span>
                        <span className="text-[10px] text-app-muted-foreground">Sync</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                {/* Main Action Area */}
                <div className="xl:col-span-3">
                    <SalesMapper warehouses={warehouses} accounts={accounts} />
                </div>

                {/* Sidebar Tips & Stats */}
                <div className="space-y-8">
                    <div className="bg-app-surface p-8 rounded-[2rem] border border-app-border shadow-sm relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-6">
                            <HelpCircle className="text-app-success" size={20} />
                            <h3 className="text-sm font-black uppercase tracking-tight text-app-foreground">Format Guide</h3>
                        </div>
                        <ul className="space-y-4">
                            {[
                                { label: "Date", desc: "YYYY-MM-DD or DD/MM/YYYY" },
                                { label: "Product SKU", desc: "Must match existing SKU" },
                                { label: "Quantity", desc: "Positive numeric values" },
                                { label: "Unit Price", desc: "Selling price excluding tax" },
                            ].map((tip, i) => (
                                <li key={i} className="flex flex-col gap-1 border-b border-app-border pb-4 last:border-0 last:pb-0">
                                    <span className="text-[10px] font-black uppercase text-app-muted-foreground">{tip.label}</span>
                                    <span className="text-xs font-medium text-app-muted-foreground tracking-tight">{tip.desc}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-app-success-bg p-8 rounded-[2rem] border border-emerald-100/50">
                        <div className="flex items-center gap-3 mb-4">
                            <TrendingUp className="text-app-success" size={20} />
                            <h3 className="text-sm font-black uppercase tracking-tight text-emerald-900">Performance</h3>
                        </div>
                        <p className="text-[11px] text-app-success font-medium leading-relaxed">
                            Engine optimized for batches up to 5,000 rows. Larger files should be split for granular auditing.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
