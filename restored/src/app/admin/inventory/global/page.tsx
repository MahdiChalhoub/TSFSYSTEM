import { getGlobalInventory } from "@/app/actions/inventory/viewer";
import GlobalInventoryManager from "./manager";
import { Globe, Layers } from "lucide-react";
import { serializeDecimals } from "@/lib/utils/serialization";

export const dynamic = 'force-dynamic';

export default async function GlobalInventoryPage() {
    const initialData = await getGlobalInventory();

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-8 lg:p-12">
            <div className="max-w-[1800px] mx-auto space-y-10">
                {/* Page Hero */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-600 rounded-lg text-white">
                                <Globe size={16} />
                            </div>
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">Corporate Intelligence</span>
                        </div>
                        <h1 className="text-5xl lg:text-6xl font-black text-gray-900 tracking-tighter">
                            Global <span className="text-indigo-600">Inventory</span> Ledger
                        </h1>
                        <p className="mt-4 text-gray-500 font-medium max-w-xl">
                            Real-time view of all stock units across every branch and warehouse in the TSF Enterprise network.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <button className="px-8 py-4 bg-white border border-gray-200 rounded-[28px] font-black uppercase text-[10px] tracking-widest text-gray-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-xl shadow-gray-200/50">
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
        </div>
    );
}