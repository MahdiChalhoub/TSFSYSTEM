import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import FormalOrderFormV2 from "./form";
import { serializeDecimals } from "@/lib/utils/serialization";

export const dynamic = 'force-dynamic';

// Helper: erpFetch returns `unknown` (or a list/paginated wrapper). Normalize to array of records.
function asArray(d: unknown): Record<string, unknown>[] {
    if (Array.isArray(d)) return d as Record<string, unknown>[]
    if (d && typeof d === 'object' && 'results' in d) {
        const results = (d as { results?: unknown }).results
        return Array.isArray(results) ? (results as Record<string, unknown>[]) : []
    }
    return []
}

async function getSitesAndWarehouses(): Promise<Record<string, unknown>[]> {
    try {
        const data = await erpFetch('sites/?include_warehouses=true');
        return asArray(data);
    } catch (e: unknown) {
        console.error("Failed to fetch sites", e);
        return [];
    }
}

async function getPaymentTerms(): Promise<Record<string, unknown>[]> {
    try {
        const data = await erpFetch('payment-terms/');
        return asArray(data);
    } catch {
        return [];
    }
}

async function getDrivers(): Promise<Record<string, unknown>[]> {
    try {
        const data = await erpFetch('users/?is_driver=true');
        return asArray(data);
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
        <main className="flex flex-col h-[calc(100vh-3.5rem)] animate-in fade-in duration-500">
            <div className="flex-1 min-h-0 flex flex-col px-4 md:px-6 py-4">
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
