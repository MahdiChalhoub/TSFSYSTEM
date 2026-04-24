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

function parseTranslations(formData: FormData): Record<string, { name?: string; short_name?: string }> {
    try {
        const raw = (formData.get('translationsJson') as string) || '';
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

export async function createBrand(prevState: BrandState, formData: FormData): Promise<BrandState> {
    const name = formData.get('name') as string;
    const shortName = formData.get('shortName') as string;
    const countryIds = formData.getAll('countryIds').map(id => Number(id));
    const categoryIds = formData.getAll('categoryIds').map(id => Number(id));
    const translations = parseTranslations(formData);

    if (!name || name.length < 2) {
        return { message: 'Failed to create brand', errors: { name: ['Name must be at least 2 characters'] } };
    }

    try {
        await erpFetch('brands/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                short_name: shortName,
                translations,
                categories: categoryIds,
                countries: countryIds
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
    const translations = parseTranslations(formData);

    try {
        await erpFetch(`brands/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                short_name: shortName,
                translations,
                categories: categoryIds,
                countries: countryIds
            })
        });
        revalidatePath('/inventory/brands');
        revalidatePath('/inventory/countries');
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