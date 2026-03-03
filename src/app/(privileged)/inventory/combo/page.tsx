import { erpFetch } from '@/lib/erp-api'
import { Package } from 'lucide-react'
import ComboManager from './manager'

interface Product {
 id: number
 sku: string
 barcode: string | null
 name: string
 product_type: string
 selling_price_ttc: number
 category_name: string | null
 brand_name: string | null
}

export default async function ComboPage() {
 let products: Product[] = []
 try {
 const res: any = await erpFetch('inventory/products/')
 products = Array.isArray(res) ? res : res.results || []
 } catch { /* empty */ }

 const comboProducts = products.filter((p: Product) => p.product_type === 'COMBO')
 const standardProducts = products.filter((p: Product) => p.product_type !== 'COMBO')

 return (
 <div className="app-page p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 rounded-2xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
 <Package size={28} className="text-app-foreground" />
 </div>
 <div>
 <h1 className="page-header-title tracking-tighter">Combo & <span className="text-purple-600">Bundle</span> Products</h1>
 <p className="text-sm text-app-muted-foreground mt-1">
 Create product bundles by combining multiple items into a single combo.
 When sold, stock for each component is deducted automatically.
 </p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl p-5 text-app-foreground">
 <p className="text-xs font-bold uppercase opacity-80">Total Combos</p>
 <p className="text-3xl font-bold mt-1">{comboProducts.length}</p>
 </div>
 <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 text-app-foreground">
 <p className="text-xs font-bold uppercase opacity-80">Standard Products</p>
 <p className="text-3xl font-bold mt-1">{standardProducts.length}</p>
 </div>
 <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-app-foreground">
 <p className="text-xs font-bold uppercase opacity-80">Total Products</p>
 <p className="text-3xl font-bold mt-1">{products.length}</p>
 </div>
 </div>

 <ComboManager
 comboProducts={comboProducts}
 allProducts={standardProducts}
 />
 </div>
 )
}
