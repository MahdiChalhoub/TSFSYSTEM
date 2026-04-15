import { erpFetch } from "@/lib/erp-api";
import { getOrgCountries } from "@/app/actions/reference";
import { WarehouseClient } from "./WarehouseClient";

export const dynamic = 'force-dynamic';

async function getWarehouses() {
    try {
        console.log('[WAREHOUSE PAGE] Fetching warehouses...');
        const data = await erpFetch('warehouses/');
        console.log('[WAREHOUSE PAGE] Raw response type:', typeof data);
        console.log('[WAREHOUSE PAGE] Is array:', Array.isArray(data));
        console.log('[WAREHOUSE PAGE] Keys:', data ? Object.keys(data).slice(0, 10) : 'null/undefined');
        console.log('[WAREHOUSE PAGE] Count:', Array.isArray(data) ? data.length : (data?.results?.length ?? 'no results key'));
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        console.log('[WAREHOUSE PAGE] Final list length:', list.length);
        return list;
    } catch (error) {
        console.error("[WAREHOUSE PAGE] FAILED:", error);
        return [];
    }
}

export default async function WarehousesPage() {
    const [warehouses, orgCountries] = await Promise.all([
        getWarehouses(),
        getOrgCountries().catch(() => []),
    ]);

    // Transform org countries into the format expected by WarehouseClient
    const countries = orgCountries
        .filter((oc: any) => oc.is_enabled !== false)
        .map((oc: any) => ({
            id: oc.country,
            name: oc.country_name || `Country #${oc.country}`,
            iso2: oc.country_code,
        }));

    // Find the default country ID
    const defaultOrgCountry = orgCountries.find((oc: any) => oc.is_default);
    const defaultCountryId = defaultOrgCountry?.country || null;

    return (
        <WarehouseClient
            initialWarehouses={warehouses}
            countries={countries}
            defaultCountryId={defaultCountryId}
        />
    );
}