import { prisma } from "@/lib/db";
import WarehouseManager from "./manager";

export const dynamic = 'force-dynamic';

async function getWarehouses() {
    return await prisma.warehouse.findMany({
        include: {
            _count: {
                select: { inventory: true }
            },
            site: {
                select: { name: true }
            }
        },
        orderBy: { name: 'asc' }
    });
}

export default async function WarehousesPage() {
    const warehouses = await getWarehouses();

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <WarehouseManager warehouses={warehouses} />
        </div>
    );
}
