import { erpFetch } from "@/lib/erp-api";
import { WarehouseClient } from "./WarehouseClient";

export const dynamic = 'force-dynamic';

async function getWarehousesData() {
    try {
        const warehouses = await erpFetch('warehouses/');
        return (warehouses as any[]) || [];
    } catch (error) {
        console.error("Failed to fetch warehouses:", error);
        return [];
    }
}

export default async function WarehousesPage() {
    const warehouses = await getWarehousesData();

    return (
        <WarehouseClient initialWarehouses={warehouses} />
    );
}