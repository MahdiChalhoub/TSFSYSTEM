'use client';

import { useState, useEffect } from 'react';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { TicketSidebar } from '@/components/pos/TicketSidebar';
import { Search } from 'lucide-react';

import { CartItem } from '@/types/pos';

export default function POSPage() {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Add Item to Cart Logic
    const addToCart = (product: any) => {
        setCart(prev => {
            const existing = prev.find(p => p.productId === product.id);
            if (existing) {
                return prev.map(p => p.productId === product.id
                    ? { ...p, quantity: p.quantity + 1 }
                    : p
                );
            }
            return [...prev, {
                productId: product.id,
                name: product.name,
                price: Number(product.basePrice),
                taxRate: Number(product.taxRate),
                quantity: 1,
                isTaxIncluded: product.isTaxIncluded
            }];
        });
    };

    const updateQuantity = (productId: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.productId === productId) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(i => i.quantity > 0));
    };

    const clearCart = () => setCart([]);

    return (
        <div className="flex h-[calc(100vh-120px)] -m-6 gap-0 bg-gray-100 overflow-hidden">
            {/* LEFT: Product Selection (65%) */}
            <div className="w-[65%] flex flex-col border-r border-gray-200">
                {/* Search Bar */}
                <div className="p-4 bg-white border-b border-gray-200 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Scan Barcode or Search Product..."
                            className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button className="px-4 py-2 bg-white shadow-sm rounded-md font-medium text-sm">All</button>
                        <button className="px-4 py-2 text-gray-500 font-medium text-sm hover:bg-gray-200 rounded-md">Produce</button>
                        <button className="px-4 py-2 text-gray-500 font-medium text-sm hover:bg-gray-200 rounded-md">Dairy</button>
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    <ProductGrid searchQuery={searchQuery} onAddToCart={addToCart} />
                </div>
            </div>

            {/* RIGHT: Ticket/Cart (35%) */}
            <div className="w-[35%] bg-white flex flex-col shadow-xl z-10">
                <TicketSidebar
                    cart={cart}
                    onUpdateQuantity={updateQuantity}
                    onClear={clearCart}
                />
            </div>
        </div>
    );
}
