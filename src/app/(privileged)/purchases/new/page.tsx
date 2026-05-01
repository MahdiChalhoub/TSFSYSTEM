import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import { getFinancialSettings } from "@/app/actions/finance/settings";
import PurchaseForm from "./form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { serializeDecimals } from "@/lib/utils/serialization";
import { getUsers } from "@/app/actions/users";
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

export default async function NewPurchasePage() {
    const [suppliers, sites, financialSettings, users, profilesData] = await Promise.all([
        getContactsByType('SUPPLIER'),
        getSitesAndWarehouses(),
        getFinancialSettings(),
        getUsers(),
        getAnalyticsProfiles('purchase-order')
    ]);

    return (
        <PurchaseForm
            suppliers={serializeDecimals(suppliers)}
            sites={sites}
            financialSettings={serializeDecimals(financialSettings)}
            users={users}
            profilesData={profilesData}
        />
    );
}