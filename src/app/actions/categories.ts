'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

export type CategoryState = {
    message?: string;
    errors?: {
        name?: string[];
        barcode_prefix?: string[];
    };
};

/** Pulls DRF field-error objects out of an erpFetch failure so the form
 *  can render them inline. DRF returns 400 with { field: ["msg"], ... } —
 *  we only treat a field as an error when the value is an array of strings
 *  (success responses have scalar `name: "Foo"`, which shouldn't be flagged). */
function pickFieldErrors(raw: any): CategoryState['errors'] | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const out: CategoryState['errors'] = {};
    if (Array.isArray(raw.name) && raw.name.every((v: any) => typeof v === 'string')) out.name = raw.name;
    if (Array.isArray(raw.barcode_prefix) && raw.barcode_prefix.every((v: any) => typeof v === 'string')) out.barcode_prefix = raw.barcode_prefix;
    return Object.keys(out).length ? out : undefined;
}

function hasError(raw: any): boolean {
    if (!raw || typeof raw !== 'object') return false;
    if (raw.error || raw.detail) return true;
    // Field errors only — DRF always returns arrays for validation errors.
    if (Array.isArray(raw.barcode_prefix)) return true;
    if (Array.isArray(raw.name)) return true;
    return false;
}

export async function createCategory(prevState: CategoryState, formData: FormData): Promise<CategoryState> {
    const name = formData.get('name') as string;
    const parentId = formData.get('parentId') ? parseInt(formData.get('parentId') as string) : null;
    const code = (formData.get('code') as string) || null;
    const shortName = (formData.get('shortName') as string) || null;
    const barcodePrefix = (formData.get('barcodePrefix') as string) || '';
    const nameFr = (formData.get('nameFr') as string) || '';
    const nameAr = (formData.get('nameAr') as string) || '';

    if (!name || name.length < 2) {
        return { message: 'Failed to create category', errors: { name: ['Name must be at least 2 characters'] } };
    }

    try {
        const result = await erpFetch('categories/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                parent: parentId, // DRF expects PK of FK. Field name 'parent' in model.
                code,
                short_name: shortName,
                barcode_prefix: barcodePrefix,
                name_fr: nameFr,
                name_ar: nameAr,
            })
        });

        // erpFetch may return error object instead of throwing
        if (hasError(result)) {
            const fieldErrors = pickFieldErrors(result);
            const errMsg = result.error || result.detail
                || (fieldErrors?.barcode_prefix?.[0])
                || (fieldErrors?.name?.[0])
                || 'Failed to create category';
            console.error('[createCategory] Backend error:', result);
            return { message: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg), errors: fieldErrors };
        }

        revalidatePath('/inventory/categories');
        return { message: 'success' };
    } catch (e: unknown) {
        console.error('[createCategory] Exception:', e);
        const data = (e as any)?.data || (e as any)?.body;
        const fieldErrors = pickFieldErrors(data);
        const detail = (fieldErrors?.barcode_prefix?.[0])
            || (fieldErrors?.name?.[0])
            || (e as any)?.message
            || 'Failed to create category';
        return { message: detail, errors: fieldErrors };
    }
}

export async function updateCategory(id: number, prevState: CategoryState, formData: FormData): Promise<CategoryState> {
    const name = formData.get('name') as string;
    const parentId = formData.get('parentId') ? parseInt(formData.get('parentId') as string) : null;
    const code = (formData.get('code') as string) || null;
    const shortName = (formData.get('shortName') as string) || null;
    const barcodePrefix = (formData.get('barcodePrefix') as string) || '';
    const nameFr = (formData.get('nameFr') as string) || '';
    const nameAr = (formData.get('nameAr') as string) || '';

    try {
        if (parentId === id) {
            return { message: 'Category cannot be its own parent' };
        }

        const result = await erpFetch(`categories/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                parent: parentId,
                code,
                short_name: shortName,
                barcode_prefix: barcodePrefix,
                name_fr: nameFr,
                name_ar: nameAr,
            })
        });

        if (hasError(result)) {
            const fieldErrors = pickFieldErrors(result);
            const errMsg = result.error || result.detail
                || (fieldErrors?.barcode_prefix?.[0])
                || (fieldErrors?.name?.[0])
                || 'Failed to update category';
            return { message: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg), errors: fieldErrors };
        }

        revalidatePath('/inventory/categories');
        return { message: 'success' };
    } catch (e: unknown) {
        console.error('[updateCategory] Exception:', e);
        const data = (e as any)?.data || (e as any)?.body;
        const fieldErrors = pickFieldErrors(data);
        const detail = (fieldErrors?.barcode_prefix?.[0])
            || (fieldErrors?.name?.[0])
            || (e as any)?.message
            || 'Failed to update category';
        return { message: detail, errors: fieldErrors };
    }
}

export async function deleteCategory(id: number) {
    try {
        await erpFetch(`categories/${id}/`, {
            method: 'DELETE'
        });
        revalidatePath('/inventory/categories');
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