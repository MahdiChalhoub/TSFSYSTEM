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
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Header */}
            <header>
                <h1 className="text-4xl font-black text-gray-900 tracking-tighter flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                        <ShoppingCart size={28} className="text-white" />
                    </div>
                    Inventory <span className="text-emerald-500">Replenishment</span>
                </h1>
                <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Commercial Operations & Stock Procurement</p>
            </header>

            <PurchaseForm
                suppliers={serializeDecimals(suppliers)}
                sites={sites}
                financialSettings={serializeDecimals(financialSettings)}
            />
        </div>
    );
}