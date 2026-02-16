import { erpFetch } from '@/lib/erpFetch'
import DiscountManager from './manager'

export default async function DiscountRulesPage() {
    let rules: any[] = []
    let products: any[] = []
    let categories: any[] = []

    try {
        const [rRes, pRes, cRes] = await Promise.all([
            erpFetch('/discount-rules/'),
            erpFetch('/products/'),
            erpFetch('/categories/'),
        ])
        rules = Array.isArray(rRes) ? rRes : rRes.results || []
        products = Array.isArray(pRes) ? pRes : pRes.results || []
        categories = Array.isArray(cRes) ? cRes : cRes.results || []
    } catch { /* empty */ }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Discount Rules</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Create promotional discounts that can auto-apply at POS checkout.
                </p>
            </div>
            <DiscountManager initialRules={rules} products={products} categories={categories} />
        </div>
    )
}
