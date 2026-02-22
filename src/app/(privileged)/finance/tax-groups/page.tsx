import { Metadata } from 'next'
import TaxGroupsPage from './page-client'

export const metadata: Metadata = {
    title: 'Tax Groups | Finance Settings',
    description: 'Create and manage tax groups, set rates, and configure the default tax group for the organization.',
}

export default function Page() {
    return <TaxGroupsPage />
}
