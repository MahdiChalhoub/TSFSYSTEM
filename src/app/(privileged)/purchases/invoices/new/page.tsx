/**
 * New Purchase Invoice — direct-entry path
 * ========================================
 * Books a complete purchase invoice in one step: stock receipt, AP entry,
 * VAT input, and (optional) immediate payment all posted via the
 * `quick_purchase` backend endpoint.
 *
 * Use this when the supplier delivers goods + invoice at the same moment
 * (cash-and-carry, walk-in supplier, urgent restock) and there's no
 * paper-trail need for an approval chain.
 *
 * For the multi-step workflow (PO → Approve → Order → Receive → Invoice)
 * use /purchases/new (the Purchase Order entry point) and follow the
 * lifecycle through to INVOICED. Both endpoints write to the same Postgres
 * tables — this one just collapses the timeline.
 */
import { erpFetch } from '@/lib/erp-api';
import { getContactsByType } from '@/app/actions/crm/contacts';
import { getFinancialSettings } from '@/app/actions/finance/settings';
import { getUsers } from '@/app/actions/users';
import { getAnalyticsProfiles } from '@/app/actions/settings/analytics-profiles';
import { serializeDecimals } from '@/lib/utils/serialization';
// Reuse the PO form — same fields, different submit action driven by mode='quick'
import PurchaseForm from '../../new/form';

export const dynamic = 'force-dynamic';

async function getSitesAndWarehouses() {
    try {
        const data: any = await erpFetch('warehouses/');
        const rows: any[] = Array.isArray(data) ? data : (data?.results ?? []);
        if (!rows.length) return [];
        const branches = rows.filter(w => w.location_type === 'BRANCH');
        return branches.map(b => ({
            ...b,
            warehouses: rows.filter(w => Number(w.parent) === Number(b.id) && w.is_active !== false),
        }));
    } catch {
        try { return await erpFetch('sites/?include_warehouses=true'); } catch { return []; }
    }
}

export default async function QuickPurchasePage() {
    const [suppliers, sites, financialSettings, users, profilesData, currentUser] = await Promise.all([
        getContactsByType('SUPPLIER'),
        getSitesAndWarehouses(),
        getFinancialSettings(),
        getUsers(),
        getAnalyticsProfiles('purchase-order'),
        import('@/app/actions/auth').then(m => m.getUser()),
    ]);

    return (
        <PurchaseForm
            suppliers={serializeDecimals(suppliers)}
            sites={sites}
            financialSettings={serializeDecimals(financialSettings)}
            users={users}
            profilesData={profilesData}
            currentUser={currentUser}
            mode='quick'
            initialPO={null}
        />
    );
}
