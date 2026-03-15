'use server';

import { erpFetch } from "@/lib/erp-api";
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

export async function deleteBrand(id: number) {
    try {
        await erpFetch(`inventory/brands/${id}/`, { method: 'DELETE' });
        revalidatePath('/inventory/brands');
        revalidatePath('/inventory/categories');
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to delete brand' };
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
        console.error("Error fetching hierarchy:", e);
        return null;
    }
}