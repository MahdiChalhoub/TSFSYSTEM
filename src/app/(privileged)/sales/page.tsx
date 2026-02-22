'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { TicketSidebar } from '@/components/pos/TicketSidebar';
import { CartTable } from '@/components/pos/CartTable';
import { CartTotals } from '@/components/pos/CartTotals';
import { CompactClientHeader } from '@/components/pos/CompactClientHeader';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { Search, Loader2, Zap, Keyboard, Plus, User, MapPin, Calendar, FileText, Settings, Wallet, Save, Book, File, ArrowLeft, ChevronLeft, ChevronRight, Maximize, Minimize, Expand, Layout, Fullscreen, ShoppingCart, X, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { QuickProducts } from '@/components/pos/QuickProducts';
import { CartItem } from '@/types/pos';
import { getCategories, processSale } from './actions';
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

    const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
    const [cashReceived, setCashReceived] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);

    const total = cart.reduce((acc: number, item: any) => acc + (Number(item.price) * item.quantity), 0);
    const totalPieces = cart.reduce((acc: number, item: any) => acc + item.quantity, 0);
    const uniqueItems = cart.length;

    const discount = 0; // Mocked
    const totalAmount = Math.max(0, total - discount);

    // Override & Receipt States
    const [isOverrideOpen, setIsOverrideOpen] = useState(false);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [lastOrder, setLastOrder] = useState<{ id: number; ref: string } | null>(null);

    const handleCharge = useCallback(async () => {
        if (cart.length === 0 || isProcessing) return;
        setIsProcessing(true);
        try {
            const result = await processSale({
                cart,
                paymentMethod,
                totalAmount: totalAmount,
                scope: 'OFFICIAL'
            });

            if (result.success) {
                toast.success(`Sale Processed: ${result.ref}`);
                // In a real app, we'd trigger the receipt modal here.
                // For now, just clear the cart.
                clearCart();
                setCashReceived('');
            }
        } catch (error) {
            toast.error("Process Logic Failure.");
        } finally {
            setIsProcessing(false);
        }
    }, [cart, isProcessing, paymentMethod, totalAmount, clearCart]);

    const sidebarWidths = {
        hidden: 'w-0 opacity-0',
        normal: 'w-96 opacity-100',
        expanded: 'w-[60%] opacity-100'
    };

    return (
        <div className={clsx(
            "flex flex-col bg-[#F1F5F9] overflow-hidden select-none",
            isFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen" : "absolute inset-0"
        )}>
            <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0 z-50">
                <div className="flex items-center gap-6">
                    <h1 className="text-2xl font-black tracking-tighter text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
                            <ShoppingCart size={20} className="text-white" />
                        </div>
                        Sales <span className="text-indigo-600">Terminal</span>
                    </h1>

                    {/* Session Tabs */}
                    <div className="flex gap-1.5 ml-2 overflow-x-auto max-w-sm no-scrollbar">
                        {sessions.map(s => (
                            <div key={s.id} className="flex shrink-0 group">
                                <button
                                    onClick={() => setActiveSessionId(s.id)}
                                    className={clsx(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                        activeSessionId === s.id
                                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                                            : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                                    )}
                                >
                                    <ShoppingCart size={12} className={activeSessionId === s.id ? "text-white" : "text-gray-300"} />
                                    {s.name}
                                </button>
                                <button
                                    onClick={() => removeSession(s.id)}
                                    className="ml-[-8px] p-1 text-gray-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={createNewSession}
                            className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-400 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleFullscreen}
                        className="bg-indigo-50 border border-indigo-100 text-indigo-600 h-10 px-4 rounded-xl font-bold shadow-sm hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2 transition-all"
                    >
                        {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                        <span className="text-[10px] uppercase tracking-widest">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
                    </button>
                    <div className="h-6 w-px bg-gray-100 mx-1" />
                    {[FileText, Settings, Wallet, Save, Book, File].map((Icon, i) => (
                        <button key={i} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-100 rounded-lg text-gray-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm">
                            <Icon size={16} />
                        </button>
                    ))}
                    <button className="w-8 h-8 flex items-center justify-center bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 ml-1">
                        <ArrowLeft size={16} />
                    </button>
                </div>
            </header>

            {/* SECONDARY HEADER: Client & Search - COMPACT */}
            <CompactClientHeader
                client={selectedClient}
                currency={currency}
                uniqueItems={uniqueItems}
                totalPieces={totalPieces}
            />

            <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4 shrink-0">
                <div className="w-64">
                    <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={14} />
                        <select
                            value={selectedClientId}
                            onChange={(e) => updateActiveSession({ clientId: Number(e.target.value) })}
                            className="w-full pl-10 pr-8 py-2.5 bg-gray-50/50 border border-gray-100 rounded-xl text-[10px] font-black appearance-none outline-none focus:bg-white focus:border-indigo-500 transition-all cursor-pointer shadow-sm uppercase tracking-widest"
                        >
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                    </div>
                </div>

                <div className="h-8 w-px bg-gray-100" />

                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input
                        id="pos-search"
                        type="text"
                        placeholder="Search product..."
                        className="w-full pl-12 pr-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <button className="h-11 px-6 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
                    <Plus size={16} />
                    Product
                </button>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* LEFT DISCOVERY COLUMN: Categories + Totals */}
                <aside className={clsx(
                    "bg-white border-r border-gray-100 flex flex-col shrink-0 transition-all duration-500 overflow-hidden",
                    sidebarMode === 'hidden' ? 'w-0 opacity-0' : (sidebarMode === 'expanded' ? 'w-[60%]' : 'w-80')
                )}>
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {/* Categories Horizontal Scroll */}
                        <div className="p-4 bg-gray-50/50 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                            {/* ... categories ... */}
                            <button
                                onClick={() => setActiveCategoryId(null)}
                                className={clsx(
                                    "px-4 py-2 whitespace-nowrap rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                    activeCategoryId === null ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-100'
                                )}
                            >
                                All
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategoryId(cat.id)}
                                    className={clsx(
                                        "px-4 py-2 whitespace-nowrap rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                        activeCategoryId === cat.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-100'
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        {/* Totals & Payments (Shifted to Left) */}
                        <div className="p-6 border-b border-gray-50 bg-white shrink-0">
                            <CartTotals
                                subtotal={total}
                                discount={discount}
                                totalAmount={totalAmount}
                                cashReceived={cashReceived}
                                paymentMethod={paymentMethod}
                                isPending={isProcessing}
                                currency={currency}
                                onSetCashReceived={setCashReceived}
                                onSetPaymentMethod={setPaymentMethod}
                                onCharge={handleCharge}
                                onDiscountClick={() => setIsOverrideOpen(true)}
                            />
                        </div>

                        {/* Quick Products Footer */}
                        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                            <QuickProducts products={[]} onSelect={addToCart} />
                        </div>
                    </div>
                </aside>

                {/* MAIN ACTION PANE: Grid + Table */}
                <main className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden p-6 gap-6">
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                        <ProductGrid
                            searchQuery={searchQuery}
                            categoryId={activeCategoryId}
                            onAddToCart={addToCart}
                            currency={currency}
                        />
                    </div>

                    <div className="h-[40%] shrink-0 overflow-hidden">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest italic flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></span>
                                Current Ticket Review
                            </h3>
                        </div>
                        <CartTable
                            cart={cart}
                            onUpdateQuantity={updateQuantity}
                            onRemoveItem={(id) => updateQuantity(id, -100)} // Full remove
                            currency={currency}
                        />
                    </div>
                </main>
            </div>

            <ManagerOverride
                isOpen={isOverrideOpen}
                actionLabel="Authorize Change"
                onClose={() => setIsOverrideOpen(false)}
                onSuccess={() => {
                    // This would normally handle specific authorized actions
                    toast.success("Action authorized");
                }}
            />

            <ReceiptModal
                isOpen={isReceiptOpen}
                onClose={() => setIsReceiptOpen(false)}
                orderId={lastOrder?.id || null}
                refCode={lastOrder?.ref || null}
            />
        </div>
    );
}