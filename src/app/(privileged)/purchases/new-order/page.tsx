// @ts-nocheck
import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import FormalOrderForm from "./form";
import { serializeDecimals } from "@/lib/utils/serialization";

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
        // Fetch drivers first, fallback to all active users if none marked
        let data = await erpFetch('users/?is_driver=true');
        let drivers = Array.isArray(data) ? data : (data?.results ?? []);
        if (drivers.length === 0) {
            // No one marked as driver → show all active users as candidates
            data = await erpFetch('users/?is_active=true');
            drivers = Array.isArray(data) ? data : (data?.results ?? []);
        }
        return drivers;
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
            <div className="layout-container-padding max-w-[1600px] mx-auto">
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
