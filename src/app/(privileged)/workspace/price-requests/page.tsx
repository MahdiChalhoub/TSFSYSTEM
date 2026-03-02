/** Supplier Portal Admin — Price Change Request Review */
import { erpFetch } from "@/lib/erp-api";
import { DollarSign, TrendingUp, TrendingDown, Clock } from "lucide-react";
import PriceRequestClient from "./client";

export const dynamic = 'force-dynamic';

async function getRequests() {
 try { return await erpFetch('supplier-portal/admin-price-requests/'); } catch { return []; }
}

export default async function PriceRequestPage() {
 const requests = await getRequests();

 const pending = requests.filter((r: any) => r.status === 'PENDING').length;
 const increases = requests.filter((r: any) => r.proposed_price > r.current_price).length;
 const decreases = requests.filter((r: any) => r.proposed_price < r.current_price).length;

 const stats = [
 { label: 'Total Requests', value: requests.length, icon: DollarSign, color: '#6366f1' },
 { label: 'Pending Review', value: pending, icon: Clock, color: '#f59e0b' },
 { label: 'Price Increases', value: increases, icon: TrendingUp, color: '#ef4444' },
 { label: 'Price Decreases', value: decreases, icon: TrendingDown, color: '#22c55e' },
 ];

 return (
 <div className="space-y-8 animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
 <div>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
 <DollarSign size={28} className="text-app-text" />
 </div>
 Price <span className="text-indigo-600">Requests</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">
 Supplier Portal &bull; Cost Control
 </p>
 </div>
 </header>

 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col justify-between relative overflow-hidden group hover:border-indigo-100 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-indigo-600 tracking-tighter mb-1">{requests.length}</div>
 <div className="text-[10px] font-black text-app-text-faint uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Total Requests</div>
 </div>
 <div className="absolute top-4 right-4 text-indigo-100 group-hover:text-indigo-200 transition-colors">
 <DollarSign size={24} />
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col justify-between relative overflow-hidden group hover:border-amber-100 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-amber-600 tracking-tighter mb-1">{pending}</div>
 <div className="text-[10px] font-black text-app-text-faint uppercase tracking-widest group-hover:text-amber-600 transition-colors">Pending Review</div>
 </div>
 <div className="absolute top-4 right-4 text-amber-100 group-hover:text-amber-200 transition-colors">
 <Clock size={24} />
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col justify-between relative overflow-hidden group hover:border-red-100 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-red-600 tracking-tighter mb-1">{increases}</div>
 <div className="text-[10px] font-black text-app-text-faint uppercase tracking-widest group-hover:text-red-600 transition-colors">Price Increases</div>
 </div>
 <div className="absolute top-4 right-4 text-red-100 group-hover:text-red-200 transition-colors">
 <TrendingUp size={24} />
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-50 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-100 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-emerald-600 tracking-tighter mb-1">{decreases}</div>
 <div className="text-[10px] font-black text-app-text-faint uppercase tracking-widest group-hover:text-emerald-600 transition-colors">Price Decreases</div>
 </div>
 <div className="absolute top-4 right-4 text-emerald-100 group-hover:text-emerald-200 transition-colors">
 <TrendingDown size={24} />
 </div>
 </div>
 </div>

 <PriceRequestClient requests={requests} />
 </div>
 );
}
