import { getPriceLists } from '@/app/actions/finance/pricing'
import PriceListManager from './manager'
import { DollarSign } from 'lucide-react'

export default async function PricingPage() {
    let priceLists: any = []
    try { priceLists = await getPriceLists() } catch { /* empty fallback */ }

    return (
        <div className="p-6 space-y-6">
            <header>
                <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                        <DollarSign size={28} className="text-white" />
                    </div>
                    Pricing <span className="text-indigo-600">Engine</span>
                </h1>
                <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Price Lists & Rules</p>
            </header>
            <PriceListManager priceLists={priceLists} />
        </div>
    )
}