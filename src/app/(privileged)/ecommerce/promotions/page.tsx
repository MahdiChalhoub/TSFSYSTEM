import { getPromotions } from '@/app/actions/ecommerce/promotions'
import PromotionsClient from './PromotionsClient'

export const metadata = { title: 'Promotions | eCommerce' }

export default async function PromotionsPage() {
  const promotions = await getPromotions().catch(() => [])
  return <PromotionsClient initialPromotions={promotions} />
}