import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import { getFinancialSettings } from "@/app/actions/finance/settings";
import PurchaseForm from "./form";
import { ShoppingCart } from "lucide-react";
import { serializeDecimals } from "@/lib/utils/serialization";

export const dynamic = 'force-dynamic';

async function getSitesAndWarehouses() {
    try {
        // Fetch sites with warehouses from Django API
        // Assuming Django serializer returns warehouses nested in sites
        // We might need to adjust the query param if Django follows different convention
        // For now, let's fetch sites and hope the standard serializer includes details or we need a specific view

        // Actually, let's check if we have a specific action for this already in src/app/actions
        // But for now, direct fetch:
        return await erpFetch('sites/?include_warehouses=true');
    } catch (e) {
        console.error("Failed to fetch sites", e);
        return [];
    }
}

export default async function NewPurchasePage() {
    const [suppliers, sites, financialSettings] = await Promise.all([
        getContactsByType('SUPPLIER'),
        getSitesAndWarehouses(),
        getFinancialSettings()
    ]);

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 lg:p-8">
            <div className="max-w-[1600px] mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-500 rounded-lg text-white font-bold text-xs">
                                PUR
                            </div>
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Commercial Operations</span>
                        </div>
                        <h1 className="text-3xl lg:text-4xl font-black text-gray-900 tracking-tighter">
                            Inventory <span className="text-emerald-500">Replenishment</span>
                        </h1>
                    </div>
                </div>

                <PurchaseForm
                    suppliers={serializeDecimals(suppliers)}
                    sites={sites}
                    financialSettings={serializeDecimals(financialSettings)}
                />
            </div>
        </div>
    );
}