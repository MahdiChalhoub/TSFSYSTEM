import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import { getFinancialSettings } from "@/app/actions/finance/settings";
import { serializeDecimals } from "@/lib/utils/serialization";
import PvSwitcher from "./PvSwitcher";

export const dynamic = 'force-dynamic';

function asArr(d: unknown): Record<string, unknown>[] {
    if (Array.isArray(d)) return d as Record<string, unknown>[];
    if (d && typeof d === 'object' && 'results' in d) {
        const results = (d as { results?: unknown }).results;
        if (Array.isArray(results)) return results as Record<string, unknown>[];
    }
    return [];
}

async function getSitesAndWarehouses(): Promise<Record<string, unknown>[]> {
    try {
        const data = await erpFetch('sites/?include_warehouses=true');
        return asArr(data);
    } catch (e) {
        console.error("Failed to fetch sites", e);
        return [];
    }
}

async function getPaymentTerms(): Promise<Record<string, unknown>[]> {
    try {
        const data = await erpFetch('payment-terms/');
        return asArr(data);
    } catch {
        return [];
    }
}

async function getDrivers(): Promise<Record<string, unknown>[]> {
    try {
        const data = await erpFetch('users/?is_driver=true');
        return asArr(data);
    } catch {
        return [];
    }
}

export default async function PvPage() {
    const [suppliers, sites, financialSettings, paymentTerms, drivers] = await Promise.all([
        getContactsByType('SUPPLIER'),
        getSitesAndWarehouses(),
        getFinancialSettings(),
        getPaymentTerms(),
        getDrivers(),
    ]);

    const normalizedSuppliers: Record<string, unknown>[] = Array.isArray(suppliers)
        ? (suppliers as Record<string, unknown>[])
        : [];
    const normalizedSites: Record<string, unknown>[] = Array.isArray(sites)
        ? (sites as Record<string, unknown>[])
        : [];

    return (
        <PvSwitcher
            suppliers={serializeDecimals(normalizedSuppliers) as Record<string, unknown>[]}
            sites={normalizedSites}
            financialSettings={serializeDecimals(financialSettings) as Record<string, unknown> | null}
            paymentTerms={paymentTerms}
            drivers={drivers}
        />
    );
}
