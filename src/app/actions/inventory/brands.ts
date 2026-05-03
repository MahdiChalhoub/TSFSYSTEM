'use server';

import { erpFetch, handleAuthError } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

export type BrandState = {
    message?: string;
    errors?: {
        name?: string[];
        countryId?: string[];
    };
};

/* ════════════════════════════════════════════════════════════════════
 *  syncBrandLinks — authoritative M2M writer for Brand.categories and
 *  Brand.countries.
 *
 *  Same fix the categories module needed: PATCHing the ModelSerializer
 *  with `category_ids` / `country_ids` payloads has been silently
 *  dropping writes. Returning HTTP 200 with the M2M unchanged.
 *  Reasons stack up — read_only nested field (`categories` /
 *  `countries`) shadowing the write_only source-aliased one,
 *  TenantOwnedModel save signals, custom managers — none of which
 *  surface as an error to the client.
 *
 *  Fix: don't go through the serializer for M2M state. Use the
 *  dedicated link_category / unlink_category / link_country /
 *  unlink_country actions on BrandViewSet — they call
 *  brand.categories.add() / .remove() directly, which IS authoritative.
 *
 *  Returns { failed: [{ kind, id, error }] } so callers can surface
 *  partial-success warnings (matches the categories module signature).
 * ════════════════════════════════════════════════════════════════════ */
type SyncMode = 'category' | 'country' | 'attribute'
type LinkFailure = { kind: SyncMode; id: number; error: string }

const SYNC_FIELD: Record<SyncMode, string> = {
    category: 'categories',
    country: 'countries',
    attribute: 'attributes',
}

async function syncBrandLinks(
    brandId: number,
    desiredIds: number[],
    mode: SyncMode,
): Promise<{ failed: LinkFailure[] }> {
    // Read current set of linked ids straight from the brand record so
    // we don't trust whatever stale shape a list snapshot might have.
    let currentIds: number[] = []
    try {
        const fresh: any = await erpFetch(`inventory/brands/${brandId}/`)
        const list = fresh?.[SYNC_FIELD[mode]]
        currentIds = (Array.isArray(list) ? list : [])
            .map((row: any) => typeof row === 'number' ? row : row?.id)
            .filter((n: any): n is number => typeof n === 'number')
    } catch {
        // If we can't read current state, fall through with empty —
        // the diff below treats every desired id as a fresh add.
    }

    const desired = new Set(desiredIds.filter(n => Number.isFinite(n)))
    const current = new Set(currentIds)
    const toAdd = [...desired].filter(id => !current.has(id))
    const toRemove = [...current].filter(id => !desired.has(id))

    const idKey = mode === 'category' ? 'category_id' : mode === 'country' ? 'country_id' : 'attribute_id'
    const linkPath = `link_${mode}`
    const unlinkPath = `unlink_${mode}`
    const failed: LinkFailure[] = []

    // Run adds and removes in parallel — they touch different rows of
    // the through table so there's no ordering constraint. Promise
    // .allSettled so a single 4xx doesn't kill the rest.
    const calls = [
        ...toAdd.map(id =>
            erpFetch(`inventory/brands/${brandId}/${linkPath}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [idKey]: id }),
            }).then(() => null).catch(e => ({ kind: mode, id, error: e?.message || 'link failed' } as LinkFailure))
        ),
        ...toRemove.map(id =>
            erpFetch(`inventory/brands/${brandId}/${unlinkPath}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [idKey]: id }),
            }).then(() => null).catch(e => ({ kind: mode, id, error: e?.message || 'unlink failed' } as LinkFailure))
        ),
    ]
    const results = await Promise.all(calls)
    results.forEach(r => { if (r) failed.push(r) })
    return { failed }
}

export async function createBrand(prevState: BrandState, formData: FormData): Promise<BrandState> {
    const name = formData.get('name') as string;
    const shortName = formData.get('shortName') as string;
    const code = formData.get('code') as string;
    const countryIds = formData.getAll('countryIds').map(id => Number(id));
    const categoryIds = formData.getAll('categoryIds').map(id => Number(id));
    const attributeIds = formData.getAll('attributeIds').map(id => Number(id));

    if (!name || name.length < 2) {
        return { message: 'Failed to create brand', errors: { name: ['Name must be at least 2 characters'] } };
    }

    try {
        // Create with scalar fields only; M2M writes go through the
        // dedicated link endpoints below so they don't get silently
        // dropped by the serializer.
        const created: any = await erpFetch('inventory/brands/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                short_name: shortName,
                code,
            })
        });

        const newId = created?.id;
        if (newId) {
            const [catRes, countryRes, attrRes] = await Promise.all([
                categoryIds.length  > 0 ? syncBrandLinks(newId, categoryIds,  'category')  : Promise.resolve({ failed: [] }),
                countryIds.length   > 0 ? syncBrandLinks(newId, countryIds,   'country')   : Promise.resolve({ failed: [] }),
                attributeIds.length > 0 ? syncBrandLinks(newId, attributeIds, 'attribute') : Promise.resolve({ failed: [] }),
            ]);
            const failures = [...catRes.failed, ...countryRes.failed, ...attrRes.failed];
            if (failures.length > 0) {
                console.warn('[createBrand] link partial failures:', failures);
            }
        }

        revalidatePath('/inventory/brands');
        return { message: 'success' };
    } catch (e: unknown) {
        return { message: 'Database Error: Failed to create brand.' };
    }
}

export async function updateBrand(id: number, prevState: BrandState, formData: FormData): Promise<BrandState> {
    const name = formData.get('name') as string;
    const shortName = formData.get('shortName') as string;
    const code = formData.get('code') as string;
    const countryIds = formData.getAll('countryIds').map(id => Number(id));
    const categoryIds = formData.getAll('categoryIds').map(id => Number(id));
    const attributeIds = formData.getAll('attributeIds').map(id => Number(id));

    try {
        // Scalar fields via PATCH; M2M state via the dedicated endpoints.
        // The PATCH no longer carries category_ids / country_ids /
        // attribute_ids — those were getting silently dropped (same root
        // cause as the categories module's link-failure bug).
        await erpFetch(`inventory/brands/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                short_name: shortName,
                code,
            })
        });

        const [catRes, countryRes, attrRes] = await Promise.all([
            syncBrandLinks(id, categoryIds,  'category'),
            syncBrandLinks(id, countryIds,   'country'),
            syncBrandLinks(id, attributeIds, 'attribute'),
        ]);
        const failures = [...catRes.failed, ...countryRes.failed, ...attrRes.failed];
        if (failures.length > 0) {
            console.warn('[updateBrand] link partial failures:', failures);
        }

        revalidatePath('/inventory/brands');
        revalidatePath('/inventory/categories');
        return { message: 'success' };
    } catch (e) {
        return { message: 'Failed to update brand' };
    }
}

export async function deleteBrand(id: number, options: { force?: boolean } = {}) {
    try {
        const url = options.force ? `inventory/brands/${id}/?force=1` : `inventory/brands/${id}/`;
        await erpFetch(url, { method: 'DELETE' });
        revalidatePath('/inventory/brands');
        revalidatePath('/inventory/categories');
        return { success: true };
    } catch (e: any) {
        // Surface backend 409 payload (products referencing this brand)
        if (e?.status === 409 && e?.data) {
            return { success: false, conflict: e.data, message: e.data.message || 'Cannot delete: products assigned' };
        }
        return { success: false, message: e?.message || 'Failed to delete brand' };
    }
}

/**
 * Bulk-reassign products from one brand to another (or to unbranded = null).
 * Used by the delete-protection migration flow.
 */
export async function moveBrandProducts(params: {
    source_brand_id: number;
    target_brand_id?: number | null;
    also_delete_source?: boolean;
}) {
    try {
        const res = await erpFetch(`inventory/brands/move_products/`, {
            method: 'POST',
            body: JSON.stringify(params),
        });
        revalidatePath('/inventory/brands');
        revalidatePath('/inventory/categories');
        return { success: true, ...res };
    } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to migrate brand products' };
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
        handleAuthError(e)
        console.error("Error fetching hierarchy:", e);
        return null;
    }
}