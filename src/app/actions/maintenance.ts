'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

export type MaintenanceEntity = {
    id: number;
    name: string;
    count: number;
    shortName?: string;
    code?: string;
    type?: string;
    children?: MaintenanceEntity[];
};

export async function getMaintenanceEntities(type: 'category' | 'brand' | 'unit' | 'country' | 'attribute'): Promise<MaintenanceEntity[]> {
    const endpointMap: Record<string, string> = {
        category: 'categories/',
        brand: 'brands/',
        unit: 'units/',
        country: 'countries/',
        attribute: 'parfums/'
    };

    try {
        const data = await erpFetch(endpointMap[type]);

        return data.map((item: any) => ({
            id: item.id,
            name: item.name,
            count: item.product_count || 0,
            shortName: item.short_name,
            code: item.code,
            type: item.type,
            children: item.children // For categories
        }));
    } catch (e) {
        console.error(`Failed to fetch ${type} entities:`, e);
        return [];
    }
}

export async function moveProductsGeneric(
    productIds: number[],
    targetId: number,
    type: 'category' | 'brand' | 'unit' | 'country' | 'attribute'
) {
    try {
        await erpFetch('products/bulk_move/', {
            method: 'POST',
            body: JSON.stringify({ productIds, targetId, type }),
            headers: { 'Content-Type': 'application/json' }
        });

        revalidatePath('/admin/inventory');
        revalidatePath('/admin/products');

        return { success: true, message: `Successfully moved ${productIds.length} products.` };
    } catch (error: any) {
        console.error('Bulk Move Error:', error);
        return { success: false, message: error.message || 'Failed to move products.' };
    }
}
