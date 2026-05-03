'use server'

import { erpFetch } from '@/lib/erp-api'

/**
 * Phase 2 of the multi-dim attribute scoping feature.
 *
 * Fetches the values of a single attribute group bucketed by their
 * scope source (universal / category / country / brand / composite)
 * given a draft product context (category / country / brand).
 *
 * Backend: GET /api/inventory/product-attributes/<group_id>/values-for-product/
 *          ?category_id=…&country_id=…&brand_id=…
 *
 * The picker uses this to render one chip section per non-empty bucket
 * so the operator sees exactly why each value is offered.
 */
export type ScopedValue = {
    id: number
    name: string
    code?: string | null
    scope_label: string
}

export type ScopedBucket = {
    key: 'universal' | 'categorical' | 'country' | 'brand' | 'composite'
    label: string
    values: ScopedValue[]
}

export type ScopedValuesResponse = {
    group: { id: number; name: string; code?: string | null }
    buckets: ScopedBucket[]
}

export async function getScopedValuesForGroup(
    groupId: number,
    ctx: { categoryId?: number | null; countryId?: number | null; brandId?: number | null },
): Promise<ScopedValuesResponse | null> {
    const qs = new URLSearchParams()
    if (ctx.categoryId) qs.set('category_id', String(ctx.categoryId))
    if (ctx.countryId)  qs.set('country_id',  String(ctx.countryId))
    if (ctx.brandId)    qs.set('brand_id',    String(ctx.brandId))

    try {
        const r = await erpFetch(
            `inventory/product-attributes/${groupId}/values-for-product/${qs.toString() ? `?${qs.toString()}` : ''}`,
        )
        return r as ScopedValuesResponse
    } catch (e) {
        console.warn('[attribute-scope] values-for-product failed', e)
        return null
    }
}
