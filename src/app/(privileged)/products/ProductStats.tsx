'use client';

import {
 Activity,
 AlertCircle,
 Barcode,
 ChevronRight,
 DollarSign,
 Layers,
 Package,
 ShieldAlert,
 Zap
} from 'lucide-react';

interface StatsProps {
 stats: {
 total_products: number;
 missing_barcode: number;
 missing_category: number;
 missing_brand: number;
 zero_tva: number;
 zero_cost_price: number;
 zero_selling_price: number;
 missing_name: number;
 }
}

export default function ProductDashboardStats({ stats }: StatsProps) {
 if (!stats) return null;

 const healthScore = Math.max(0, 100 - (
 (stats.missing_barcode * 5) +
 (stats.zero_selling_price * 10) +
 (stats.missing_category * 5)
 ) / (stats.total_products || 1));

 return (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-top-4 duration-700">
 {/* Health Score Card */}
 <div className="relative group overflow-hidden bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm hover:shadow-xl hover:shadow-app-primary/20 transition-all">
 <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.07] transition-all">
 <Activity size={120} strokeWidth={1} />
 </div>
 <div className="relative flex flex-col gap-4">
 <div className="flex items-center justify-between">
 <div className="w-12 h-12 rounded-2xl bg-app-primary-light flex items-center justify-center text-app-primary">
 <ShieldAlert size={24} />
 </div>
 <span className={`text-xs font-black px-3 py-1 rounded-full ${healthScore > 90 ? 'bg-app-primary text-app-foreground' : 'bg-app-warning text-app-foreground'}`}>
 {healthScore.toFixed(0)}% HEALTH
 </span>
 </div>
 <div>
 <h4 className="text-sm font-bold text-app-muted-foreground uppercase tracking-widest">Catalog Integrity</h4>
 <div className="flex items-baseline gap-2">
 <span className="text-3xl font-black text-app-foreground leading-tight">Elite</span>
 <span className="text-xs font-bold text-app-primary">Master Data</span>
 </div>
 </div>
 </div>
 </div>

 {/* Total Inventory Value Card (Mock or simplified) */}
 <div className="relative group overflow-hidden bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all">
 <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.07] transition-all">
 <DollarSign size={120} strokeWidth={1} />
 </div>
 <div className="relative flex flex-col gap-4">
 <div className="flex items-center justify-between">
 <div className="w-12 h-12 rounded-2xl bg-app-info-bg flex items-center justify-center text-app-info">
 <Package size={24} />
 </div>
 <span className="text-[10px] font-black text-app-info/50 uppercase tracking-tighter">Live Stock</span>
 </div>
 <div>
 <h4 className="text-sm font-bold text-app-muted-foreground uppercase tracking-widest">Total SKUs</h4>
 <div className="flex items-baseline gap-2">
 <span className="text-3xl font-black text-app-foreground leading-tight">{stats.total_products}</span>
 <span className="text-xs font-bold text-app-info">Registered</span>
 </div>
 </div>
 </div>
 </div>

 {/* Missing Barcodes Card */}
 <div className="relative group overflow-hidden bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm hover:shadow-xl hover:shadow-amber-500/5 transition-all">
 <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.07] transition-all">
 <Barcode size={120} strokeWidth={1} />
 </div>
 <div className="relative flex flex-col gap-4">
 <div className="flex items-center justify-between">
 <div className="w-12 h-12 rounded-2xl bg-app-warning-bg flex items-center justify-center text-app-warning">
 <Zap size={24} />
 </div>
 {stats.missing_barcode > 0 && (
 <span className="text-[10px] font-black bg-app-warning text-app-foreground px-3 py-1 rounded-full animate-pulse">
 ACTION REQUIRED
 </span>
 )}
 </div>
 <div>
 <h4 className="text-sm font-bold text-app-muted-foreground uppercase tracking-widest">Missing Barcodes</h4>
 <div className="flex items-baseline gap-2">
 <span className="text-3xl font-black text-app-foreground leading-tight">{stats.missing_barcode}</span>
 <span className="text-xs font-bold text-app-warning">Ungoverned</span>
 </div>
 </div>
 </div>
 </div>

 {/* Financial Errors Card */}
 <div className={`relative group overflow-hidden p-6 rounded-[2rem] border transition-all ${stats.zero_selling_price > 0 ? 'bg-app-error-bg border-app-error/30 hover:shadow-red-500/5' : 'bg-app-surface border-app-border hover:shadow-app-primary/20'}`}>
 <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.07] transition-all">
 <AlertCircle size={120} strokeWidth={1} />
 </div>
 <div className="relative flex flex-col gap-4">
 <div className="flex items-center justify-between">
 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stats.zero_selling_price > 0 ? 'bg-app-error-bg text-app-error' : 'bg-app-primary-light text-app-primary'}`}>
 <DollarSign size={24} />
 </div>
 </div>
 <div>
 <h4 className="text-sm font-bold text-app-muted-foreground uppercase tracking-widest">Pricing Gaps</h4>
 <div className="flex items-baseline gap-2">
 <span className={`text-3xl font-black leading-tight ${stats.zero_selling_price > 0 ? 'text-app-error' : 'text-app-foreground'}`}>{stats.zero_selling_price}</span>
 <span className={`text-xs font-bold ${stats.zero_selling_price > 0 ? 'text-app-error' : 'text-app-primary'}`}>0.00 Prices</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
