import { Metadata } from 'next'
import ConsignmentPage from './page-client'

export const metadata: Metadata = {
    title: 'Consignment Settlements | Commercial',
    description: 'Review and settle consignment stock agreements with suppliers.',
}

export default function Page() {
    return <ConsignmentPage />
}
