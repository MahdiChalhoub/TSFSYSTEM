import { getCoupons } from '@/app/actions/ecommerce/coupons'
import CouponsClient from './CouponsClient'

export const metadata = { title: 'Coupons | eCommerce' }

export default async function CouponsPage() {
  const coupons = await getCoupons().catch(() => [])
  return <CouponsClient initialCoupons={coupons} />
}