'use server';

import { erpFetch } from "@/lib/erp-api";

export async function getCommercialContext() {
    try {
        const [orgs, settings] = await Promise.all([
            erpFetch('organizations/'),
            erpFetch('settings/global_financial/')
        ]);

        const org = Array.isArray(orgs) ? orgs[0] : orgs;
        const currency = org?.currency_symbol || org?.base_currency?.symbol || org?.currency_code || org?.settings?.currency || 'CFA';

        return {
            orgId: org?.id,
            currency,
            tradeSubTypesEnabled: settings?.enable_trade_sub_types ?? false,
            defaultWarehouseId: settings?.default_warehouse_id || 1,
            organization: org,
            posPaymentMethods: org?.settings?.pos_payment_methods || null
        };
    } catch (error) {
        console.error('[getCommercialContext] Error:', error);
        return {
            currency: 'CFA',
            tradeSubTypesEnabled: false,
            defaultWarehouseId: 1
        };
    }
}
