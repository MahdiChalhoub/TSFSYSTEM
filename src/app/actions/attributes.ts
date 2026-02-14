'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

export type AttributeState = {
    message?: string;
    errors?: {
        name?: string[];
    };
};

export async function getAttributes() {
    try {
        const data = await erpFetch('parfums/');
        return data;
    } catch (error) {
        console.error("Failed to fetch attributes:", error);
        return [];
    }
}

export async function createAttribute(prevState: AttributeState, formData: FormData): Promise<AttributeState> {
    const name = formData.get('name') as string;
    const shortName = formData.get('shortName') as string;
    const categoryIds = formData.getAll('categoryIds').map(id => Number(id));

    if (!name || name.length < 2) {
        return { message: 'Failed to create attribute', errors: { name: ['Name must be at least 2 characters'] } };
    }

    try {
        await erpFetch('parfums/', {
            method: 'POST',
            body: JSON.stringify({
                name,
                short_name: shortName || null,
                categories: categoryIds
            })
        });

        revalidatePath('/inventory/attributes');
        return { message: 'success' };
    } catch (e) {
        return { message: 'Database Error: Failed to create attribute.' };
    }
}

export async function updateAttribute(id: number, prevState: AttributeState, formData: FormData): Promise<AttributeState> {
    const name = formData.get('name') as string;
    const shortName = formData.get('shortName') as string;
    const categoryIds = formData.getAll('categoryIds').map(id => Number(id));

    try {
        await erpFetch(`parfums/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({
                name,
                short_name: shortName || null,
                categories: categoryIds // Same issue as above
            })
        });
        revalidatePath('/inventory/attributes');
        return { message: 'success' };
    } catch (e) {
        return { message: 'Failed to update attribute' };
    }
}

export async function deleteAttribute(id: number, prevState: AttributeState, formData: FormData): Promise<AttributeState> {
    try {
        await erpFetch(`parfums/${id}/`, {
            method: 'DELETE'
        });
        revalidatePath('/inventory/attributes');
        return { message: 'success' };
    } catch (e) {
        return { message: 'Failed to delete attribute. It may be in use.' };
    }
}

/**
 * Get attributes (parfums) filtered by category with parent inheritance
 * @param categoryId - The selected category ID (null = all attributes)
 */
export async function getAttributesByCategory(categoryId: number | null) {
    if (!categoryId) {
        return await getAttributes();
    }
    try {
        return await erpFetch(`parfums/by_category/?categoryId=${categoryId}`);
    } catch (e) {
        console.error("Failed to fetch attributes by category", e);
        return [];
    }
}

export async function getAttributeHierarchy(parfumId: number) {
    try {
        const data = await erpFetch(`parfums/${parfumId}/hierarchy/`);
        // The backend returns { parfum: ..., brands: [...] }
        // The frontend expects the array of brands
        const brands = data.brands || [];

        return brands.map((item: any) => ({
            ...item,
            id: item.brand?.id,
            name: item.brand?.name,
        }));
    } catch (e) {
        console.error("Failed to fetch hierarchy", e);
        return [];
    }
}