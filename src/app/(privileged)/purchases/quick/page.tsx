/**
 * Quick Purchase
 * ==============
 * Cash-and-carry style purchase: PO + GRN + Invoice posted in one shot
 * via the legacy `quick_purchase` backend endpoint. No DRAFT lifecycle,
 * no separate receive step — the journal vouchers (AP / VAT input /
 * inventory receipt) all post the moment the form is saved.
 *
 * For the formal PO workflow (DRAFT → SUBMITTED → … → RECEIVED → INVOICED)
 * use /purchases/new instead. The two pages share the same form
 * component; the only difference is the submit action.
 */
import { erpFetch } from '@/lib/erp-api';
import { getContactsByType } from '@/app/actions/crm/contacts';
import { getFinancialSettings } from '@/app/actions/finance/settings';
import { getUsers } from '@/app/actions/users';
import { getAnalyticsProfiles } from '@/app/actions/settings/analytics-profiles';
import { serializeDecimals } from '@/lib/utils/serialization';
import PurchaseForm from '../new/form';

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
