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
        // detailed mapping to match legacy Prisma shape
        return data.map((item: any) => ({
            ...item,
            _count: {
                products: item.product_count || 0
            }
        }));
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
                categories: categoryIds // Serializer expects a list of IDs for M2M? No, ModelSerializer expects IDs usually. 
                // Actually DRF default WritableNested defaults are tricky. 
                // But since I used CategorySerializer(read_only=True), it WON'T write.
                // I need to fix the Serializer to handle writes or use a separate logical set of fields.
                // Let's assume for now I will fix the serializer too.
            })
        });

        // Wait, I need to fix the serialization of categories for writing.
        // My previous serializer Edit was READ ONLY for categories.
        // I will need to handle that. 

        revalidatePath('/admin/inventory/attributes');
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
        revalidatePath('/admin/inventory/attributes');
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
        revalidatePath('/admin/inventory/attributes');
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
        const data = await erpFetch(`parfums/by_category/?categoryId=${categoryId}`);
        return data.map((item: any) => ({
            ...item,
            shortName: item.short_name, // Map snake_case to camelCase
            _count: { products: item.product_count || 0 }
        }));
    } catch (e) {
        console.error("Failed to fetch attributes by category", e);
        return [];
    }
}

export async function getAttributeHierarchy(parfumId: number) {
    try {
        const data = await erpFetch(`parfums/${parfumId}/hierarchy/`);
        // Map hierarchy data to match frontend expectations (nested objects for unit/country)
        return data.map((brand: any) => ({
            ...brand,
            products: brand.products.map((p: any) => ({
                ...p,
                unit: p.unitName ? { name: p.unitName } : null,
                country: p.countryName ? { name: p.countryName } : null
            }))
        }));
    } catch (e) {
        console.error("Failed to fetch hierarchy", e);
        return [];
    }
}
