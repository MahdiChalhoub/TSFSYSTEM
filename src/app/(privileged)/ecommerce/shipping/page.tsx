import { getDeliveryZones, getShippingRates } from '@/app/actions/ecommerce/shipping'
import ShippingClient from './ShippingClient'

export const metadata = { title: 'Shipping Rates | eCommerce' }

export default async function ShippingPage() {
  const [zones, rates] = await Promise.all([
    getDeliveryZones().catch(() => []),
    getShippingRates().catch(() => []),
  ])
  return <ShippingClient initialZones={zones} initialRates={rates} />
}