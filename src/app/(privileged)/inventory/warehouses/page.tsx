import { erpFetch } from "@/lib/erp-api";
import WarehouseManager from "./manager";

export const dynamic = 'force-dynamic';

async function getWarehouses() {
    try {
        // WarehouseSerializer now includes site_name and inventory_count
        return await erpFetch('warehouses/');
    } catch (error) {
        console.error("Failed to fetch warehouses:", error);
        return [];
    }
}

export default async function WarehousesPage() {
    const warehouses = await getWarehouses();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <WarehouseManager warehouses={warehouses} />
        </div>
    );
}