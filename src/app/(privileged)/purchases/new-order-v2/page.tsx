// @ts-nocheck
import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import FormalOrderFormV2 from "./form";
import { FileText } from "lucide-react";
import { serializeDecimals } from "@/lib/utils/serialization";
import Link from "next/link";

export const dynamic = 'force-dynamic';

async function getSitesAndWarehouses() {
    try {
        const data = await erpFetch('erp/sites/?include_warehouses=true');
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
    } catch {
        return [];
    }
}

async function getDrivers() {
    try {
        const data = await erpFetch('users/');
        const users = Array.isArray(data) ? data : (data?.results ?? []);
        return users;
    } catch {
        return [];
    }
}

export default async function NewFormalOrderPageV2() {
    const [suppliers, sites, paymentTerms, drivers] = await Promise.all([
        getContactsByType('SUPPLIER'),
        getSitesAndWarehouses(),
        getPaymentTerms(),
        getDrivers(),
    ]);

    const normalizedSuppliers = Array.isArray(suppliers) ? suppliers : [];
    const normalizedSites = Array.isArray(sites) ? sites : [];

    return (
        <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-[1600px] mx-auto space-y-[var(--layout-section-spacing)]">
                <Link href="/purchases" className="inline-flex items-center gap-2 text-sm font-bold text-app-muted-foreground hover:text-app-foreground transition-colors min-h-[44px] md:min-h-[auto]">
                    ← Back to Procurement Center
                </Link>

                <header className="flex items-center gap-3 md:gap-4">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-app-primary/10 flex items-center justify-center shadow-sm">
                        <FileText size={24} className="text-app-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-app-foreground">
                            New <span className="text-app-primary">Purchase Order</span>
                        </h1>
                        <p className="text-xs text-app-muted-foreground mt-0.5">Create a formal purchase order with intelligence grid</p>
                    </div>
                </header>

                <FormalOrderFormV2
                    suppliers={serializeDecimals(normalizedSuppliers)}
                    sites={normalizedSites}
                    paymentTerms={paymentTerms}
                    drivers={drivers}
                />
            </div>
        </main>
    );
}
