'use client'

import React from 'react'

interface Product {
 id: number
 name: string
 price: number
}

interface QuickProductsProps {
 products: Product[]
 onSelect: (product: any) => void
}

export function QuickProducts({ products, onSelect }: QuickProductsProps) {
 return (
 <div className="space-y-4">
 <h3 className="uppercase">Quick Products</h3>
 <div className="space-y-2">
 {products.length === 0 ? (
 <p className="text-[10px] text-app-muted-foreground font-bold uppercase italic">No quick items set.</p>
 ) : (
 products.map(product => (
 <button
 key={product.id}
 onClick={() => onSelect(product)}
 className="w-full text-left p-3 rounded-xl border border-app-border hover:border-app-info hover:bg-app-info-soft/50 transition-all group"
 >
 <div className="text-xs font-bold text-app-foreground group-hover:text-app-info truncate">{product.name}</div>
 <div className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter mt-1">${product.price.toFixed(2)}</div>
 </button>
 ))
 )}
 </div>
 </div>
 )
}
