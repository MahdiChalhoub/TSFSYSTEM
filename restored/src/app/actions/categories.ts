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
        await erpFetch('categories/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                parent: parentId, // DRF expects PK of FK. Field name 'parent' in model.
                code,
                short_name: shortName
            })
        });

        revalidatePath('/admin/inventory/categories');
        return { message: 'success' };
    } catch (e: any) {
        // Map Django error to frontend friendly
        if (e.message?.includes("code")) { // Simple heuristic
            return { message: 'Category code must be unique' };
        }
        return { message: 'Failed to create category' };
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

        await erpFetch(`categories/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                parent: parentId,
                code,
                short_name: shortName
            })
        });

        revalidatePath('/admin/inventory/categories');
        return { message: 'success' };
    } catch (e: any) {
        return { message: 'Failed to update category' };
    }
}

export async function deleteCategory(id: number) {
    try {
        await erpFetch(`categories/${id}/`, {
            method: 'DELETE'
        });
        revalidatePath('/admin/inventory/categories');
        return { success: true };
    } catch (e) {
        return { success: false, message: 'Failed to delete category' };
    }
}

export async function getCategoryWithCounts() {
    return await erpFetch('categories/with_counts/');
}

export async function moveProducts(productIds: number[], targetCategoryId: number) {
    try {
        await erpFetch('categories/move_products/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productIds,
                targetCategoryId
            })
        });

        revalidatePath('/admin/inventory/categories/maintenance');
        revalidatePath('/admin/inventory/categories'); // Update main list too
        return { success: true };
    } catch (e) {
        console.error('Move products error:', e);
        return { success: false, message: 'Failed to move products' };
    }
}