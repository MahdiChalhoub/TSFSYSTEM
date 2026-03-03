import React from 'react';
import { SalesMapper } from './SalesMapper';
import { FileUp, Database, History, TrendingUp, HelpCircle } from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';

export default async function SalesImportPage() {
 let warehouses: any = [], accounts: any = [];
 try { warehouses = await erpFetch('inventory/warehouses/'); } catch { }
 try { accounts = await erpFetch('coa/?is_active=true'); } catch { }

 return (
 <div className="app-page p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
 {/* Header Section */}
 <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-app-background p-8 rounded-[2.5rem] text-app-foreground shadow-2xl shadow-app-border/20 relative overflow-hidden">
 <div className="absolute top-0 right-0 p-12 opacity-5">
 <Database size={200} />
 </div>

 <div className="relative z-10">
 <div className="flex items-center gap-4 mb-3">
 <div className="p-3 bg-app-primary rounded-2xl shadow-lg shadow-app-primary/20">
 <FileUp size={28} className="text-app-foreground" />
 </div>
 <h1 className="page-header-title uppercase tracking-tight">Sales Import</h1>
 </div>
 <p className="text-app-muted-foreground text-sm max-w-xl font-medium leading-relaxed">
 Batch process historical sales or external marketplace data. Map your CSV columns to the system and generate stock-deducted ledger entries in seconds.
 </p>
 </div>

 <div className="flex gap-4 relative z-10 font-bold uppercase tracking-tighter">
 <div className="bg-app-surface-2/50 backdrop-blur-md p-4 rounded-2xl border border-app-border flex flex-col items-center justify-center min-w-[100px]">
 <span className="text-2xl text-app-primary">01</span>
 <span className="text-[10px] text-app-muted-foreground">Upload</span>
 </div>
 <div className="bg-app-surface-2/50 backdrop-blur-md p-4 rounded-2xl border border-app-border flex flex-col items-center justify-center min-w-[100px]">
 <span className="text-2xl text-app-info">02</span>
 <span className="text-[10px] text-app-muted-foreground">Map</span>
 </div>
 <div className="bg-app-surface-2/50 backdrop-blur-md p-4 rounded-2xl border border-app-border flex flex-col items-center justify-center min-w-[100px]">
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
 <HelpCircle className="text-app-primary" size={20} />
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

 <div className="bg-app-primary-light p-8 rounded-[2rem] border border-app-success/30/50">
 <div className="flex items-center gap-3 mb-4">
 <TrendingUp className="text-app-primary" size={20} />
 <h3 className="text-sm font-black uppercase tracking-tight text-app-success">Performance</h3>
 </div>
 <p className="text-[11px] text-app-success font-medium leading-relaxed">
 Optimized for batches up to 5,000 rows. Larger files should be split for granular auditing.
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}
