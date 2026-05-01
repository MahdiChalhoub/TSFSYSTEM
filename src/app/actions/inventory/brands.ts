'use server';

import { erpFetch, handleAuthError } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

export type BrandState = {
    message?: string;
    errors?: {
        name?: string[];
        countryId?: string[];
    };
};

export async function createBrand(prevState: BrandState, formData: FormData): Promise<BrandState> {
    const name = formData.get('name') as string;
    const shortName = formData.get('shortName') as string;
    const countryIds = formData.getAll('countryIds').map(id => Number(id));
    const categoryIds = formData.getAll('categoryIds').map(id => Number(id));

    if (!name || name.length < 2) {
        return { message: 'Failed to create brand', errors: { name: ['Name must be at least 2 characters'] } };
    }

    try {
        await erpFetch('inventory/brands/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                short_name: shortName,
                category_ids: categoryIds,
                country_ids: countryIds
            })
        });

        revalidatePath('/inventory/brands');
        return { message: 'success' };
    } catch (e: unknown) {
        return { message: 'Database Error: Failed to create brand.' };
    }
}

export async function updateBrand(id: number, prevState: BrandState, formData: FormData): Promise<BrandState> {
    const name = formData.get('name') as string;
    const shortName = formData.get('shortName') as string;
    const countryIds = formData.getAll('countryIds').map(id => Number(id));
    const categoryIds = formData.getAll('categoryIds').map(id => Number(id));

    try {
        await erpFetch(`inventory/brands/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                short_name: shortName,
                category_ids: categoryIds,
                country_ids: countryIds
            })
        });
        revalidatePath('/inventory/brands');
        revalidatePath('/inventory/categories');
        return { message: 'success' };
    } catch (e) {
        return { message: 'Failed to update brand' };
    }
}

export async function deleteBrand(id: number, options: { force?: boolean } = {}) {
    try {
        const url = options.force ? `inventory/brands/${id}/?force=1` : `inventory/brands/${id}/`;
        await erpFetch(url, { method: 'DELETE' });
        revalidatePath('/inventory/brands');
        revalidatePath('/inventory/categories');
        return { success: true };
    } catch (e: any) {
        // Surface backend 409 payload (products referencing this brand)
        if (e?.status === 409 && e?.data) {
            return { success: false, conflict: e.data, message: e.data.message || 'Cannot delete: products assigned' };
        }
        return { success: false, message: e?.message || 'Failed to delete brand' };
    }
}

/**
 * Bulk-reassign products from one brand to another (or to unbranded = null).
 * Used by the delete-protection migration flow.
 */
export async function moveBrandProducts(params: {
    source_brand_id: number;
    target_brand_id?: number | null;
    also_delete_source?: boolean;
}) {
    try {
        const res = await erpFetch(`inventory/brands/move_products/`, {
            method: 'POST',
            body: JSON.stringify(params),
        });
        revalidatePath('/inventory/brands');
        revalidatePath('/inventory/categories');
        return { success: true, ...res };
    } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to migrate brand products' };
    }
}

export async function getBrandsByCategory(categoryId: number | null) {
    if (!categoryId) {
        const brands = await erpFetch('inventory/brands/by_category/');
        return brands;
    }
    return await erpFetch(`inventory/brands/by_category/?category_id=${categoryId}`);
}

export async function getBrandHierarchy(brandId: number) {
    try {
        return await erpFetch(`inventory/brands/${brandId}/hierarchy/`);
    } catch (e) {
        handleAuthError(e)
        console.error("Error fetching hierarchy:", e);
        return null;
    }
}