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
        <div className="min-h-screen flex flex-col animate-in fade-in duration-300"
            style={{ background: 'var(--app-background)' }}>

            {/* ── Minimal Header Bar ── */}
            <div className="sticky top-0 z-50 flex items-center justify-between px-5 py-3"
                style={{
                    background: 'var(--app-surface)',
                    borderBottom: '1px solid var(--app-border)',
                    boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 4%, transparent)',
                }}>
                <div className="flex items-center gap-3">
                    <Link href="/purchases" className="p-1.5 rounded-full transition-colors hover:bg-app-border/20"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <ArrowLeft size={18} />
                    </Link>
                    <h1 className="text-lg md:text-xl font-black tracking-tight"
                        style={{ color: 'var(--app-foreground)' }}>
                        New <span style={{ color: 'var(--app-primary)' }}>Purchase Order</span>
                    </h1>
                </div>
            </div>

            {/* ── Form Body ── */}
            <div className="flex-1 flex flex-col">
                <PurchaseForm
                    suppliers={serializeDecimals(suppliers)}
                    sites={sites}
                    financialSettings={serializeDecimals(financialSettings)}
                />
            </div>
        </div>
    );
}