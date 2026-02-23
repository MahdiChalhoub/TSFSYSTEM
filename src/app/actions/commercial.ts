'use server';

import { erpFetch } from "@/lib/erp-api";

export async function getCommercialContext() {
    try {
        const [orgs, settings] = await Promise.all([
            erpFetch('organizations/'),
            erpFetch('settings/')
        ]);

        const org = Array.isArray(orgs) ? orgs[0] : orgs;
        const currency = org?.currency || org?.settings?.currency || 'USD';

        return {
            orgId: org?.id,
            currency,
            tradeSubTypesEnabled: settings?.enable_trade_sub_types ?? false,
            defaultWarehouseId: settings?.default_warehouse_id || 1,
            organization: org
        };
    } catch (error) {
        console.error('[getCommercialContext] Error:', error);
        return {
            currency: 'USD',
            tradeSubTypesEnabled: false,
            defaultWarehouseId: 1
        };
    }
}
