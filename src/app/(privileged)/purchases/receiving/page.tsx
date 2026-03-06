// @ts-nocheck
import { Suspense } from 'react'
import ReceivingScreen from './ReceivingScreen'

export const dynamic = 'force-dynamic'

export default async function PurchaseReceivingPage() {
    return (
        <Suspense fallback={<div className="page-container animate-pulse">Loading Receiving Screen...</div>}>
            <ReceivingScreen />
        </Suspense>
    )
}
