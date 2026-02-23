'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { CartItem } from '@/types/pos';
import { POSLayoutVariant } from '@/types/pos-layout';
import { POSLayoutClassic } from '@/components/pos/layouts/POSLayoutClassic';
import { POSLayoutModern } from '@/components/pos/layouts/POSLayoutModern';
import { POSLayoutCompact } from '@/components/pos/layouts/POSLayoutCompact';
import { POSLayoutSelector } from '@/components/pos/layouts/POSLayoutSelector';
import { getCategories, processSale } from './actions';
import { getCommercialContext } from '@/app/actions/commercial';
import { getUser } from '@/app/actions/auth';
import { getContacts } from '@/app/actions/crm/contacts';

type SidebarMode = 'hidden' | 'normal' | 'expanded';

const LAYOUT_STORAGE_KEY = 'pos-layout-preference';

export default function POSPage() {
    // ─── Layout System ───
    const [currentLayout, setCurrentLayout] = useState<POSLayoutVariant>('classic');
    const [isLayoutSelectorOpen, setIsLayoutSelectorOpen] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (saved && ['classic', 'modern', 'compact'].includes(saved)) {
            setCurrentLayout(saved as POSLayoutVariant);
        }
    }, []);

    const handleLayoutChange = useCallback((layout: POSLayoutVariant) => {
        setCurrentLayout(layout);
        localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
        toast.success(`Switched to ${layout.charAt(0).toUpperCase() + layout.slice(1)} layout`);
    }, []);

    // ─── Client State ───
    const [clients, setClients] = useState<any[]>([
        { id: 1, name: 'Walk-in Customer', phone: 'N/A', balance: 0, loyalty: 0, address: 'Counter Sales', zone: 'A' },
        { id: 2, name: 'John Doe', phone: '+91 54321 098765', balance: 120, loyalty: 50, address: '1st Block, Rammurthy Nagar', zone: 'B' },
        { id: 3, name: 'Sarah Smith', phone: '+225 07070707', balance: 450, loyalty: 120, address: 'Plateau, Abidjan', zone: 'A' },
    ]);

    // ─── Multi-Order Sessions ───
    const [sessions, setSessions] = useState<any[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    // ─── User Role State ───
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [highlightedItemId, setHighlightedItemId] = useState<number | null>(null);
    const [lastAddedItemId, setLastAddedItemId] = useState<number | null>(null);

    // ─── UI State ───
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
    const [sidebarMode, setSidebarMode] = useState<SidebarMode>('normal');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currency, setCurrency] = useState('$');
    const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);

    // ─── Session Setup & Persistence ───
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

        const sessionToRemove = sessions.find(s => s.id === id);
        if (sessionToRemove && sessionToRemove.cart.length > 0 && !isSuperAdmin) {
            toast.error("Security Rule: Cannot close a ticket with items. (Manager override required)");
            return;
        }

        setSessions(prev => {
            const next = prev.filter(s => s.id !== id);
            if (activeSessionId === id) setActiveSessionId(next[0].id);
            return next;
        });
        toast.info("Ticket closed");
    };

    // ─── Load Context ───
    useEffect(() => {
        getUser().then(user => {
            if (user && user.is_superuser) setIsSuperAdmin(true);
        });

        getContacts().then((data: any[]) => {
            if (Array.isArray(data) && data.length > 0) {
                const mapped = data.map(c => ({
                    id: c.id,
                    name: c.name || 'Unknown',
                    phone: c.phone || 'N/A',
                    balance: Number(c.wallet_balance || 0),
                    loyalty: Number(c.loyalty_points || 0),
                    address: c.address || 'N/A',
                    zone: 'A'
                }));
                // Keep Walk-in Customer as ID 1, map the rest
                setClients([
                    { id: 1, name: 'Walk-in Customer', phone: 'N/A', balance: 0, loyalty: 0, address: 'Counter Sales', zone: 'A' },
                    ...mapped.filter(c => c.id !== 1)
                ]);
            }
        }).catch(err => console.error("Failed to fetch CRM contacts:", err));

        getCommercialContext().then(ctx => {
            setCurrency(ctx.currency === 'USD' ? '$' : ctx.currency);
        });

        getCategories()
            .then((data: any[]) => {
                const cats = Array.isArray(data) ? data.slice(0, 50) : [];
                setCategories(cats);
            })
            .catch(() => setCategories([]))
            .finally(() => setCategoriesLoading(false));
    }, []);

    // ─── Cart Logic ───
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
            toast.info(`Updated piece: ${product.name}`, { duration: 1000, icon: '⚡' });
        } else {
            newCart = [{
                productId: product.id,
                name: product.name,
                price: basePrice,
                taxRate: taxRate,
                quantity: 1,
                isTaxIncluded: product.isTaxIncluded,
                sku: product.sku,
                barcode: product.barcode,
                stock: product.total_stock || product.stock || 0
            }, ...cart];
            toast.success(`New item: ${product.name}`, { duration: 1000 });
        }
        updateActiveSession({ cart: newCart });
        setHighlightedItemId(product.id);
        setLastAddedItemId(product.id);
        setTimeout(() => setHighlightedItemId(null), 500);
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
        setHighlightedItemId(productId);
        setLastAddedItemId(productId);
        setTimeout(() => setHighlightedItemId(null), 500);
    }, [cart, updateActiveSession]);

    const clearCart = useCallback(() => {
        const currentSession = sessions.find(s => s.id === activeSessionId);
        if (currentSession && currentSession.cart.length > 0 && !isSuperAdmin) {
            toast.error("Security Rule: Cannot clear ticket with items. (Manager override required)");
            return;
        }

        updateActiveSession({ cart: [] });
        toast.info("Ticket cleared");
    }, [updateActiveSession, sessions, activeSessionId, isSuperAdmin]);

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

    // ─── Payment State ───
    const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
    const [cashReceived, setCashReceived] = useState<string>('');
    const [storeChangeInWallet, setStoreChangeInWallet] = useState(false);
    const [pointsRedeemed, setPointsRedeemed] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);

    const total = cart.reduce((acc: number, item: any) => acc + (Number(item.price) * item.quantity), 0);
    const totalPieces = cart.reduce((acc: number, item: any) => acc + item.quantity, 0);
    const uniqueItems = cart.length;

    // Discount State
    const [discount, setDiscount] = useState(0);
    const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');

    // Calculate final total based on discount type
    const discountAmount = discountType === 'percentage'
        ? total * (discount / 100)
        : discount;
    const totalAmount = Math.max(0, total - discountAmount);

    // ─── Override & Receipt ───
    const [isOverrideOpen, setIsOverrideOpen] = useState(false);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [lastOrder, setLastOrder] = useState<{ id: number; ref: string } | null>(null);

    const handleCharge = useCallback(async () => {
        if (cart.length === 0 || isProcessing) return;
        setIsProcessing(true);
        try {
            const parsedCash = cashReceived ? parseFloat(cashReceived.replace(/\s/g, '')) : 0;
            const result = await processSale({
                cart,
                paymentMethod,
                totalAmount: totalAmount,
                scope: 'OFFICIAL',
                clientId: selectedClientId,
                storeChangeInWallet,
                pointsRedeemed,
                cashReceived: parsedCash
            });

            if (result.success) {
                toast.success(`Sale Processed: ${result.ref}`);
                clearCart();
                setCashReceived('');
                setStoreChangeInWallet(false);
                setPointsRedeemed(0);
                setDiscount(0);
            }
        } catch (error) {
            toast.error("Process Logic Failure.");
        } finally {
            setIsProcessing(false);
        }
    }, [cart, isProcessing, paymentMethod, totalAmount, clearCart, selectedClientId, storeChangeInWallet, pointsRedeemed, cashReceived]);

    // ─── Shared Props ───
    const layoutProps = {
        cart, clients, selectedClient, selectedClientId, categories,
        sessions, activeSessionId, currency, total, discount, discountType, totalAmount,
        totalPieces, uniqueItems, searchQuery, activeCategoryId, sidebarMode,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        isOverrideOpen, isReceiptOpen, lastOrder,
        storeChangeInWallet, pointsRedeemed, highlightedItemId, lastAddedItemId,

        onSetSearchQuery: setSearchQuery,
        onSetActiveCategoryId: setActiveCategoryId,
        onSetActiveSessionId: setActiveSessionId,
        onSetPaymentMethod: setPaymentMethod,
        onSetCashReceived: setCashReceived,
        onSetDiscount: setDiscount,
        onSetDiscountType: setDiscountType,
        onSetOverrideOpen: setIsOverrideOpen,
        onSetReceiptOpen: setIsReceiptOpen,
        onSetStoreChangeInWallet: setStoreChangeInWallet,
        onSetPointsRedeemed: setPointsRedeemed,
        onAddToCart: addToCart,
        onUpdateQuantity: updateQuantity,
        onClearCart: clearCart,
        onCreateNewSession: createNewSession,
        onRemoveSession: removeSession,
        onUpdateActiveSession: updateActiveSession,
        onToggleFullscreen: toggleFullscreen,
        onCycleSidebarMode: cycleSidebarMode,
        onCharge: handleCharge,

        currentLayout,
        onOpenLayoutSelector: () => setIsLayoutSelectorOpen(true),
    };

    // ─── Render Layout ───
    return (
        <>
            {currentLayout === 'classic' && <POSLayoutClassic {...layoutProps} />}
            {currentLayout === 'modern' && <POSLayoutModern {...layoutProps} />}
            {currentLayout === 'compact' && <POSLayoutCompact {...layoutProps} />}

            <POSLayoutSelector
                isOpen={isLayoutSelectorOpen}
                currentLayout={currentLayout}
                onSelect={handleLayoutChange}
                onClose={() => setIsLayoutSelectorOpen(false)}
            />
        </>
    );
}