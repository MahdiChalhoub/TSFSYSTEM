import { erpFetch } from "@/lib/erp-api";
import { WarehouseClient } from "./WarehouseClient";
import { Warehouse, ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

async function getWarehousesData() {
 try {
 const warehouses = await erpFetch('warehouses/');
 return (warehouses as any[]) || [];
 } catch (error) {
 console.error("Failed to fetch warehouses:", error);
 return [];
 }
}

export default async function WarehousesPage() {
 const warehouses = await getWarehousesData();

 return (
 <div className="p-8 space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
 {/* Header */}
 <header className="flex flex-col md:flex-row justify-between items-center gap-6">
 <div>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 text-app-text">
 <Warehouse size={28} />
 </div>
 Storage <span className="text-emerald-600">Nodes</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">Infrastructure Terminal Registry</p>
 </div>
 <div className="flex gap-3">
 <Button variant="outline" className="rounded-2xl h-12 px-6 gap-2 border-app-border hover:bg-app-bg transition-all shadow-sm">
 <ArrowLeft size={18} /> Back
 </Button>
 <Button className="rounded-2xl h-12 px-6 gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all">
 <Plus size={18} /> Add Node
 </Button>
 </div>
 </header>

 <WarehouseClient initialWarehouses={warehouses} />
 </div>
 );
}