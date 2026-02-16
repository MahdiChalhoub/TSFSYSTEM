import { erpFetch } from '@/lib/erpFetch'
import DeliveryDashboard from './dashboard'

export default async function DeliveriesPage() {
    let deliveries: any[] = []
    let zones: any[] = []

    try {
        const [dRes, zRes] = await Promise.all([
            erpFetch('/deliveries/'),
            erpFetch('/delivery-zones/'),
        ])
        deliveries = Array.isArray(dRes) ? dRes : dRes.results || []
        zones = Array.isArray(zRes) ? zRes : zRes.results || []
    } catch { /* empty */ }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Deliveries & Shipments</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Track deliveries from dispatch to final delivery. Manage zones and fees.
                </p>
            </div>
            <DeliveryDashboard initialDeliveries={deliveries} zones={zones} />
        </div>
    )
}
