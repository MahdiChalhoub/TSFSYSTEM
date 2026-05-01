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

async function getSitesAndWarehouses() {
    try {
        return await erpFetch('sites/?include_warehouses=true');
    } catch (e) {
        console.error("Failed to fetch sites", e);
        return [];
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