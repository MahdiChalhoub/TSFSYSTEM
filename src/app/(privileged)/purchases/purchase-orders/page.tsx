import { Metadata } from 'next'
import { erpFetch } from '@/lib/erp-api'
import { getOrganizations } from '@/app/(privileged)/(saas)/organizations/actions'
import PurchaseOrdersPage from './page-client'

export const metadata: Metadata = {
    title: 'Purchase Orders | Purchasing',
    description: 'Create and manage formal purchase orders sent to suppliers.',
}

export const dynamic = 'force-dynamic'

async function getPurchaseOrders() {
    try {
        const data = await erpFetch(`purchase-orders/`)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch (e) {
        console.error('Failed to fetch purchase orders:', e)
        return []
    }
}

async function getOrgCurrency(): Promise<string> {
    // Reuses the layout's cached org fetch (React.cache dedup) instead of
    // making a second parallel call to organizations/.
    try {
        const orgs = await getOrganizations()
        if (Array.isArray(orgs) && orgs.length > 0) {
            return orgs[0]?.currency || orgs[0]?.base_currency_code || 'USD'
        }
    } catch { /* noop */ }
    return 'USD'
}

export default async function Page() {
    const [initialOrders, currency] = await Promise.all([
        getPurchaseOrders(),
        getOrgCurrency(),
    ])
    return <PurchaseOrdersPage initialOrders={initialOrders} currency={currency} />
}
