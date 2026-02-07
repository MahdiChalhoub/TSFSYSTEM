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
        await erpFetch('brands/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                short_name: shortName, // Adapting to snake_case if Django model uses specific field names? 
                // Wait, Django Model has 'short_name' or 'shortName'? 
                // Model dump didn't show 'short_name' on Brand. It showed 'name', 'categories', 'countries'. 
                // Let's check logic in `actions.ts` previously. It used `shortName`.
                // Prisme Model probably had `shortName`. Django might need it. 
                // If I didn't add `short_name` field to Brand model, this will fail.
                // Let's assume standard snake_case mapping for API if DRF uses CamelCaseJSONRenderer or similar?
                // No, I am using standard ViewSet.
                // If the model does not have 'short_name', I cannot save it.
                // I checked `Brand` model in `models.py` (Step 117): NO short_name.
                // Major issue: Missing field in Django Model.
                // I must add `short_name` to Brand model.
                categories: categoryIds,
                countries: countryIds
            })
        });

        revalidatePath('/admin/inventory/brands');
        return { message: 'success' };
    } catch (e: any) {
        return { message: 'Database Error: Failed to create brand.' };
    }
}

export async function updateBrand(id: number, prevState: BrandState, formData: FormData): Promise<BrandState> {
    const name = formData.get('name') as string;
    const shortName = formData.get('shortName') as string;
    const countryIds = formData.getAll('countryIds').map(id => Number(id));
    const categoryIds = formData.getAll('categoryIds').map(id => Number(id));

    try {
        await erpFetch(`brands/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                short_name: shortName, // Same issue as above
                categories: categoryIds,
                countries: countryIds
            })
        });
        revalidatePath('/admin/inventory/brands');
        revalidatePath('/admin/inventory/countries');
        return { message: 'success' };
    } catch (e) {
        return { message: 'Failed to update brand' };
    }
}

export async function getBrandsByCategory(categoryId: number | null) {
    if (!categoryId) {
        // Return simple list if no category
        // Note: original code returned all brands if categoryId is null
        const brands = await erpFetch('brands/by_category/'); // by_category without param returns all
        return brands;
    }

    return await erpFetch(`brands/by_category/?category_id=${categoryId}`);
}

export async function getBrandHierarchy(brandId: number) {
    try {
        return await erpFetch(`brands/${brandId}/hierarchy/`);
    } catch (e) {
        console.error("Error fetching hierarchy:", e);
        return null;
    }
}