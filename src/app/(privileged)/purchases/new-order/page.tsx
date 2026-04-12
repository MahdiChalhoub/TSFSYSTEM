import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import FormalOrderForm from "./form";
import { FileText } from "lucide-react";
import { serializeDecimals } from "@/lib/utils/serialization";

export const dynamic = 'force-dynamic';

async function getSitesAndWarehouses() {
    try {
        return await erpFetch('sites/?include_warehouses=true');
    } catch (e) {
        console.error("Failed to fetch sites", e);
        return [];
    }
}

export default async function NewFormalOrderPage() {
    const [suppliers, sites] = await Promise.all([
        getContactsByType('SUPPLIER'),
        getSitesAndWarehouses(),
    ]);

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-500 rounded-lg text-white">
                            <FileText size={16} />
                        </div>
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">Procurement Lifecycle</span>
                    </div>
                    <h1 className="text-3xl lg:text-4xl font-black text-app-foreground tracking-tighter">
                        Request for <span className="text-indigo-500">Quotation</span>
                    </h1>
                    <p className="text-sm text-app-muted-foreground mt-1">Create a draft order to negotiate prices with suppliers.</p>
                </div>
            </div>

            <FormalOrderForm
                suppliers={serializeDecimals(suppliers)}
                sites={sites}
            />
        </div>
    );
}
