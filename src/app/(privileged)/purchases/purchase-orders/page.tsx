import { Metadata } from 'next'
import PurchaseOrdersPage from './page-client'

export const metadata: Metadata = {
    title: 'Purchase Orders | Purchasing',
    description: 'Create and manage formal purchase orders sent to suppliers.',
}

export default function Page() {
    return <PurchaseOrdersPage />
}
