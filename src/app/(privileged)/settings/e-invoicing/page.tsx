import { Metadata } from 'next'
import EInvoiceSettingsPage from './page-client'

export const metadata: Metadata = {
  title: 'E-Invoice Settings | Settings',
  description: 'Configure electronic invoice certification — FNE (Côte d\'Ivoire), ZATCA (Saudi Arabia), API keys, and establishment details.',
}

export default function Page() {
  return <EInvoiceSettingsPage />
}
