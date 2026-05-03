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

/**
 * Best-effort sync of M2M links from the category modal panes:
 *
 *   - `attributeIds[]`  — sent directly to the category endpoint as
 *     `attributes: [...]` because Category has the M2M field declared.
 *
 *   - `brandIds[]`  — Brand owns the M2M (Brand.categories), so we have
 *     to PATCH each brand individually. We diff the desired set against
 *     the brand's current categories so we don't overwrite unrelated
 *     links. Errors are swallowed (best-effort) so a brand-link failure
 *     never blocks the main category save.
 */
/**
 * Returns the count of brand PATCHes that failed (0 = clean).  The
 * caller surfaces a soft warning if non-zero so the user knows the
 * category itself saved but some brand links did not.
 *
 * Audit BLOCKER #3 — previous version swallowed both the list-fetch
 * failure and per-brand PATCH failures with no signal back to the UI.
 */
async function syncBrandLinks(categoryId: number, brandIds: number[]): Promise<{ failed: number }> {
    const desired = new Set(brandIds);
    let brands: any[] = [];
    try {
        const res: any = await erpFetch('inventory/brands/');
        brands = Array.isArray(res) ? res : (res?.results ?? []);
    } catch (e) {
        console.warn('[syncBrandLinks] brands list fetch failed:', e);
        return { failed: -1 };  // signal "couldn't even start"
    }

    let failed = 0;
    const tasks = brands.map(async (b) => {
        const currentIds: number[] = Array.isArray(b.categories)
            ? b.categories.map((c: any) => typeof c === 'number' ? c : c.id)
            : [];
        const has = currentIds.includes(categoryId);
        const wants = desired.has(b.id);
        if (has === wants) return;
        const next = wants
            ? Array.from(new Set([...currentIds, categoryId]))
            : currentIds.filter((id) => id !== categoryId);
        try {
            await erpFetch(`inventory/brands/${b.id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categories: next }),
            });
        } catch (e) {
            console.warn(`[syncBrandLinks] brand ${b.id} update failed:`, e);
            failed++;
        }
    });
    await Promise.all(tasks);
    return { failed };
}

function readIntList(formData: FormData, key: string): number[] {
    return formData.getAll(key)
        .map((v) => parseInt(String(v), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
}

export async function createCategory(prevState: CategoryState, formData: FormData): Promise<CategoryState> {
    const name = formData.get('name') as string;
    const parentId = formData.get('parentId') ? parseInt(formData.get('parentId') as string) : null;
    const code = (formData.get('code') as string) || null;
    const shortName = (formData.get('shortName') as string) || null;
    const barcodePrefix = (formData.get('barcodePrefix') as string) || '';
    const attributesDirty = formData.get('attributesDirty') === '1';
    const brandsDirty = formData.get('brandsDirty') === '1';
    const attributeIds = readIntList(formData, 'attributeIds');
    const brandIds = readIntList(formData, 'brandIds');
    let translations: Record<string, { name?: string; short_name?: string }> = {};
    try {
        const raw = (formData.get('translationsJson') as string) || '';
        if (raw) translations = JSON.parse(raw);
    } catch { /* tolerate malformed JSON — treat as empty */ }
    const nameFr = translations.fr?.name || '';
    const nameAr = translations.ar?.name || '';

    if (!name || name.length < 2) {
        return { message: 'Failed to create category', errors: { name: ['Name must be at least 2 characters'] } };
    }

    try {
        // Only include `attributes` in the payload when the user actually
        // touched the Attributes pane — otherwise the serializer would
        // happily overwrite the M2M with [] on every save.
        const payload: Record<string, unknown> = {
            name,
            parent: parentId,
            code,
            short_name: shortName,
            barcode_prefix: barcodePrefix,
            translations,
            name_fr: nameFr,
            name_ar: nameAr,
        };
        if (attributesDirty) payload.attributes = attributeIds;

        const result = await erpFetch('categories/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
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

        // Brand links are reverse M2M — sync via per-brand PATCHes,
        // but ONLY if the user actually touched the Brands pane. The
        // empty-set case must not run blindly (it would unlink every
        // brand that already references this category).
        const newId = (result as any)?.id;
        let brandWarning: string | undefined;
        if (newId && brandsDirty) {
            const r = await syncBrandLinks(Number(newId), brandIds);
            if (r.failed > 0) brandWarning = `Category created but ${r.failed} brand link(s) failed to update.`;
            if (r.failed === -1) brandWarning = 'Category created but the brand list could not be loaded — links not updated.';
        }

        revalidatePath('/inventory/categories');
        // The frontend treats `state.message === 'success'` as the close
        // signal. If we have a warning to surface, return it instead so
        // the modal stays open and shows the user what to retry.
        return brandWarning ? { message: brandWarning } : { message: 'success' };
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
    const attributesDirty = formData.get('attributesDirty') === '1';
    const brandsDirty = formData.get('brandsDirty') === '1';
    const attributeIds = readIntList(formData, 'attributeIds');
    const brandIds = readIntList(formData, 'brandIds');
    let translations: Record<string, { name?: string; short_name?: string }> = {};
    try {
        const raw = (formData.get('translationsJson') as string) || '';
        if (raw) translations = JSON.parse(raw);
    } catch { /* tolerate malformed JSON — treat as empty */ }
    const nameFr = translations.fr?.name || '';
    const nameAr = translations.ar?.name || '';

    // Audit IMPORTANT #4 — mirror create's name validation here. The form
    // marks Name as required client-side but a stray empty PATCH (e.g.
    // legacy callers, browser autofill) shouldn't reach the backend.
    if (!name || name.length < 2) {
        return { message: 'Failed to update category', errors: { name: ['Name must be at least 2 characters'] } };
    }

    try {
        if (parentId === id) {
            return { message: 'Category cannot be its own parent' };
        }

        // Only forward `attributes` when the user touched the pane —
        // otherwise the serializer would overwrite the M2M with [].
        const payload: Record<string, unknown> = {
            name,
            parent: parentId,
            code,
            short_name: shortName,
            barcode_prefix: barcodePrefix,
            translations,
            name_fr: nameFr,
            name_ar: nameAr,
        };
        if (attributesDirty) payload.attributes = attributeIds;

        const result = await erpFetch(`categories/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (hasError(result)) {
            const fieldErrors = pickFieldErrors(result);
            const errMsg = result.error || result.detail
                || (fieldErrors?.barcode_prefix?.[0])
                || (fieldErrors?.name?.[0])
                || 'Failed to update category';
            return { message: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg), errors: fieldErrors };
        }

        // Same dirty-gate as create — never run syncBrandLinks blindly,
        // it would clear every existing brand→category link otherwise.
        let brandWarning: string | undefined;
        if (brandsDirty) {
            const r = await syncBrandLinks(id, brandIds);
            if (r.failed > 0) brandWarning = `Category updated but ${r.failed} brand link(s) failed to update.`;
            if (r.failed === -1) brandWarning = 'Category updated but the brand list could not be loaded — links not updated.';
        }

        revalidatePath('/inventory/categories');
        return brandWarning ? { message: brandWarning } : { message: 'success' };
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