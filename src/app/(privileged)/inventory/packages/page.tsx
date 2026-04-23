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
    // URL path convention is deployment-specific — the `inventory/`-
    // namespaced mount returns 404 on some production deployments even
    // though it resolves locally. The flat mount (`/api/<resource>/`)
    // is the reliable path, so we use it for everything.
    const [templates, units, categories, brands, attributes] = await Promise.all([
        safeLoad('unit-packages/'),
        safeLoad('units/'),
        safeLoad('categories/'),
        safeLoad('brands/'),
        safeLoad('product-attributes/?parent=null'),
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
