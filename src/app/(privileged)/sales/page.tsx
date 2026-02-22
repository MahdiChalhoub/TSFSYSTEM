'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { TicketSidebar } from '@/components/pos/TicketSidebar';
import { Search, Loader2, Zap, Keyboard, Plus, User, MapPin, Calendar, FileText, Settings, Wallet, Save, Book, File, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { QuickProducts } from '@/components/pos/QuickProducts';
import { CartItem } from '@/types/pos';
import { getCategories } from './actions';

export default function POSPage() {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);

    // Load actual categories from the database
    useEffect(() => {
        getCategories()
            .then((data: any[]) => {
                const cats = Array.isArray(data) ? data.slice(0, 12) : [];
                setCategories(cats);
            })
            .catch(() => setCategories([]))
            .finally(() => setCategoriesLoading(false));
    }, []);

    // Add Item to Cart Logic
    const addToCart = useCallback((product: Record<string, any>) => {
        setCart(prev => {
            const existing = prev.find(p => p.productId === product.id);
            if (existing) {
                toast.info(`Increased ${product.name} quantity`, { duration: 1000 });
                return prev.map(p => p.productId === product.id
                    ? { ...p, quantity: p.quantity + 1 }
                    : p
                );
            }
            toast.success(`Added ${product.name} to ticket`, { duration: 1000 });
            return [...prev, {
                productId: product.id,
                name: product.name,
                price: Number(product.basePrice),
                taxRate: Number(product.taxRate),
                quantity: 1,
                isTaxIncluded: product.isTaxIncluded
            }];
        });
    }, []);

    const updateQuantity = useCallback((productId: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.productId === productId) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(i => i.quantity > 0));
    }, []);

    const clearCart = useCallback(() => {
        setCart([]);
        toast.info("Ticket cleared");
    }, []);

    // Keyboard Shortcuts Logic
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Focus Search on "/"
            if (e.key === '/' && (e.target as HTMLElement).tagName !== 'INPUT') {
                e.preventDefault();
                document.getElementById('pos-search')?.focus();
            }

            // Clear Cart on Ctrl + Delete
            if (e.ctrlKey && e.key === 'Delete') {
                e.preventDefault();
                if (confirm("Clear current ticket?")) clearCart();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [clearCart]);

    return (
        <div className="absolute inset-0 flex flex-col bg-[#F1F5F9] overflow-hidden select-none">
            {/* TOP BAR: Utility Actions */}
            <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-4">
                    <button className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-gray-400 hover:bg-gray-100 transition-all"><ArrowLeft size={18} /></button>
                    <div className="font-black text-gray-900 tracking-tighter text-lg uppercase italic">POS <span className="text-indigo-600">Terminal V2</span></div>
                </div>
                <div className="flex items-center gap-2">
                    {[FileText, Settings, Wallet, Save, Book, File].map((Icon, i) => (
                        <button key={i} className="p-2.5 bg-white border border-gray-100 rounded-lg text-gray-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all">
                            <Icon size={18} />
                        </button>
                    ))}
                </div>
            </div>

            {/* SECONDARY HEADER: Client & Search */}
            <div className="bg-white border-b border-gray-100 p-6 flex items-center gap-6 shrink-0">
                <div className="w-64">
                    <div className="relative">
                        <select className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold appearance-none outline-none focus:border-indigo-500 transition-all cursor-pointer">
                            <option>Walk-in Customer</option>
                            <option>John Doe</option>
                        </select>
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    </div>
                </div>
                <button className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"><Plus size={18} /></button>

                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl">
                    <MapPin size={14} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-600">Zone: A</span>
                </div>

                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input
                        id="pos-search"
                        type="text"
                        placeholder="Search by product name or barcode..."
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <button className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">+ Add New Product</button>

                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl">
                    <span className="text-xs font-bold text-gray-600">27/05/2025</span>
                    <Calendar size={14} className="text-gray-400" />
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT SIDEBAR: Categories & Quick Products */}
                <aside className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 bg-white border-r border-gray-100 flex flex-col shrink-0 overflow-hidden`}>
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center whitespace-nowrap overflow-hidden">
                                {!isSidebarCollapsed && <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Categories</h3>}
                                <button
                                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                    className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"
                                >
                                    {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                                </button>
                            </div>
                            {!isSidebarCollapsed && (
                                <div className="space-y-1">
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setActiveCategoryId(cat.id)}
                                            className={`w-full text-left p-3.5 rounded-xl text-xs font-bold transition-all ${activeCategoryId === cat.id ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {!isSidebarCollapsed && <QuickProducts products={[]} onSelect={addToCart} />}
                    </div>
                </aside>

                {/* CENTER & RIGHT: Integrated Cart & Payment */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 p-6 overflow-hidden">
                        <TicketSidebar
                            cart={cart}
                            onUpdateQuantity={updateQuantity}
                            onClear={clearCart}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
}