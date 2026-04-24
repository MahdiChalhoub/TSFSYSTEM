import { erpFetch } from "@/lib/erp-api";
import { PurchasesRegistryClient } from "./PurchasesRegistryClient";

export const dynamic = 'force-dynamic';

async function getPurchaseOrders() {
    try {
        const data = await erpFetch(`purchase-orders/`);
        return Array.isArray(data) ? data : (data?.results ?? []);
    } catch (e) {
        console.error("Failed to fetch purchase orders:", e);
        return [];
    }
}

async function getOrgSettings() {
    try {
        const orgs = await erpFetch('organizations/');
        if (Array.isArray(orgs) && orgs.length > 0) {
            return {
                tradeSubTypesEnabled: orgs[0]?.settings?.enable_trade_sub_types ?? false,
                currency: orgs[0]?.currency || orgs[0]?.base_currency_code || 'USD',
            };
        }
    } catch { /* noop */ }
    return { tradeSubTypesEnabled: false, currency: 'USD' };
}

export default async function PurchaseRegistryPage() {
    const [orders, org] = await Promise.all([
        getPurchaseOrders(),
        getOrgSettings(),
    ]);
    return (
        <PurchasesRegistryClient
            orders={orders}
            currency={org.currency}
            tradeSubTypesEnabled={org.tradeSubTypesEnabled}
        />
    );
}
