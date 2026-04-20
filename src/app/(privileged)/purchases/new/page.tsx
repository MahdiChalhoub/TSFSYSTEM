import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import { getFinancialSettings } from "@/app/actions/finance/settings";
import PurchaseForm from "./form";
import { ShoppingCart } from "lucide-react";
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

export default async function NewPurchasePage() {
    const [suppliers, sites, financialSettings] = await Promise.all([
        getContactsByType('SUPPLIER'),
        getSitesAndWarehouses(),
        getFinancialSettings()
    ]);

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-4 md:p-6 animate-in fade-in duration-300 transition-all overflow-hidden">
            <div className="max-w-[1400px] mx-auto w-full h-full flex flex-col min-h-0 gap-4">
                
                {/* ── Page Header (Dajingo Pro V2) ── */}
                <div className="shrink-0 flex items-center gap-4 border-b border-app-border/40 pb-2">
                    <div className="page-header-icon bg-app-primary"
                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <ShoppingCart size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">New Purchase Order</h1>
                        <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            Procurement · Intelligence Grid
                        </p>
                    </div>
                </div>

                {/* ── Purchase Form ── */}
                <PurchaseForm
                    suppliers={serializeDecimals(suppliers)}
                    sites={sites}
                    financialSettings={serializeDecimals(financialSettings)}
                />
            </div>
        </div>
    );
}