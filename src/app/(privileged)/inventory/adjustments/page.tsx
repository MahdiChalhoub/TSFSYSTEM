import { erpFetch } from "@/lib/erp-api";
import { Sliders } from "lucide-react";
import { AdjustmentsClient } from "./AdjustmentsClient";

export const dynamic = 'force-dynamic';

async function getWarehouses() {
 try {
 const warehouses = await erpFetch('warehouses/');
 return warehouses.filter((w: Record<string, any>) => w.is_active);
 } catch (e) {
 console.error("Failed to fetch warehouses", e);
 return [];
 }
}

export default async function AdjustmentPage() {
 const rawWarehouses = await getWarehouses();
 const warehouses = rawWarehouses.map((w: Record<string, any>) => ({
 id: w.id,
 name: w.name,
 type: w.type,
 siteId: w.site,
 site: w.site_name ? { name: w.site_name } : undefined
 }));

 return (
 <div className="p-8 space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
 {/* Header */}
 <header className="flex flex-col md:flex-row justify-between items-center gap-6">
 <div>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 text-app-text">
 <Sliders size={28} />
 </div>
 Stock <span className="text-emerald-600">Adjustments</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">Operational Inventory Correction & Audit</p>
 </div>
 </header>

 <AdjustmentsClient warehouses={warehouses} />
 </div>
 );
}