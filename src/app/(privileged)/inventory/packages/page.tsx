import { erpFetch } from '@/lib/erp-api'
import PackagesClient from './PackagesClient'

export const dynamic = 'force-dynamic'

async function safeLoad(url: string) {
    try {
        const d = await erpFetch(url)
        return Array.isArray(d) ? d : (d?.results ?? [])
    } catch {
        return []
    }
}

export default async function PackagesPage() {
    const [packages, units, categories, brands, attributes] = await Promise.all([
        safeLoad('unit-packages/'),
        safeLoad('/units/'),
        safeLoad('inventory/categories/'),
        safeLoad('inventory/brands/'),
        safeLoad('product-attributes/?parent=null'),
    ])

    return (
        <PackagesClient
            initialPackages={packages}
            units={units}
            categories={categories}
            brands={brands}
            attributes={attributes}
        />
    )
}
