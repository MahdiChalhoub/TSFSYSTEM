import { getGlobalInventory } from "@/app/actions/inventory/viewer";
import GlobalInventoryManager from "./manager";
import { Globe, Layers } from "lucide-react";
import { serializeDecimals } from "@/lib/utils/serialization";

export const dynamic = 'force-dynamic';

export default async function GlobalInventoryPage() {
    const initialData = await getGlobalInventory();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Page Hero */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white">
                            <Globe size={16} />
                        </div>
                        <span className="text-[10px] font-black text-app-info uppercase tracking-[0.3em]">Corporate Intelligence</span>
                    </div>
                    <h1 className="text-5xl lg:text-6xl font-black text-app-foreground tracking-tighter">
                        Global <span className="text-app-info">Inventory</span> Ledger
                    </h1>
                    <p className="mt-4 text-app-muted-foreground font-medium max-w-xl">
                        Real-time view of all stock units across every branch and warehouse in the TSF Enterprise network.
                    </p>
                </div>

                <div className="flex gap-4">
                    <button className="px-8 py-4 bg-app-surface border border-app-border rounded-[28px] font-black uppercase text-[10px] tracking-widest text-app-muted-foreground hover:text-app-info hover:border-indigo-100 transition-all shadow-xl shadow-gray-200/50">
                        Export Master Sheet
                    </button>
                    <button className="px-8 py-4 bg-indigo-600 text-white rounded-[28px] font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-2">
                        <Layers size={14} />
                        Stock Reconciliation
                    </button>
                </div>
            </div>

            <GlobalInventoryManager
                initialData={serializeDecimals(initialData)}
                fetchAction={getGlobalInventory}
            />
        </div>
    );
}