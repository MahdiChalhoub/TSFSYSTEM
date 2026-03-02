'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Package, Hash, Tag, Scale } from 'lucide-react'
import { getCategoryProducts } from '@/app/actions/inventory/categories'
import { getUnitProducts } from '@/app/actions/inventory/units'

export function ProductList({ categoryId, unitId }: { categoryId?: number, unitId?: number | string }) {
 const [products, setProducts] = useState<any[]>([])
 const [loading, setLoading] = useState(true)

 useEffect(() => {
 const fetchProducts = async () => {
 setLoading(true)
 try {
 let data = []
 if (categoryId) {
 data = await getCategoryProducts(categoryId)
 } else if (unitId) {
 data = await getUnitProducts(unitId)
 }
 setProducts(data)
 } catch (err) {
 console.error("Failed to fetch products:", err)
 } finally {
 setLoading(false)
 }
 }
 fetchProducts()
 }, [categoryId, unitId])

 if (loading) return (
 <div className="p-12 text-center">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 inline-block"></div>
 <p className="text-xs text-app-text-faint mt-2 font-medium animate-pulse">Scanning Warehouse...</p>
 </div>
 )

 if (products.length === 0) return (
 <div className="p-12 text-center text-app-text-faint italic font-medium">
 No products assigned to this item at this time.
 </div>
 )

 return (
 <div className="p-8 space-y-4 bg-gray-50/50">
 <div className="flex items-center gap-2 mb-2">
 <Package size={16} className="text-app-text-faint" />
 <span className="text-[10px] font-black text-app-text-faint uppercase tracking-widest">Assigned SKU Assets</span>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {products.map(p => (
 <div key={p.id} className="p-5 bg-app-surface rounded-[1.5rem] border border-app-border shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all flex justify-between items-center group cursor-default">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-xl bg-app-bg text-app-text-faint flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors border border-transparent group-hover:border-emerald-100">
 <Package size={20} />
 </div>
 <div className="min-w-0">
 <p className="font-black text-app-text text-sm truncate">{p.name}</p>
 <div className="flex items-center gap-2 mt-1">
 <span className="text-[9px] bg-app-surface-2 text-app-text-muted px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-tight">
 {p.sku || 'NO-SKU'}
 </span>
 {p.barcode && (
 <span className="text-[9px] text-app-text-faint font-mono font-medium">
 {p.barcode}
 </span>
 )}
 </div>
 </div>
 </div>
 <div className="text-right ml-4">
 <p className={`text-xl font-mono font-black leading-none ${p.stock_level > 0 ? 'text-app-text' : 'text-rose-500'}`}>
 {p.stock_level || 0}
 </p>
 <span className="text-[8px] text-app-text-faint uppercase font-black tracking-widest">{p.unit_name || 'Units'}</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )
}
