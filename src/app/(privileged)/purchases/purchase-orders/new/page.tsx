import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import { getFinancialSettings } from "@/app/actions/finance/settings";
import PurchaseForm from "./form";
import { serializeDecimals } from "@/lib/utils/serialization";
import { getAssignableUsers, getDrivers } from "@/app/actions/users";
import { getAnalyticsProfiles } from "@/app/actions/settings/analytics-profiles";

export const dynamic = 'force-dynamic';

/**
 * Build the (Site → child warehouses) tree from the unified Warehouse master
 * at `warehouses/`. The Warehouse model is the source of truth — branches and
 * sub-locations are all rows there, distinguished by `location_type` and
 * `parent`. Building the tree client-side here keeps the SETUP wizard
 * dropdowns (Site, then Warehouse) reading from the same place that
 * `/inventory/warehouses` shows, so a new branch added there appears here
 * without a separate sync. Falls back to the old `sites/` endpoint if the
 * warehouses payload is unavailable for any reason (auth, transient 5xx).
 */
async function getSitesAndWarehouses() {
    try {
        const data: any = await erpFetch('warehouses/')
        const rows: any[] = Array.isArray(data) ? data : (data?.results ?? [])
        if (!rows.length) return []
        const branches = rows.filter(w => w.location_type === 'BRANCH')
        return branches.map(b => ({
            ...b,
            warehouses: rows.filter(w => Number(w.parent) === Number(b.id) && w.is_active !== false),
        }))
    } catch (e) {
        console.error("Failed to fetch warehouses", e);
        try {
            return await erpFetch('sites/?include_warehouses=true');
        } catch {
            return [];
        }
    }
}

/**
 * Fetch a single PO for the `?edit=<id>` flow. We swallow the error
 * (returning null) so the page falls back to a blank create form rather
 * than 500ing — the operator gets a usable screen even if the id is bad.
 */
async function getEditableOrder(id: string): Promise<Record<string, unknown> | null> {
    try {
        const po = await erpFetch(`purchase-orders/${id}/`)
        return po && typeof po === 'object' ? (po as Record<string, unknown>) : null
    } catch (e) {
        console.error('Failed to fetch PO for edit:', e)
        return null
    }
}

export default async function NewPurchasePage({
    searchParams,
}: {
    searchParams?: Promise<{ edit?: string }>
}) {
    // Next 15 ships `searchParams` as a promise even when there are no
    // params — `await` it once and read keys off the resolved object.
    const params = (await searchParams) ?? {}
    const editId = params.edit && /^\d+$/.test(params.edit) ? params.edit : null

    const [suppliers, sites, financialSettings, assignees, drivers, profilesData, initialPO, currentUser] = await Promise.all([
        getContactsByType('SUPPLIER'),
        getSitesAndWarehouses(),
        getFinancialSettings(),
        // Two narrowed user lists for the form's Ownership step:
        //   - assignees: people who can be made owner of a PO (purchase-perm
        //     roles, staff, superuser).
        //   - drivers:   users with a Driver row, scoped to module=purchase
        //     when the per-module flag exists.
        getAssignableUsers('purchase'),
        getDrivers('purchase'),
        getAnalyticsProfiles('purchase-order'),
        editId ? getEditableOrder(editId) : Promise.resolve(null),
        import('@/app/actions/auth').then(m => m.getUser()),
    ]);

    return (
        <PurchaseForm
            suppliers={serializeDecimals(suppliers)}
            sites={sites}
            financialSettings={serializeDecimals(financialSettings)}
            assignees={assignees}
            drivers={drivers}
            profilesData={profilesData}
            currentUser={currentUser}
            mode={initialPO ? 'edit' : 'create'}
            initialPO={initialPO ? (serializeDecimals(initialPO) as Record<string, unknown>) : null}
        />
    );
}
