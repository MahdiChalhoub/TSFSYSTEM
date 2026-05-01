import { erpFetch } from '@/lib/erp-api'
import { AccountCategoriesClient } from './AccountCategoriesClient'

export const dynamic = 'force-dynamic'

async function getPageData() {
    try {
        const [cats, coa, gateways] = await Promise.all([
            erpFetch('finance/account-categories/?page_size=500', { cache: 'no-store' } as any)
                .then((d: any) => Array.isArray(d) ? d : d?.results ?? [])
                .catch(() => []),
            erpFetch('finance/coa/')
                .then((d: any) => Array.isArray(d) ? d : d?.results ?? [])
                .catch(() => []),
            erpFetch('reference/org-payment-gateways/', { cache: 'no-store' } as any)
                .then((d: any) => Array.isArray(d) ? d : d?.results ?? [])
                .catch(() => []),
        ])
        return { cats, coa, gateways }
    } catch (e) {
        console.error('[ACCOUNT-CATEGORIES PAGE] Failed to load data:', e)
        return { cats: [], coa: [], gateways: [] }
    }
}

export default async function AccountCategoriesPage() {
    const { cats, coa, gateways } = await getPageData()

    return (
        <AccountCategoriesClient
            initialCategories={cats}
            coaList={coa}
            orgGateways={gateways}
        />
    )
}
