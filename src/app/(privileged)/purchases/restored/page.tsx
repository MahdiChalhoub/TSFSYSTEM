// @ts-nocheck
/**
 * /purchases/restored — Full Intelligence Grid restoration route.
 *
 * Recovers the pre-wipe PO experience documented at
 *   /root/.gemini/antigravity/knowledge/tsfsystem_procurement_erp_architecture/
 *     artifacts/implementation/po_intelligence_grid.md
 *
 * Mounts the spec-compliant form from /purchases/new-order-v2 (10-column
 * intelligence grid, 25+ analytics fields, expiry safety tags, multi-branch
 * stock scope) plus the orphaned CatalogueModal brought back in through a
 * fresh toolbar button. Leaves the 2026-04-20 minimalist /purchases/new
 * untouched.
 */
import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import { serializeDecimals } from "@/lib/utils/serialization";
import RestoredPOClient from "./RestoredPOClient";
import { ArrowLeft, Sparkles } from "lucide-react";
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
    } catch {
        return [];
    }
}

async function getDrivers() {
    try {
        const data = await erpFetch('users/?is_driver=true');
        return Array.isArray(data) ? data : (data?.results ?? []);
    } catch {
        return [];
    }
}

export default async function RestoredPurchasePage() {
    const [suppliers, sites, paymentTerms, drivers] = await Promise.all([
        getContactsByType('SUPPLIER'),
        getSitesAndWarehouses(),
        getPaymentTerms(),
        getDrivers(),
    ]);

    const normalizedSuppliers = Array.isArray(suppliers) ? suppliers : [];
    const normalizedSites = Array.isArray(sites) ? sites : [];

    return (
        <main className="flex flex-col h-[calc(100vh-3.5rem)] animate-in fade-in duration-500"
            style={{ background: 'var(--app-background)' }}>

            {/* Header banner marking this as the restored route */}
            <div className="sticky top-0 z-40 flex items-center justify-between gap-3 px-5 py-3"
                style={{
                    background: 'var(--app-surface)',
                    borderBottom: '1px solid var(--app-border)',
                }}>
                <div className="flex items-center gap-3 min-w-0">
                    <Link href="/purchases" className="p-1.5 rounded-full transition-colors hover:bg-app-border/20"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <ArrowLeft size={18} />
                    </Link>
                    <Sparkles size={16} style={{ color: 'var(--app-primary)' }} />
                    <h1 className="text-lg md:text-xl font-black tracking-tight truncate"
                        style={{ color: 'var(--app-foreground)' }}>
                        Purchase Order — <span style={{ color: 'var(--app-primary)' }}>Intelligence Grid</span>
                    </h1>
                    <span className="hidden md:inline text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)',
                            color: 'var(--app-primary)',
                        }}>
                        Restored V3
                    </span>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col px-4 md:px-6 py-4">
                <RestoredPOClient
                    suppliers={serializeDecimals(normalizedSuppliers)}
                    sites={normalizedSites}
                    paymentTerms={paymentTerms}
                    drivers={drivers}
                />
            </div>
        </main>
    );
}
