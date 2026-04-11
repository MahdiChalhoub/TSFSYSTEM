import { Metadata } from 'next'
import PurchaseInvoicesPage from './page-client'

export const metadata: Metadata = {
 title: 'Purchase Invoices | Purchasing',
 description: 'Process and manage billing for supplier purchases.',
}

export default function Page() {
 return <PurchaseInvoicesPage />
}
