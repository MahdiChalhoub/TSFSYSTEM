import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import { getFinancialSettings } from "@/app/actions/finance/settings";
import PurchaseForm from "./form";
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

async function getPaymentTerms() {
    try {
        const d = await erpFetch('payment-terms/');
        return Array.isArray(d) ? d : (d?.results ?? []);
    } catch { return []; }
}

async function getDrivers() {
    try {
        const d = await erpFetch('users/?is_driver=true');
        return Array.isArray(d) ? d : (d?.results ?? []);
    } catch { return []; }
}

async function getUsers() {
    try {
        const d = await erpFetch('users/');
        return Array.isArray(d) ? d : (d?.results ?? []);
    } catch { return []; }
}

export default async function RestoredPurchasePage() {
    const [suppliers, sites, financialSettings, paymentTerms, drivers, users] = await Promise.all([
        getContactsByType('SUPPLIER'),
        getSitesAndWarehouses(),
        getFinancialSettings(),
        getPaymentTerms(),
        getDrivers(),
        getUsers(),
    ]);

    return (
        <div className="min-h-screen flex flex-col animate-in fade-in duration-300"
            style={{ background: 'var(--app-background)' }}>
            <PurchaseForm
                suppliers={serializeDecimals(suppliers)}
                sites={sites}
                financialSettings={serializeDecimals(financialSettings)}
                paymentTerms={paymentTerms}
                drivers={drivers}
                users={users}
            />
        </div>
    );
}
