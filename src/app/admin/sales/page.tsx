'use client';

import { useState, useEffect } from 'react';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { TicketSidebar } from '@/components/pos/TicketSidebar';
import { Search } from 'lucide-react';
import { getCategories } from '@/app/admin/sales/actions';
import clsx from 'clsx';

import { CartItem } from '@/types/pos';

export default function POSPage() {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

    // Fetch Categories
    useEffect(() => {
        getCategories().then(setCategories).catch(console.error);
    }, []);

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
        /* Full height layout hack for POS mode to maximize screen space */
        <div className="absolute inset-0 flex bg-gray-50/50">
            {/* LEFT: Product Selection (65%) */}
            <div className="w-[65%] flex flex-col border-r border-gray-200/60">
                {/* Search & Filter Header */}
                <div className="p-5 bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-20">
                    <div className="flex gap-4 mb-4">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                            <input
                                type="text"
                                placeholder="Scan Barcode or Search..."
                                className="w-full pl-12 pr-4 py-3.5 bg-gray-100/50 border border-transparent focus:bg-white focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl text-base outline-none transition-all placeholder:text-gray-400"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        <button
                            onClick={() => setSelectedCategoryId(null)}
                            className={clsx(
                                "px-5 py-2 rounded-xl font-medium text-sm transition-all active:scale-95 whitespace-nowrap",
                                selectedCategoryId === null
                                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20"
                                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                            )}
                        >
                            All Items
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategoryId(cat.id)}
                                className={clsx(
                                    "px-5 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap active:scale-95",
                                    selectedCategoryId === cat.id
                                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20"
                                        : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                                )}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    <ProductGrid
                        searchQuery={searchQuery}
                        categoryId={selectedCategoryId}
                        onAddToCart={addToCart}
                    />
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
