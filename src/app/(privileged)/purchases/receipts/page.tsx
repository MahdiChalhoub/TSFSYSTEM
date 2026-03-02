import { Metadata } from 'next'
import ReceiptsPage from './page-client'

export const metadata: Metadata = {
 title: 'Receipt Orders | Purchasing',
 description: 'Track and manage incoming inventory receipts and deliveries.',
}

export default function Page() {
 return <ReceiptsPage />
}
