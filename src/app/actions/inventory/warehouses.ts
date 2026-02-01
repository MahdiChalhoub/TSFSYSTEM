'use server';

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type WarehouseState = {
    message?: string;
    errors?: {
        name?: string[];
        code?: string[];
        type?: string[];
    };
};

export async function createWarehouse(prevState: WarehouseState, formData: FormData): Promise<WarehouseState> {
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;
    const type = formData.get('type') as string;
    const canSell = formData.get('canSell') === 'on';
    const address = formData.get('address') as string;
    const city = formData.get('city') as string;
    const isActive = formData.get('isActive') === 'on';

    if (!name || name.length < 2) {
        return { message: 'Validation Error', errors: { name: ['Name must be at least 2 characters'] } };
    }

    try {
        await prisma.warehouse.create({
            data: {
                name,
                code: code?.toUpperCase(),
                type,
                canSell,
                address,
                city,
                isActive
            }
        });

        revalidatePath('/admin/inventory/warehouses');
        return { message: 'success' };
    } catch (e: any) {
        return { message: 'Database Error: ' + e.message };
    }
}

export async function updateWarehouse(id: number, prevState: WarehouseState, formData: FormData): Promise<WarehouseState> {
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;
    const type = formData.get('type') as string;
    const canSell = formData.get('canSell') === 'on';
    const address = formData.get('address') as string;
    const city = formData.get('city') as string;
    const isActive = formData.get('isActive') === 'on';

    try {
        await prisma.warehouse.update({
            where: { id },
            data: {
                name,
                code: code?.toUpperCase(),
                type,
                canSell,
                address,
                city,
                isActive
            }
        });

        revalidatePath('/admin/inventory/warehouses');
        return { message: 'success' };
    } catch (e: any) {
        return { message: 'Database Error: ' + e.message };
    }
}

export async function deleteWarehouse(id: number) {
    try {
        // Check if has inventory
        const hasInventory = await prisma.inventory.findFirst({
            where: { warehouseId: id, quantity: { gt: 0 } }
        });

        if (hasInventory) {
            throw new Error("Cannot delete warehouse with active inventory.");
        }

        await prisma.warehouse.delete({
            where: { id }
        });

        revalidatePath('/admin/inventory/warehouses');
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}
