import { Metadata } from 'next'
import ClientPortalAdminPage from './page-client'

export const metadata: Metadata = {
    title: 'Client Portal | Admin',
    description: 'Manage client portal access, wallets, orders, tickets, and quote requests.',
}

export default function Page() {
    return <ClientPortalAdminPage />
}
