'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { TicketSidebar } from '@/components/pos/TicketSidebar';
import { Search, Loader2, Zap, Keyboard, Plus, User, MapPin, Calendar, FileText, Settings, Wallet, Save, Book, File, ArrowLeft, ChevronLeft, ChevronRight, Maximize, Minimize, Expand, Layout, Fullscreen } from 'lucide-react';
import { toast } from 'sonner';
import { QuickProducts } from '@/components/pos/QuickProducts';
import { CartItem } from '@/types/pos';
import { getCategories } from './actions';
import { getCommercialContext } from '@/app/actions/commercial';

type SidebarMode = 'hidden' | 'normal' | 'expanded';

export default function POSPage() {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
    const [sidebarMode, setSidebarMode] = useState<SidebarMode>('normal');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currency, setCurrency] = useState('$');
    const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    // Load context and categories
    useEffect(() => {
        getCommercialContext().then(ctx => {
            setCurrency(ctx.currency === 'USD' ? '$' : ctx.currency);
        });

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
        const basePrice = Number(product.basePrice || product.price || 0);
        const taxRate = Number(product.taxRate || 0);

        if (isNaN(basePrice)) {
            toast.error(`Invalid price for ${product.name}`);
            return;
        }

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
                price: basePrice,
                taxRate: taxRate,
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

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
                toast.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    }, []);

    const cycleSidebarMode = useCallback(() => {
        setSidebarMode(prev => {
            if (prev === 'hidden') return 'normal';
            if (prev === 'normal') return 'expanded';
            return 'hidden';
        });
    }, []);

    // Keyboard Shortcuts Logic
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Focus Search on "/"
            if (e.key === '/' && (e.target as HTMLElement).tagName !== 'INPUT') {
                e.preventDefault();
                document.getElementById('pos-search')?.focus();
            }

            // Fullscreen on F11 (standard but we add helper)
            if (e.key === 'f' && e.ctrlKey) {
                e.preventDefault();
                toggleFullscreen();
            }

            // Clear Cart on Ctrl + Delete
            if (e.ctrlKey && e.key === 'Delete') {
                e.preventDefault();
                if (confirm("Clear current ticket?")) clearCart();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [clearCart, toggleFullscreen]);

    const sidebarWidths = {
        hidden: 'w-0 opacity-0',
        normal: 'w-64 opacity-100',
        expanded: 'w-[60%] opacity-100'
    };

    return (
        <div className="absolute inset-0 flex flex-col bg-[#F1F5F9] overflow-hidden select-none">
            {/* TOP BAR: Utility Actions - HIDDEN IN FULLSCREEN */}
            {!isFullscreen && (
                <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0 z-50">
                    <div className="flex items-center gap-4">
                        <button className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-gray-400 hover:bg-gray-100 transition-all"><ArrowLeft size={18} /></button>
                        <div className="font-black text-gray-900 tracking-tighter text-lg uppercase italic">POS <span className="text-indigo-600">Terminal V2</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleFullscreen}
                            className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all mr-2 flex items-center gap-2 px-4 shadow-sm"
                        >
                            <Maximize size={18} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Fullscreen</span>
                        </button>
                        {[FileText, Settings, Wallet, Save, Book, File].map((Icon, i) => (
                            <button key={i} className="p-2.5 bg-white border border-gray-100 rounded-lg text-gray-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all">
                                <Icon size={18} />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* SECONDARY HEADER: Client & Search - HIDDEN IN FULLSCREEN */}
            {!isFullscreen && (
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
            )}

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* TOOLBAR FOR FULLSCREEN (Floating) */}
                {isFullscreen && (
                    <div className="absolute top-4 right-4 z-[100] flex gap-2">
                        <button
                            onClick={toggleFullscreen}
                            className="p-3 bg-white/50 backdrop-blur rounded-2xl border border-white/20 shadow-xl text-gray-600 hover:bg-white transition-all"
                        >
                            <Minimize size={20} />
                        </button>
                    </div>
                )}

                {/* LEFT SIDEBAR: Categories & Quick Products */}
                <aside className={`${sidebarWidths[sidebarMode]} transition-all duration-500 bg-white border-r border-gray-100 flex flex-col shrink-0 overflow-hidden`}>
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center whitespace-nowrap overflow-hidden">
                                {sidebarMode !== 'hidden' && <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Categories</h3>}
                                <button
                                    onClick={cycleSidebarMode}
                                    className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 flex items-center gap-2"
                                    title="Toggle Sidebar Layout"
                                >
                                    <Layout size={16} />
                                    {sidebarMode === 'hidden' && <span className="text-[10px] uppercase font-black">Show</span>}
                                </button>
                            </div>
                            {sidebarMode !== 'hidden' && (
                                <div className={`grid ${sidebarMode === 'expanded' ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-1`}>
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

                        {sidebarMode !== 'hidden' && <QuickProducts products={[]} onSelect={addToCart} />}
                    </div>
                </aside>

                {/* CENTER: Product Discovery */}
                <main className={`flex-1 flex flex-col min-w-0 bg-gray-50/30 transition-all duration-500 ${sidebarMode === 'hidden' ? 'opacity-0 w-0' : 'opacity-100'}`}>
                    <div className="flex-1 overflow-hidden p-6 py-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Product Catalog</h2>
                            {isFullscreen && (
                                <div className="flex-1 max-w-xl mx-8 relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Quick search..."
                                        className="w-full pl-10 pr-4 py-2 bg-white/70 border border-white/20 rounded-xl text-xs font-bold outline-none"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                        <ProductGrid
                            searchQuery={searchQuery}
                            categoryId={activeCategoryId}
                            onAddToCart={addToCart}
                            currency={currency}
                        />
                    </div>
                </main>

                {/* RIGHT SIDEBAR: Focused Cart View */}
                <aside
                    className={`flex-1 flex flex-col bg-white border-l border-gray-100 transition-all duration-500 ${sidebarMode === 'expanded' ? 'max-w-[40%]' : ''}`}
                >
                    <div className="flex-1 p-6 pl-0 overflow-hidden relative">
                        {/* Sidebar toggle for Hidden mode */}
                        {sidebarMode === 'hidden' && (
                            <button
                                onClick={cycleSidebarMode}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-600 shadow-xl hover:bg-indigo-600 hover:text-white transition-all z-50"
                            >
                                <ChevronRight size={20} />
                            </button>
                        )}

                        <TicketSidebar
                            cart={cart}
                            onUpdateQuantity={updateQuantity}
                            onClear={clearCart}
                            currency={currency}
                        />
                    </div>
                </aside>
            </div>
        </div>
    );
}