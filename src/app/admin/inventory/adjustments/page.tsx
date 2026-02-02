import { erpFetch } from "@/lib/erp-api";
import StockAdjustmentManager from "./manager";
import { Sliders } from "lucide-react";

export const dynamic = 'force-dynamic';

async function getWarehouses() {
    try {
        const warehouses = await erpFetch('warehouses/');
        // Filter active directly here since backend returns all
        return warehouses.filter((w: any) => w.is_active);
    } catch (e) {
        console.error("Failed to fetch warehouses", e);
        return [];
    }
}

export default async function AdjustmentPage() {
    // Transform data to match the component's expected type if necessary
    const rawWarehouses = await getWarehouses();
    const warehouses = rawWarehouses.map((w: any) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        siteId: w.site?.id,
        site: w.site ? { name: w.site.name } : undefined
    }));

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-8 lg:p-12">
            <div className="max-w-6xl mx-auto space-y-10">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-rose-500 rounded-lg text-white">
                                <Sliders size={16} />
                            </div>
                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em]">Stock Operations</span>
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tighter">
                            Stock <span className="text-rose-500">Adjustment</span>
                        </h1>
                        <p className="mt-4 text-gray-500 font-medium max-w-xl">
                            Correct inventory discrepancies, report damages, or log found items manually.
                            Use this for non-commercial movements only.
                        </p>
                    </div>
                </div>

                <StockAdjustmentManager warehouses={warehouses} />
            </div>
        </div>
    );
}
