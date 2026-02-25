'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { CartItem } from '@/types/pos';
import { POSLayoutVariant } from '@/types/pos-layout';
import { POSLayoutClassic } from '@/components/pos/layouts/POSLayoutClassic';
import { POSLayoutModern } from '@/components/pos/layouts/POSLayoutModern';
import { POSLayoutCompact } from '@/components/pos/layouts/POSLayoutCompact';
import { POSLayoutSelector } from '@/components/pos/layouts/POSLayoutSelector';
import { getCategories, processSale, getDeliveryZones } from './actions';
import { getCommercialContext } from '@/app/actions/commercial';
import { getUser } from '@/app/actions/auth';
import { getContacts } from '@/app/actions/crm/contacts';
import { erpFetch } from "@/lib/erp-api";

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
        { id: 1, name: 'Walk-in Customer', phone: 'N/A', balance: 0, loyalty: 0, address: 'Counter Sales', zone: '' }
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
    const [currentParentId, setCurrentParentId] = useState<number | null>(null);
    const [sidebarMode, setSidebarMode] = useState<SidebarMode>('normal');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currency, setCurrency] = useState('$');
    const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(true);
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
    const [deliveryZone, setDeliveryZone] = useState('');
    const [paymentMethods, setPaymentMethods] = useState<any[]>([
        { key: 'CASH', label: 'Cash', accountId: null },
        { key: 'CARD', label: 'Card', accountId: null },
        { key: 'WALLET', label: 'Wallet', accountId: null },
        { key: 'WAVE', label: 'Wave', accountId: null },
        { key: 'OM', label: 'OM', accountId: null },
        { key: 'MULTI', label: 'Multi', accountId: null },
        { key: 'DELIVERY', label: 'Delivery', accountId: null },
    ]);

    // ─── Session Setup & Persistence ───
    useEffect(() => {
        const saved = localStorage.getItem('pos_sessions');
        let initialSessions = [];
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.length > 0) {
                    initialSessions = parsed;
                }
            } catch (e) { console.error(e); }
        }

        if (initialSessions.length === 0) {
            const initialId = Date.now().toString();
            initialSessions = [{ id: initialId, clientId: 1, cart: [], name: 'Ticket 1' }];
        }

        setSessions(initialSessions);
        setActiveSessionId(initialSessions[0].id);

        // Fetch cloud backup for redundancy
        erpFetch('pos-tickets/').then((cloudTickets: any) => {
            if (Array.isArray(cloudTickets) && cloudTickets.length > 0) {
                const mapped = cloudTickets.map((ct: any) => ({
                    id: ct.ticket_id,
                    name: ct.name,
                    clientId: ct.client_id || 1,
                    cart: ct.cart_data || []
                }));

                setSessions(prev => {
                    const merged = [...prev];
                    mapped.forEach(ct => {
                        if (!merged.find(m => m.id === ct.id)) {
                            merged.push(ct);
                        }
                    });
                    return merged;
                });
            }
        }).catch(e => console.warn("[POS] Cloud Restore Failed:", e));
    }, []);

    useEffect(() => {
        if (sessions.length > 0) {
            localStorage.setItem('pos_sessions', JSON.stringify(sessions));
        }

        // Debounced Cloud Sync
        const timer = setTimeout(() => {
            if (sessions.length > 0) {
                erpFetch('pos-tickets/sync-all/', {
                    method: 'POST',
                    body: JSON.stringify({
                        tickets: sessions.map(s => ({
                            ticket_id: s.id,
                            name: s.name,
                            client_id: s.clientId,
                            cart_data: s.cart
                        }))
                    })
                }).catch(e => console.warn("[POS] Cloud Sync Failed:", e));
            }
        }, 2000);
        return () => clearTimeout(timer);
    }, [sessions]);

    const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || { cart: [], clientId: 1 };
    const cart = activeSession.cart;
    const selectedClientId = activeSession.clientId;
    const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0] || { name: 'Walk-in' };

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
                    zone: c.delivery_zone || ''
                }));
                // Keep Walk-in Customer as ID 1, map the rest
                setClients(prev => [
                    prev[0], // Keep Walk-in
                    ...mapped.filter(c => c.id !== 1)
                ]);
            }
        }).catch(err => console.error("Failed to fetch CRM contacts:", err));

        getCommercialContext().then(ctx => {
            setCurrency(ctx.currency === 'USD' ? '$' : ctx.currency);
            if (ctx.posPaymentMethods && Array.isArray(ctx.posPaymentMethods) && ctx.posPaymentMethods.length > 0) {
                // Normalize: support both string[] and object[] from settings
                const normalized = ctx.posPaymentMethods.map((m: any) => {
                    if (typeof m === 'string') return { key: m, label: m, accountId: null };
                    return { key: m.key, label: m.label || m.key, accountId: m.accountId || null };
                });
                setPaymentMethods(normalized);
            }
        });

        getCategories()
            .then((data: any) => {
                const cats = Array.isArray(data)
                    ? data
                    : (data?.results && Array.isArray(data.results) ? data.results : []);
                setCategories(cats.slice(0, 500));
            })
            .catch(() => setCategories([]))
            .finally(() => setCategoriesLoading(false));

        getDeliveryZones().then(zones => {
            setDeliveryZones(zones);
            if (zones.length > 0) {
                setDeliveryZone(zones[0].name);
            }
        });
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
            // Update in-place — don't reorder to top
            newCart = cart.map((item: any, i: number) =>
                i === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
            );
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
        setLastAddedItemId(null);
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

    const updatePrice = useCallback((productId: number, price: number) => {
        const newCart = cart.map((item: any) => {
            if (item.productId === productId) {
                return { ...item, price: price };
            }
            return item;
        });
        updateActiveSession({ cart: newCart });
        setHighlightedItemId(productId);
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

    const handleSync = useCallback(async () => {
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1500)),
            {
                loading: 'Synchronizing with Central Server...',
                success: 'All data synchronized successfully!',
                error: 'Synchronization failed. Check connection.'
            }
        );
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
            // Look up the linked account for the selected payment method
            const methodConfig = paymentMethods.find((m: any) => (m.key || m) === paymentMethod);
            const linkedAccountId = methodConfig?.accountId || undefined;
            const result = await processSale({
                cart,
                paymentMethod,
                totalAmount: totalAmount,
                scope: 'OFFICIAL',
                clientId: selectedClientId,
                storeChangeInWallet,
                pointsRedeemed,
                cashReceived: parsedCash,
                paymentAccountId: linkedAccountId
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
        totalPieces, uniqueItems, searchQuery, activeCategoryId, currentParentId, sidebarMode,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        isOverrideOpen, isReceiptOpen, lastOrder,
        storeChangeInWallet, pointsRedeemed, highlightedItemId, lastAddedItemId,
        isOnline, clientSearchQuery, deliveryZone, deliveryZones,
        paymentMethods,

        onSetSearchQuery: setSearchQuery,
        onSetActiveCategoryId: setActiveCategoryId,
        onSetCurrentParentId: setCurrentParentId,
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
        onUpdatePrice: updatePrice,
        onClearCart: clearCart,
        onCreateNewSession: createNewSession,
        onRemoveSession: removeSession,
        onUpdateActiveSession: updateActiveSession,
        onToggleFullscreen: toggleFullscreen,
        onCycleSidebarMode: cycleSidebarMode,
        onCharge: handleCharge,
        onSync: handleSync,
        onSetIsOnline: setIsOnline,
        onSetClientSearchQuery: setClientSearchQuery,
        onSetDeliveryZone: setDeliveryZone,

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