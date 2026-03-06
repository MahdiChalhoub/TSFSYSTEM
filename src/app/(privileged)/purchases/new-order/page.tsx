// @ts-nocheck
import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import FormalOrderForm from "./form";
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

export default async function NewFormalOrderPage() {
    const [suppliers, sites] = await Promise.all([
        getContactsByType('SUPPLIER'),
        getSitesAndWarehouses(),
    ]);

    const normalizedSuppliers = Array.isArray(suppliers) ? suppliers : [];
    const normalizedSites = Array.isArray(sites) ? sites : [];

    return (
        <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-5xl mx-auto space-y-[var(--layout-section-spacing)]">
                <Link href="/purchases" className="inline-flex items-center gap-2 text-sm font-bold theme-text-muted hover:theme-text transition-colors min-h-[44px] md:min-h-[auto]">
                    ← Back to Procurement Center
                </Link>

                <header className="flex items-center gap-3 md:gap-4">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shadow-sm">
                        <FileText size={24} className="text-indigo-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight theme-text">
                            New <span className="text-indigo-500">Purchase Order</span>
                        </h1>
                        <p className="text-xs theme-text-muted mt-0.5">Create a formal purchase order for supplier</p>
                    </div>
                </header>

                <FormalOrderForm
                    suppliers={serializeDecimals(normalizedSuppliers)}
                    sites={normalizedSites}
                />
            </div>
        </main>
    );
}
