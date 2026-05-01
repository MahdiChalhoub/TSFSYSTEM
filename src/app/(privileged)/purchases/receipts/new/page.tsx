import { Suspense } from 'react'
import ReceivingScreen from '../../receiving/ReceivingScreen'

export const dynamic = 'force-dynamic'

/**
 * /purchases/receipts/new
 * 
 * This route re-uses the existing ReceivingScreen from /purchases/receiving/.
 * PO list links (page-client.tsx, PORow.tsx) navigate here with ?from_po=<id>.
 * ReceivingScreen reads the `from_po` query param to auto-create a PO-based session.
 */
export default async function NewReceiptPage() {
    return (
        <Suspense fallback={<div className="page-container animate-pulse">Loading Receiving Screen...</div>}>
            <ReceivingScreen />
        </Suspense>
    )
}
