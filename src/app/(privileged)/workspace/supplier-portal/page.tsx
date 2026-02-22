import { Metadata } from 'next'
import SupplierPortalAdminPage from './page-client'

export const metadata: Metadata = {
    title: 'Supplier Portal | Admin',
    description: 'Manage supplier portal access, proformas, and price change requests.',
}

export default function Page() {
    return <SupplierPortalAdminPage />
}
