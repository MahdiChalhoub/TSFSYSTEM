import { erpFetch } from '@/lib/erp-api'
import SuggestionsManager from './SuggestionsManager'

export const dynamic = 'force-dynamic'

async function safeLoad(url: string) {
    try {
        const d = await erpFetch(url)
        return Array.isArray(d) ? d : (d?.results ?? [])
    } catch { return [] }
}

export default async function PackagingSuggestionsPage() {
    const [rules, categories, brands, attributes, units, unitPackages] = await Promise.all([
        safeLoad('packaging-suggestions/'),
        safeLoad('categories/'),
        safeLoad('brands/'),
        safeLoad('product-attributes/'),
        safeLoad('units/'),
        safeLoad('unit-packages/'),
    ])

    return (
        <SuggestionsManager
            initialRules={rules}
            categories={categories}
            brands={brands}
            attributes={attributes}
            units={units}
            unitPackages={unitPackages}
        />
    )
}
