import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import { getFinancialSettings } from "@/app/actions/finance/settings";
import PurchaseForm from "./form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
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
        <div className="flex flex-col h-[calc(100vh-4rem)] animate-in fade-in duration-300">
            {/* ── Minimal Pinned Header ── */}
            <div className="sticky top-0 z-50 flex items-center gap-4 px-6 py-3 flex-shrink-0"
                style={{
                    background: 'var(--app-surface)',
                    borderBottom: '1px solid var(--app-border)',
                    boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 5%, transparent)',
                }}>
                <Link href="/purchases" className="p-2 rounded-full transition-colors"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-xl md:text-2xl font-black tracking-tight"
                    style={{ color: 'var(--app-foreground)' }}>
                    New <span style={{ color: 'var(--app-primary)' }}>Purchase Order</span>
                </h1>
            </div>

            {/* ── Form Body ── */}
            <div className="flex-1 min-h-0 px-6 mt-4 pb-24 overflow-y-auto">
                <PurchaseForm
                    suppliers={serializeDecimals(suppliers)}
                    sites={sites}
                    financialSettings={serializeDecimals(financialSettings)}
                />
            </div>
        </div>
    );
}