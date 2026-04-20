// @ts-nocheck
import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import { getFinancialSettings } from "@/app/actions/finance/settings";
import { serializeDecimals } from "@/lib/utils/serialization";
import PvSwitcher from "./PvSwitcher";

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

export default async function PvPage() {
    const [suppliers, sites, financialSettings, paymentTerms, drivers] = await Promise.all([
        getContactsByType('SUPPLIER'),
        getSitesAndWarehouses(),
        getFinancialSettings(),
        getPaymentTerms(),
        getDrivers(),
    ]);

    const normalizedSuppliers = Array.isArray(suppliers) ? suppliers : [];
    const normalizedSites = Array.isArray(sites) ? sites : [];

    return (
        <PvSwitcher
            suppliers={serializeDecimals(normalizedSuppliers)}
            sites={normalizedSites}
            financialSettings={serializeDecimals(financialSettings)}
            paymentTerms={paymentTerms}
            drivers={drivers}
        />
    );
}
