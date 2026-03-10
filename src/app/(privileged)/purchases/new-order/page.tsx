// @ts-nocheck
import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import FormalOrderForm from "./form";
import { FileText, ArrowLeft } from "lucide-react";
import { serializeDecimals } from "@/lib/utils/serialization";
import Link from "next/link";

export const dynamic = 'force-dynamic';

async function getSitesAndWarehouses() {
    try {
        const data = await erpFetch('sites/?include_warehouses=true');
        return Array.isArray(data) ? data : (data?.results ?? []);
    } catch (e) {
        console.error("Failed to fetch sites", e);
        return [];
    }
}

async function getPaymentTerms() {
    try {
        const data = await erpFetch('payment-terms/');
        return Array.isArray(data) ? data : (data?.results ?? []);
    } catch { return []; }
}

async function getDrivers() {
    try {
        const data = await erpFetch('users/?is_driver=true');
        return Array.isArray(data) ? data : (data?.results ?? []);
    } catch { return []; }
}

export default async function NewFormalOrderPage() {
    const [suppliers, sites, paymentTerms, drivers] = await Promise.all([
        getContactsByType('SUPPLIER'),
        getSitesAndWarehouses(),
        getPaymentTerms(),
        getDrivers(),
    ]);

    return (
        <main className="animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-[1600px] mx-auto space-y-6">
                {/* Back link */}
                <Link href="/purchases"
                    className="inline-flex items-center gap-2 text-xs font-bold text-app-muted-foreground hover:text-app-foreground transition-colors py-2">
                    <ArrowLeft size={14} /> Back to Procurement
                </Link>

                {/* Page header */}
                <header className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10 flex items-center justify-center shadow-sm border border-indigo-500/10">
                        <FileText size={26} className="text-indigo-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-app-foreground">
                            New <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">Purchase Order</span>
                        </h1>
                        <p className="text-xs text-app-muted-foreground mt-0.5">
                            Create a formal purchase order with intelligent procurement analytics
                        </p>
                    </div>
                </header>

                {/* Form */}
                <FormalOrderForm
                    suppliers={serializeDecimals(Array.isArray(suppliers) ? suppliers : [])}
                    sites={Array.isArray(sites) ? sites : []}
                    paymentTerms={serializeDecimals(Array.isArray(paymentTerms) ? paymentTerms : [])}
                    drivers={serializeDecimals(Array.isArray(drivers) ? drivers : [])}
                />
            </div>
        </main>
    );
}
