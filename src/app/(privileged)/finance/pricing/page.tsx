import { getPriceLists } from '@/app/actions/finance/pricing'
import PriceListManager from './manager'
import { DollarSign } from 'lucide-react'

export default async function PricingPage() {
 let priceLists: any = []
 try { priceLists = await getPriceLists() } catch { /* empty fallback */ }

 return (
 <div className="page-container">
 <header>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
 <DollarSign size={28} className="text-app-text" />
 </div>
 Pricing <span className="text-indigo-600">Engine</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">Price Lists & Rules</p>
 </header>
 <PriceListManager priceLists={priceLists} />
 </div>
 )
}