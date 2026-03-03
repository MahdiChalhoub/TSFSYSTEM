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
 { label: 'Pending Review', value: pending, icon: Clock, color: 'var(--app-warning)' },
 { label: 'Price Increases', value: increases, icon: TrendingUp, color: '#ef4444' },
 { label: 'Price Decreases', value: decreases, icon: TrendingDown, color: 'var(--app-success)' },
 ];

 return (
 <div className="app-page space-y-8 animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <DollarSign size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Workspace</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Price <span className="text-app-primary">Requests</span>
          </h1>
        </div>
      </div>
    </header>

 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-app-border/20 border border-app-border flex flex-col justify-between relative overflow-hidden group hover:border-app-primary/30 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-app-primary tracking-tighter mb-1">{requests.length}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest group-hover:text-app-primary transition-colors">Total Requests</div>
 </div>
 <div className="absolute top-4 right-4 text-app-primary group-hover:text-app-primary transition-colors">
 <DollarSign size={24} />
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-app-border/20 border border-app-border flex flex-col justify-between relative overflow-hidden group hover:border-app-warning/30 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-app-warning tracking-tighter mb-1">{pending}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest group-hover:text-app-warning transition-colors">Pending Review</div>
 </div>
 <div className="absolute top-4 right-4 text-amber-100 group-hover:text-amber-200 transition-colors">
 <Clock size={24} />
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-app-border/20 border border-app-border flex flex-col justify-between relative overflow-hidden group hover:border-app-error/30 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-app-error tracking-tighter mb-1">{increases}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest group-hover:text-app-error transition-colors">Price Increases</div>
 </div>
 <div className="absolute top-4 right-4 text-app-error group-hover:text-app-error transition-colors">
 <TrendingUp size={24} />
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-3xl shadow-xl shadow-app-border/20 border border-app-border flex flex-col justify-between relative overflow-hidden group hover:border-app-success/30 transition-all duration-300">
 <div className="relative z-10">
 <div className="text-4xl font-black text-app-primary tracking-tighter mb-1">{decreases}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest group-hover:text-app-primary transition-colors">Price Decreases</div>
 </div>
 <div className="absolute top-4 right-4 text-app-success group-hover:text-app-success transition-colors">
 <TrendingDown size={24} />
 </div>
 </div>
 </div>

 <PriceRequestClient requests={requests} />
 </div>
 );
}
