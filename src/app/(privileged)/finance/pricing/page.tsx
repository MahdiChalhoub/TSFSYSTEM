// @ts-nocheck
import { getPriceLists } from '@/app/actions/finance/pricing'
import PriceListManager from './manager'

export default async function PricingPage() {
    const priceLists = await getPriceLists()

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-stone-900 mb-6 font-serif">Pricing Engine</h1>
            <PriceListManager priceLists={priceLists} />
        </div>
    )
}