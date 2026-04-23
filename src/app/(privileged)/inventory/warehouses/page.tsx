import { erpFetch } from "@/lib/erp-api";
import { getOrgCountries } from "@/app/actions/reference";
import { WarehouseClient } from "./WarehouseClient";

export const dynamic = 'force-dynamic';

async function getWarehouses() {
    try {
        const data = await erpFetch('warehouses/');
        return Array.isArray(data) ? data : (data?.results ?? []);
    } catch (error) {
        console.error("[WAREHOUSE PAGE] fetch failed:", error);
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