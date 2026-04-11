import { Metadata } from 'next'
import BalancesPage from './page-client'

export const metadata: Metadata = {
 title: 'Customer & Supplier Balances | Finance',
 description: 'View and manage customer and supplier balance accounts.',
}

export default function Page() {
 return <BalancesPage />
}
