import type { Metadata } from 'next'
import ProcurementRecoveryClient from './client'

export const metadata: Metadata = {
    title: 'Procurement Recovery · Settings',
    description: 'Configure how long terminal procurement states (Received / Cancelled / Rejected / Failed) stay before auto-recycling to Available.',
}

export default function ProcurementRecoveryPage() {
    return <ProcurementRecoveryClient />
}
