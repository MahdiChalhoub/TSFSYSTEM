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
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Quick Products</h3>
            <div className="space-y-2">
                {products.length === 0 ? (
                    <p className="text-[10px] text-gray-400 font-bold uppercase italic">No quick items set.</p>
                ) : (
                    products.map(product => (
                        <button
                            key={product.id}
                            onClick={() => onSelect(product)}
                            className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group"
                        >
                            <div className="text-xs font-bold text-gray-700 group-hover:text-indigo-600 truncate">{product.name}</div>
                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter mt-1">${product.price.toFixed(2)}</div>
                        </button>
                    ))
                )}
            </div>
        </div>
    )
}
