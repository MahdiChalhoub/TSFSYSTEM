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
 * Sync the M2M link sets for brands + attributes by diffing against the
 * authoritative `linked_brands` / `linked_attributes` endpoints and
 * calling the dedicated link/unlink helpers.
 *
 * Why this and not a single PATCH on the category?
 *
 *   • CategorySerializer.Meta.fields doesn't include `attributes`, only
 *     `attribute_count` (a SerializerMethodField). PATCHing
 *     `{attributes: [...]}` succeeds with HTTP 200 but silently drops
 *     the field — the M2M is never touched.
 *
 *   • BrandSerializer exposes `categories` as read-only
 *     (CategorySimpleSerializer with read_only=True). The writable field
 *     is `category_ids`. PATCHing brand `{categories: [...]}` is also
 *     silently dropped.
 *
 * Backend exposes four dedicated endpoints that DO write the M2M:
 *
 *   POST /api/categories/<id>/link_brand/        body: { brand_id }
 *   POST /api/categories/<id>/unlink_brand/      body: { brand_id, force }
 *   POST /api/categories/<id>/link_attribute/    body: { attribute_id }
 *   POST /api/categories/<id>/unlink_attribute/  body: { attribute_id, force }
 *
 * `force=true` on unlink bypasses the "products still use this" guard —
 * we pass it because the user explicitly toggled OFF in the modal.
 */
type SyncResult = { failed: number; mode: 'attributes' | 'brands' };

async function syncMembership(
    categoryId: number,
    desiredIds: number[],
    mode: 'attributes' | 'brands',
): Promise<SyncResult> {
    const linkedPath = mode === 'brands' ? 'linked_brands' : 'linked_attributes';
    const linkPath = mode === 'brands' ? 'link_brand' : 'link_attribute';
    const unlinkPath = mode === 'brands' ? 'unlink_brand' : 'unlink_attribute';
    const idKey = mode === 'brands' ? 'brand_id' : 'attribute_id';

    // Read current set so we only POST the diff (avoids re-linking
    // every existing brand on every save and triggering N pointless
    // M2M writes).
    let current: number[] = [];
    try {
        const res: any = await erpFetch(`categories/${categoryId}/${linkedPath}/`);
        const list: any[] = Array.isArray(res) ? res
            : Array.isArray(res?.linked) ? res.linked
                : Array.isArray(res?.results) ? res.results : [];
        current = list
            .map(x => Number(typeof x === 'number' ? x : x?.id))
            .filter(Number.isFinite);
    } catch (e) {
        console.warn(`[syncMembership/${mode}] couldn't read current set:`, e);
        return { failed: -1, mode };
    }

    const currentSet = new Set(current);
    const desiredSet = new Set(desiredIds);
    const toAdd = desiredIds.filter(id => !currentSet.has(id));
    const toRemove = current.filter(id => !desiredSet.has(id));

    let failed = 0;
    const tasks: Promise<void>[] = [];

    for (const id of toAdd) {
        tasks.push(
            erpFetch(`categories/${categoryId}/${linkPath}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [idKey]: id }),
            }).then(() => undefined).catch((e) => {
                console.warn(`[syncMembership/${mode}] link ${id} failed:`, e);
                failed++;
            })
        );
    }
    for (const id of toRemove) {
        tasks.push(
            erpFetch(`categories/${categoryId}/${unlinkPath}/?force=1`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [idKey]: id, force: true }),
            }).then(() => undefined).catch((e) => {
                console.warn(`[syncMembership/${mode}] unlink ${id} failed:`, e);
                failed++;
            })
        );
    }

    await Promise.all(tasks);
    return { failed, mode };
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
        // CategorySerializer doesn't expose `attributes` as a writable
        // field — that M2M is set via the dedicated /link_attribute/
        // endpoint after creation (see syncMembership). We only POST the
        // base fields here.
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

        // M2M sync via the dedicated link/unlink endpoints. Only runs
        // when the user actually toggled chips in the corresponding pane;
        // the dirty flags prevent blank-out on Identity-only saves.
        const newId = Number((result as any)?.id);
        const warnings: string[] = [];
        if (newId) {
            if (brandsDirty) {
                const r = await syncMembership(newId, brandIds, 'brands');
                if (r.failed > 0) warnings.push(`${r.failed} brand link(s) failed`);
                if (r.failed === -1) warnings.push('brand link sync skipped — could not read current set');
            }
            if (attributesDirty) {
                const r = await syncMembership(newId, attributeIds, 'attributes');
                if (r.failed > 0) warnings.push(`${r.failed} attribute link(s) failed`);
                if (r.failed === -1) warnings.push('attribute link sync skipped — could not read current set');
            }
        }

        revalidatePath('/inventory/categories');
        return warnings.length
            ? { message: `Category created but: ${warnings.join('; ')}.` }
            : { message: 'success' };
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

        // CategorySerializer doesn't expose `attributes` as a writable
        // field — that M2M is set via the dedicated /link_attribute/
        // endpoint (see syncMembership). PATCH only the base fields here.
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

        // M2M sync via dedicated link/unlink endpoints. Dirty flags
        // ensure Identity-only saves don't blow away existing links.
        const warnings: string[] = [];
        if (brandsDirty) {
            const r = await syncMembership(id, brandIds, 'brands');
            if (r.failed > 0) warnings.push(`${r.failed} brand link(s) failed`);
            if (r.failed === -1) warnings.push('brand link sync skipped — could not read current set');
        }
        if (attributesDirty) {
            const r = await syncMembership(id, attributeIds, 'attributes');
            if (r.failed > 0) warnings.push(`${r.failed} attribute link(s) failed`);
            if (r.failed === -1) warnings.push('attribute link sync skipped — could not read current set');
        }

        revalidatePath('/inventory/categories');
        return warnings.length
            ? { message: `Category updated but: ${warnings.join('; ')}.` }
            : { message: 'success' };
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