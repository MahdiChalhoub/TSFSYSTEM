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
        <div className="space-y-6 animate-in fade-in duration-500">
            <header>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-rose-500 rounded-lg text-white">
                        <Sliders size={16} />
                    </div>
                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em]">Operational Operations</span>
                </div>
                <h1 className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tighter">
                    Stock <span className="text-rose-500">Adjustments</span>
                </h1>
                <p className="mt-2 text-gray-500 font-medium max-w-xl">
                    Real-time stock adjustments. Drafts here immediately affect stock levels.
                    Finalized records are uneditable for audit compliance.
                </p>
            </header>

            <AdjustmentsClient warehouses={warehouses} />
        </div>
    );
}