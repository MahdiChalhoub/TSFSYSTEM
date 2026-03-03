import { erpFetch } from "@/lib/erp-api";
import { WarehouseClient } from "./WarehouseClient";
import { Warehouse, ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

async function getWarehousesData() {
 try {
 const warehouses = await erpFetch('inventory/warehouses/');
 return (warehouses as any[]) || [];
 } catch (error) {
 console.error("Failed to fetch warehouses:", error);
 return [];
 }
}

export default async function WarehousesPage() {
 const warehouses = await getWarehousesData();

 return (
 <div className="app-page p-8 space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
 {/* Header */}
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Warehouse size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Inventory</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Warehouse <span className="text-app-primary">Manager</span>
          </h1>
        </div>
      </div>
    </header>

 <WarehouseClient initialWarehouses={warehouses} />
 </div>
 );
}