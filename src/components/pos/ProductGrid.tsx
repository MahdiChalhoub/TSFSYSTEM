'use client';

import { useEffect, useState } from 'react';
import { getPosProducts } from '@/app/admin/sales/actions';
import clsx from 'clsx';

export function ProductGrid({ searchQuery, onAddToCart }: { searchQuery: string, onAddToCart: (p: any) => void }) {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getPosProducts().then(data => {
            setProducts(data);
            setLoading(false);
        });
    }, []);

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Catalog...</div>;

    return (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(product => (
                <div
                    key={product.id}
                    onClick={() => onAddToCart(product)}
                    className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer transition-all active:scale-95 select-none flex flex-col justify-between h-[160px]"
                >
                    <div>
                        {/* Placeholder for Image */}
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-sm font-bold mb-3">
                            {product.name.substring(0, 2).toUpperCase()}
                        </div>
                        <h3 className="font-medium text-gray-800 leading-tight line-clamp-2">{product.name}</h3>
                        <p className="text-xs text-gray-400 mt-1">{product.sku}</p>
                    </div>

                    <div className="flex justify-between items-end mt-2">
                        <span className="font-bold text-lg text-gray-900">${Number(product.basePrice).toFixed(2)}</span>
                        {Number(product.taxRate) > 0 && (
                            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                                {product.isTaxIncluded ? 'Tax Inc' : '+Tax'}
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
