'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

export type CategoryState = {
    message?: string;
    errors?: {
        name?: string[];
    };
};

export async function createCategory(prevState: CategoryState, formData: FormData): Promise<CategoryState> {
    const name = formData.get('name') as string;
    const parentId = formData.get('parentId') ? parseInt(formData.get('parentId') as string) : null;
    const code = (formData.get('code') as string) || null;
    const shortName = (formData.get('shortName') as string) || null;

    if (!name || name.length < 2) {
        return { message: 'Failed to create category', errors: { name: ['Name must be at least 2 characters'] } };
    }

    try {
        const result = await erpFetch('inventory/categories/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                parent: parentId, // DRF expects PK of FK. Field name 'parent' in model.
                code,
                short_name: shortName
            })
        });

        // erpFetch may return error object instead of throwing
        if (result?.error || result?.detail) {
            const errMsg = result.error || result.detail || 'Unknown backend error';
            console.error('[createCategory] Backend error:', errMsg);
            return { message: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg) };
        }

        revalidatePath('/inventory/categories');
        return { message: 'success' };
    } catch (e: any) {
        console.error('[createCategory] Exception:', e);
        const detail = e?.message || 'Failed to create category';
        return { message: detail };
    }
}

export async function updateCategory(id: number, prevState: CategoryState, formData: FormData): Promise<CategoryState> {
    const name = formData.get('name') as string;
    const parentId = formData.get('parentId') ? parseInt(formData.get('parentId') as string) : null;
    const code = (formData.get('code') as string) || null;
    const shortName = (formData.get('shortName') as string) || null;

    try {
        if (parentId === id) {
            return { message: 'Category cannot be its own parent' };
        }

        await erpFetch(`inventory/categories/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                parent: parentId,
                code,
                short_name: shortName
            })
        });

        revalidatePath('/inventory/categories');
        return { message: 'success' };
    } catch (e: unknown) {
        return { message: 'Failed to update category' };
    }
}

export async function deleteCategory(id: number) {
    try {
        await erpFetch(`inventory/categories/${id}/`, {
            method: 'DELETE'
        });
        revalidatePath('/inventory/categories');
        return { success: true };
    } catch (e) {
        return { success: false, message: 'Failed to delete category' };
    }
}

export async function getCategoryWithCounts() {
    return await erpFetch('inventory/categories/with_counts/');
}

export async function moveProducts(productIds: number[], targetCategoryId: number) {
    try {
        await erpFetch('inventory/categories/move_products/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product_ids: productIds,
                target_category_id: targetCategoryId
            })
        });

        revalidatePath('/inventory/categories/maintenance');
        revalidatePath('/inventory/categories'); // Update main list too
        return { success: true };
    } catch (e) {
        console.error('Move products error:', e);
        return { success: false, message: 'Failed to move products' };
    }
}