import { Metadata } from 'next'
import FNEMonitorClient from './monitor-client'

export const metadata: Metadata = {
 title: 'FNE Certification Monitor | E-Invoicing',
 description: 'Monitor, audit, and retry FNE e-invoice certifications for POS orders.',
}

export const dynamic = 'force-dynamic'

export default function Page() {
 return <FNEMonitorClient />
}
