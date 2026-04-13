import { erpFetch } from "@/lib/erp-api";
import { WarehouseClient } from "./WarehouseClient";

export const dynamic = 'force-dynamic';

async function getWarehouses() {
    try {
        const data = await erpFetch('warehouses/');
        return Array.isArray(data) ? data : (data?.results ?? []);
    } catch (error) {
        console.error("Failed to fetch warehouses:", error);
        return [];
    }
}

async function getCountries() {
    try {
        const data = await erpFetch('countries/');
        return Array.isArray(data) ? data : (data?.results ?? []);
    } catch {
        return [];
    }
}

export default async function WarehousesPage() {
    const [warehouses, countries] = await Promise.all([getWarehouses(), getCountries()]);

    return (
        <WarehouseClient
            initialWarehouses={warehouses}
            countries={countries}
        />
    );
}