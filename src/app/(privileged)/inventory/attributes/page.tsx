import { AttributesClient } from './AttributesClient'
import { getAttributeTree, getAllCategories, getAllBrands } from '@/app/actions/inventory/attributes'

export const dynamic = 'force-dynamic'

export default async function AttributesPage() {
    const [initialTree, initialCategories, initialBrands] = await Promise.all([
        getAttributeTree(),
        getAllCategories(),
        getAllBrands(),
    ])

    return (
        <AttributesClient
            initialTree={Array.isArray(initialTree) ? initialTree : []}
            initialCategories={Array.isArray(initialCategories) ? initialCategories : []}
            initialBrands={Array.isArray(initialBrands) ? initialBrands : []}
        />
    )
}
