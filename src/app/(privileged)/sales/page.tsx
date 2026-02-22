'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { TicketSidebar } from '@/components/pos/TicketSidebar';
import { Search, Loader2, Zap, Keyboard, Plus, User, MapPin, Calendar, FileText, Settings, Wallet, Save, Book, File, ArrowLeft, ChevronLeft, ChevronRight, Maximize, Minimize, Expand, Layout, Fullscreen, ShoppingCart, X } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { QuickProducts } from '@/components/pos/QuickProducts';
import { CartItem } from '@/types/pos';
import { getCategories } from './actions';
import { getCommercialContext } from '@/app/actions/commercial';

type SidebarMode = 'hidden' | 'normal' | 'expanded';

export default function POSPage() {
    // Phase 1: Client State
    const [clients, setClients] = useState<any[]>([
        { id: 1, name: 'Walk-in Customer', phone: 'N/A', balance: 0, loyalty: 0, address: 'Counter Sales', zone: 'A' },
        { id: 2, name: 'John Doe', phone: '+91 54321 098765', balance: 120, loyalty: 50, address: '1st Block, Rammurthy Nagar', zone: 'B' },
        { id: 3, name: 'Sarah Smith', phone: '+225 07070707', balance: 450, loyalty: 120, address: 'Plateau, Abidjan', zone: 'A' },
    ]);

    // Phase 5: Multi-Order Sessions
    const [sessions, setSessions] = useState<any[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
    const [sidebarMode, setSidebarMode] = useState<SidebarMode>('normal');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currency, setCurrency] = useState('$');
    const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);

    // Initial Session Setup & Persistence
    useEffect(() => {
        const saved = localStorage.getItem('pos_sessions');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.length > 0) {
                    setSessions(parsed);
                    setActiveSessionId(parsed[0].id);
                } else {
                    const initialId = Date.now().toString();
                    const initial = [{ id: initialId, clientId: 1, cart: [], name: 'Ticket 1' }];
                    setSessions(initial);
                    setActiveSessionId(initialId);
                }
            } catch (e) {
                console.error("Failed to load sessions", e);
            }
        } else {
            const initialId = Date.now().toString();
            const initial = [{ id: initialId, clientId: 1, cart: [], name: 'Ticket 1' }];
            setSessions(initial);
            setActiveSessionId(initialId);
        }
    }, []);

    // Persist on change
    useEffect(() => {
        if (sessions.length > 0) {
            localStorage.setItem('pos_sessions', JSON.stringify(sessions));
        }
    }, [sessions]);

    const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || { cart: [], clientId: 1 };
    const cart = activeSession.cart;
    const selectedClientId = activeSession.clientId;
    const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0];

    const updateActiveSession = useCallback((updates: any) => {
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, ...updates } : s));
    }, [activeSessionId]);

    const createNewSession = () => {
        const newId = Date.now().toString();
        const newSession = { id: newId, clientId: 1, cart: [], name: `Ticket ${sessions.length + 1}` };
        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(newId);
        toast.success("New ticket created");
    };

    const removeSession = (id: string) => {
        if (sessions.length <= 1) {
            toast.error("At least one ticket must remain open");
            return;
        }
        setSessions(prev => {
            const next = prev.filter(s => s.id !== id);
            if (activeSessionId === id) setActiveSessionId(next[0].id);
            return next;
        });
        toast.info("Ticket closed");
    };
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

    // Phase 2: Cart Logic (Sticky Top Guardrail)
    const addToCart = useCallback((product: Record<string, any>) => {
        const basePrice = Number(product.basePrice || product.price || 0);
        const taxRate = Number(product.taxRate || 0);

        if (isNaN(basePrice)) {
            toast.error(`Invalid price for ${product.name}`);
            return;
        }

        const existingIndex = cart.findIndex((p: any) => (p as any).productId === product.id);
        let newCart: any[];

        if (existingIndex !== -1) {
            const item = { ...cart[existingIndex], quantity: (cart[existingIndex] as any).quantity + 1 };
            const filtered = cart.filter((_: any, i: number) => i !== existingIndex);
            newCart = [item, ...filtered];
            toast.info(`Updated piece: ${product.name}`, { duration: 1000, icon: 'ΓÜí' });
        } else {
            newCart = [{
                productId: product.id,
                name: product.name,
                price: basePrice,
                taxRate: taxRate,
                quantity: 1,
                isTaxIncluded: product.isTaxIncluded
            }, ...cart];
            toast.success(`New item: ${product.name}`, { duration: 1000 });
        }
        updateActiveSession({ cart: newCart });
    }, [cart, updateActiveSession]);

    const updateQuantity = useCallback((productId: number, delta: number) => {
        const newCart = cart.map((item: any) => {
            if (item.productId === productId) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter((i: any) => i.quantity > 0);
        updateActiveSession({ cart: newCart });
    }, [cart, updateActiveSession]);

    const clearCart = useCallback(() => {
        updateActiveSession({ cart: [] });
        toast.info("Ticket cleared");
    }, [updateActiveSession]);

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
        <div className={clsx(
            "flex flex-col bg-[#F1F5F9] overflow-hidden select-none",
            isFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen" : "absolute inset-0"
        )}>
            <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <button className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-gray-400 hover:bg-gray-100 transition-all"><ArrowLeft size={18} /></button>
                    <div className="font-black text-gray-900 tracking-tighter text-lg uppercase italic">POS <span className="text-indigo-600">Terminal V2</span></div>

                    {/* Session Tabs */}
                    <div className="flex gap-2 ml-8 overflow-x-auto max-w-md custom-scrollbar-hide">
                        {sessions.map(s => (
                            <div key={s.id} className="flex shrink-0">
                                <button
                                    onClick={() => setActiveSessionId(s.id)}
                                    className={clsx(
                                        "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        activeSessionId === s.id
                                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                                            : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                                    )}
                                >
                                    <ShoppingCart size={14} />
                                    {s.name}
                                </button>
                                <button
                                    onClick={() => removeSession(s.id)}
                                    className="ml-[-12px] p-1 text-gray-300 hover:text-rose-500 transition-all"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={createNewSession}
                            className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleFullscreen}
                        className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all mr-2 flex items-center gap-2 px-4 shadow-sm"
                    >
                        {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                        <span className="text-[10px] font-black uppercase tracking-widest">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
                    </button>
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
                        <select
                            value={selectedClientId}
                            onChange={(e) => updateActiveSession({ clientId: Number(e.target.value) })}
                            className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold appearance-none outline-none focus:border-indigo-500 transition-all cursor-pointer"
                        >
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    </div>
                </div>
                <button className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"><Plus size={18} /></button>

                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl">
                    <MapPin size={14} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Zone: {selectedClient.zone}</span>
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
            <div className="flex-1 flex overflow-hidden relative">
                {/* Floating Controls Removed - Replaced by Global Header visibility */}

                {/* LEFT DISCOVERY COLUMN: Categories + Grid */}
                <aside className={clsx(
                    "bg-white border-r border-gray-100 flex flex-col shrink-0 transition-all duration-500 overflow-hidden",
                    sidebarMode === 'hidden' ? 'w-0 opacity-0' : (sidebarMode === 'expanded' ? 'w-[60%]' : 'w-96')
                )}>
                    {/* Header for Discovery Column */}
                    <div className="p-6 border-b border-gray-50 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Layout size={16} /></span>
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest italic">Discovery</h3>
                        </div>
                        <button
                            onClick={cycleSidebarMode}
                            className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-all"
                            title="Collapse Discovery area"
                        >
                            <ChevronLeft size={20} />
                        </button>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {/* Categories Horizontal Scroll */}
                        <div className="p-4 bg-gray-50/50 flex gap-2 overflow-x-auto custom-scrollbar shrink-0">
                            <button
                                onClick={() => setActiveCategoryId(null)}
                                className={clsx(
                                    "px-4 py-2 whitespace-nowrap rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                    activeCategoryId === null
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100'
                                        : 'bg-white text-gray-500 border-gray-100 hover:border-indigo-200'
                                )}
                            >
                                All Items
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategoryId(cat.id)}
                                    className={clsx(
                                        "px-4 py-2 whitespace-nowrap rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                        activeCategoryId === cat.id
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100'
                                            : 'bg-white text-gray-500 border-gray-100 hover:border-indigo-200'
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        {/* Product Grid Area */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {/* Fullscreen Search Overlay (Hidden) */}
                            {/* We now show the main search bar in fullscreen, so we remove this redundant one */}
                            <ProductGrid
                                searchQuery={searchQuery}
                                categoryId={activeCategoryId}
                                onAddToCart={addToCart}
                                currency={currency}
                            />
                        </div>

                        {/* Quick Products Footer */}
                        <div className="p-4 border-t border-gray-50 overflow-hidden shrink-0">
                            <QuickProducts products={[]} onSelect={addToCart} />
                        </div>
                    </div>
                </aside>

                {/* RIGHT COLUMN: Ticket/Sidebar (Fills remaining space) */}
                <main className="flex-1 flex flex-col bg-white overflow-hidden relative min-w-0">
                    {/* Reshow Toggle (Only if hidden) */}
                    {sidebarMode === 'hidden' && (
                        <button
                            onClick={cycleSidebarMode}
                            className="absolute left-4 top-1/2 -translate-y-1/2 z-[100] w-12 h-12 bg-indigo-600 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                        >
                            <ChevronRight size={24} />
                        </button>
                    )}

                    <div className="flex-1 flex flex-col p-6 overflow-hidden">
                        <TicketSidebar
                            cart={cart}
                            onUpdateQuantity={updateQuantity}
                            onClear={clearCart}
                            currency={currency}
                            client={selectedClient}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
}