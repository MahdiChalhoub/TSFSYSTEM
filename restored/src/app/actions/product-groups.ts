'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

export type VariantInput = {
    id?: number;
    countryId: number;
    sku: string;
    barcode?: string;
    size?: number;
    sizeUnitId?: number;
    costPrice: number;
    basePrice: number;
    minStockLevel?: number;

    costPriceHT?: number;
    costPriceTTC?: number;
    sellingPriceHT?: number;
    sellingPriceTTC?: number;
    taxRate?: number;
};

export type ProductGroupState = {
    message?: string;
    errors?: Record<string, string[]>;
};

export async function createProductGroupWithVariants(
    prevState: ProductGroupState,
    data: {
        name: string;
        brandId: number;
        categoryId?: number;
        description?: string;
        baseUnitId: number;
        variants: VariantInput[];
    }
) {
    try {
        await erpFetch('product-groups/create_with_variants/', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });

        revalidatePath('/admin/products');
        return { message: 'success' };
    } catch (e: any) {
        console.error(e);
        return { message: e.message || 'Failed to create product group.' };
    }
}

export async function updateProductGroup(
    prevState: ProductGroupState,
    data: {
        groupId: number;
        name: string;
        brandId: number;
        categoryId?: number;
        description?: string;
        baseUnitId: number;
        variants: VariantInput[];
    }
) {
    const { groupId, brandId } = data;

    try {
        await erpFetch(`product-groups/${groupId}/update_with_variants/`, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });

        revalidatePath('/admin/products');
        revalidatePath(`/admin/inventory/brands/${brandId}`);
        return { message: 'success' };
    } catch (e: any) {
        console.error(e);
        return { message: e.message || 'Failed to update product group.' };
    }
}

export async function linkProductsToGroup(productIds: number[], groupId: number) {
    try {
        await erpFetch(`product-groups/${groupId}/link_products/`, {
            method: 'POST',
            body: JSON.stringify({ productIds }),
            headers: { 'Content-Type': 'application/json' }
        });

        revalidatePath('/admin/products');
        revalidatePath('/admin/inventory/maintenance');
        return { success: true, message: 'Successfully linked products to group.' };
    } catch (e: any) {
        console.error(e);
        return { success: false, message: e.message || 'Failed to link products.' };
    }
}

export async function createGroupFromProducts(
    productIds: number[],
    data: { name: string, description?: string }
) {
    try {
        await erpFetch('product-groups/create_from_products/', {
            method: 'POST',
            body: JSON.stringify({ productIds, ...data }),
            headers: { 'Content-Type': 'application/json' }
        });

        revalidatePath('/admin/products');
        revalidatePath('/admin/inventory/maintenance');
        return { success: true, message: 'Successfully created group from products.' };
    } catch (e: any) {
        console.error(e);
        return { success: false, message: e.message || 'Failed to create group.' };
    }
}