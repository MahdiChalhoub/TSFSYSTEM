import { Metadata } from 'next'
import { getOrganizations } from '@/app/(privileged)/(saas)/organizations/actions'
import PurchaseOrdersPage from './page-client'

export const metadata: Metadata = {
    title: 'Purchase Orders | Purchasing',
    description: 'Create and manage formal purchase orders sent to suppliers.',
}

export const dynamic = 'force-dynamic'

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
    // Skip the server-side PO fetch — it blocks FCP for ~hundreds of ms
    // (longer in dev mode). The client component (page-client.tsx) already
    // calls fetchData() in a mount-effect when initialOrders is empty, so
    // the shell paints first and data streams in once the client mounts.
    // Net effect: FCP drops from "after backend round-trip" to "shell only".
    const currency = await getOrgCurrency()
    return <PurchaseOrdersPage initialOrders={[]} currency={currency} />
}
