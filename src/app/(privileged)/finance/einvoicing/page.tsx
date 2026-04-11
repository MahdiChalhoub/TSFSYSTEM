import { Metadata } from 'next'
import EInvoicingPage from './page-client'

export const metadata: Metadata = {
 title: 'E-Invoicing | Finance',
 description: 'Submit, track, and manage electronic invoices for ZATCA and FNE compliance.',
}

export default function Page() {
 return <EInvoicingPage />
}
