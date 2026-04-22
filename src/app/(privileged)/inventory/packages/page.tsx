import { erpFetch } from '@/lib/erp-api'
import PackagesClient from './PackagesClient'

export const dynamic = 'force-dynamic'

type LoadResult<T> = { ok: true; data: T[] } | { ok: false; error: string }

async function safeLoad<T = any>(url: string): Promise<LoadResult<T>> {
    try {
        const d = await erpFetch(url)
        const data = Array.isArray(d) ? d : (d?.results ?? [])
        return { ok: true, data }
    } catch (e: any) {
        return { ok: false, error: e?.message || 'network error' }
    }
}

export default async function PackagesPage() {
    // All paths use the flat `inventory/<resource>/` convention for consistency.
    // The router registers both `/api/<resource>/` and `/api/inventory/<resource>/`,
    // so either works — we pick one for predictability.
    const [templates, units, categories, brands, attributes] = await Promise.all([
        safeLoad('inventory/unit-packages/'),
        safeLoad('inventory/units/'),
        safeLoad('inventory/categories/'),
        safeLoad('inventory/brands/'),
        safeLoad('inventory/product-attributes/?parent=null'),
    ])

    const loadErrors: Record<string, string> = {}
    if (!templates.ok) loadErrors.templates = templates.error
    if (!units.ok) loadErrors.units = units.error
    if (!categories.ok) loadErrors.categories = categories.error
    if (!brands.ok) loadErrors.brands = brands.error
    if (!attributes.ok) loadErrors.attributes = attributes.error

    return (
        <PackagesClient
            initialTemplates={templates.ok ? templates.data : []}
            units={units.ok ? units.data : []}
            categories={categories.ok ? categories.data : []}
            brands={brands.ok ? brands.data : []}
            attributes={attributes.ok ? attributes.data : []}
            loadErrors={loadErrors}
        />
    )
}
