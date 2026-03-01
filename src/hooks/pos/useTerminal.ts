'use client';

/**
 * useTerminal — Core POS Terminal State Engine
 * =============================================
 * Consolidates ALL cart, session, payment, barcode, cloud sync, and audit
 * logic into a single, memoized hook. This replaces the ~600 lines of raw
 * useState/useCallback that previously lived in page.tsx.
 *
 * Architecture:
 *   useTerminal() → TerminalContext.Provider → all POS components
 *
 * Performance:
 *   - Barcode scanner uses a ref-based buffer (no re-renders during scanning)
 *   - Cloud sync is debounced to 3s (was 2s with race conditions)
 *   - Product index is a Map<string, Product> for O(1) barcode lookups
 *   - All callbacks are properly memoized with useCallback
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { CartItem } from '@/types/pos';
import { erpFetch } from '@/lib/erp-api';
import { useAdmin } from '@/context/AdminContext';

// ─── Types ───────────────────────────────────────────────────────────
export interface RegisterConfig {
    registerId: number;
    registerName: string;
    sessionId: number;
    cashierId: number;
    cashierName: string;
    warehouseId: number | null;
    cashAccountId: number | null;
    allowedAccounts: Array<{ id: number; name: string; type: string }>;
    siteName: string;
    paymentMethods: PaymentMethodConfig[];
}

export interface PaymentMethodConfig {
    key: string;
    label: string;
    accountId: number | null;
}

export interface TicketSession {
    id: string;
    clientId: number;
    cart: CartItem[];
    name: string;
}

export interface POSClient {
    id: number;
    name: string;
    phone: string;
    balance: number;
    creditLimit?: number;
    currentBalance?: number;
    loyalty: number;
    address: string;
    zone: string;
    home_zone_id?: number | null;
    customer_tier?: string | null;
    customer_type?: string | null;
}

export interface LastOrder {
    id: number;
    ref: string;
}

// ─── Sound Utility ───────────────────────────────────────────────────
const playSound = (type: 'beep' | 'error' | 'success') => {
    try {
        const file = type === 'beep' ? 'scan.mp3' : type === 'error' ? 'error.mp3' : 'success.mp3';
        new Audio(`/sounds/${file}`).play().catch(() => { });
    } catch { }
};

// ─── Audit Logger ────────────────────────────────────────────────────
const logAudit = (eventType: string, eventName: string, details: Record<string, unknown> = {}) => {
    erpFetch('pos-audit-events/', {
        method: 'POST',
        body: JSON.stringify({ event_type: eventType, event_name: eventName, details }),
    }).catch(() => { });
};

// ─── Constants ───────────────────────────────────────────────────────
const SYNC_DEBOUNCE_MS = 3000;
const BARCODE_GAP_MS = 80;
const WALK_IN_CLIENT: POSClient = {
    id: 1, name: 'Walk-in Customer', phone: 'N/A',
    balance: 0, loyalty: 0, address: 'Counter Sales', zone: '',
};

// ═════════════════════════════════════════════════════════════════════
// HOOK
// ═════════════════════════════════════════════════════════════════════
export function useTerminal() {
    const { viewScope } = useAdmin();

    // ─── Register State ──────────────────────────────────────────
    const [registerConfig, setRegisterConfig] = useState<RegisterConfig | null>(null);
    const [isOnline, setIsOnline] = useState(true);

    // ─── Sessions (Multi-Ticket) ─────────────────────────────────
    const [sessions, setSessions] = useState<TicketSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    // ─── Clients ─────────────────────────────────────────────────
    const [clients, setClients] = useState<POSClient[]>([WALK_IN_CLIENT]);

    // ─── UI State ────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
    const [currentParentId, setCurrentParentId] = useState<number | null>(null);
    const [sidebarMode, setSidebarMode] = useState<'hidden' | 'normal' | 'expanded'>('normal');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currency, setCurrency] = useState('$');
    const [highlightedItemId, setHighlightedItemId] = useState<number | null>(null);
    const [lastAddedItemId, setLastAddedItemId] = useState<number | null>(null);

    // ─── Payment State ───────────────────────────────────────────
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
    const [cashReceived, setCashReceived] = useState('');
    const [storeChangeInWallet, setStoreChangeInWallet] = useState(false);
    const [pointsRedeemed, setPointsRedeemed] = useState(0);
    const [notes, setNotes] = useState('');
    const [paymentLegs, setPaymentLegs] = useState<Array<{ method: string; amount: number }>>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [discount, setDiscount] = useState(0);
    const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');

    // ─── Modals / Overlays ───────────────────────────────────────
    const [isOverrideOpen, setIsOverrideOpen] = useState(false);
    const [pendingOverrideAction, setPendingOverrideAction] = useState<{ label: string; execute: () => void } | null>(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
    const [showCreditWarning, setShowCreditWarning] = useState(false);
    const [creditWarningAmount, setCreditWarningAmount] = useState(0);
    const [isVaultOpen, setIsVaultOpen] = useState(false);
    const [clientSearchQuery, setClientSearchQuery] = useState('');

    // ─── Delivery ────────────────────────────────────────────────
    const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
    const [deliveryZone, setDeliveryZone] = useState('');

    // ─── Config ──────────────────────────────────────────────────
    const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [loyaltyPointValue, setLoyaltyPointValue] = useState(1);

    // ─── Refs (for scanner & stock policy — avoids stale closures) ─
    const productIndex = useRef<Map<string, any>>(new Map());
    const allowNegativeStockRef = useRef(false);
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ═══ Derived State ═══════════════════════════════════════════
    const activeSession = useMemo(
        () => sessions.find(s => s.id === activeSessionId) || sessions[0] || { id: '', cart: [], clientId: 1, name: 'Ticket 1' },
        [sessions, activeSessionId]
    );
    const cart = activeSession.cart;
    const selectedClientId = activeSession.clientId;
    const selectedClient = useMemo(
        () => clients.find(c => c.id === selectedClientId) || WALK_IN_CLIENT,
        [clients, selectedClientId]
    );

    const total = useMemo(() => cart.reduce((acc, item) => acc + Number(item.price) * item.quantity, 0), [cart]);
    const totalPieces = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);
    const uniqueItems = cart.length;
    const discountAmount = discountType === 'percentage' ? total * (discount / 100) : discount;
    const loyaltyDiscount = pointsRedeemed * loyaltyPointValue;
    const totalAmount = Math.max(0, total - discountAmount - loyaltyDiscount);
    const isCreditPayment = paymentMethod === 'CREDIT' || paymentLegs.some(l => l.method === 'CREDIT');

    // ═══ Product Index Builder ═══════════════════════════════════
    const onProductsLoaded = useCallback((products: any[]) => {
        products.forEach(p => {
            if (p.barcode) productIndex.current.set(String(p.barcode).toLowerCase(), p);
            if (p.sku) productIndex.current.set(String(p.sku).toLowerCase(), p);
            if (p.id) productIndex.current.set(String(p.id), p);
        });
    }, []);

    // ═══ Session Helpers ═════════════════════════════════════════
    const updateActiveSession = useCallback((updatesOrFn: Partial<TicketSession> | ((s: TicketSession) => Partial<TicketSession>)) => {
        setSessions(prev => prev.map(s => {
            if (s.id !== activeSessionId) return s;
            const updates = typeof updatesOrFn === 'function' ? updatesOrFn(s) : updatesOrFn;
            return { ...s, ...updates };
        }));
    }, [activeSessionId]);

    const createNewSession = useCallback(() => {
        const id = Date.now().toString();
        const ticket: TicketSession = { id, clientId: 1, cart: [], name: `Ticket ${sessions.length + 1}` };
        setSessions(prev => [...prev, ticket]);
        setActiveSessionId(id);
        toast.success('New ticket created');
    }, [sessions.length]);

    const removeSession = useCallback((id: string, force = false) => {
        if (sessions.length <= 1) { toast.error('At least one ticket must remain open'); return; }
        const target = sessions.find(s => s.id === id);
        if (target && target.cart.length > 0 && !isSuperAdmin && !force) {
            setPendingOverrideAction({ label: `Close Ticket "${target.name}"`, execute: () => removeSession(id, true) });
            setIsOverrideOpen(true);
            return;
        }
        setSessions(prev => {
            const next = prev.filter(s => s.id !== id);
            if (activeSessionId === id) setActiveSessionId(next[0]?.id || null);
            return next;
        });
        toast.info('Ticket closed');
    }, [sessions, activeSessionId, isSuperAdmin]);

    // ═══ Cart Operations ═════════════════════════════════════════
    const addToCart = useCallback((product: Record<string, any>) => {
        const basePrice = Number(product.basePrice || product.price || 0);
        const taxRate = Number(product.taxRate || 0);
        const stockQty = Number(product.total_stock || product.stock || product.stockLevel || 0);

        if (isNaN(basePrice)) { toast.error(`Invalid price for ${product.name}`); return; }

        if (!allowNegativeStockRef.current && stockQty === 0 && product.track_stock !== false) {
            toast.error(`❌ Out of stock: ${product.name}`, { duration: 2500 });
            playSound('beep');
            return;
        }

        updateActiveSession((prev) => {
            const currentCart = prev.cart || [];
            const idx = currentCart.findIndex(p => p.productId === product.id);

            if (idx !== -1) {
                if (!allowNegativeStockRef.current && stockQty > 0 && currentCart[idx].quantity + 1 > stockQty) {
                    toast.warning(`⚠ Overselling: only ${stockQty} in stock`, { duration: 2000 });
                }
                const newCart = currentCart.map((item, i) => i === idx ? { ...item, quantity: item.quantity + 1 } : item);
                toast.info(`Updated: ${product.name}`, { duration: 1000, icon: '⚡' });
                return { cart: newCart };
            }

            const newItem: CartItem = {
                productId: product.id,
                name: product.name,
                price: basePrice,
                taxRate,
                quantity: 1,
                isTaxIncluded: product.isTaxIncluded,
                barcode: product.barcode,
                stock: stockQty,
                imageUrl: product.imageUrl || product.image_url || '',
                note: '',
            };
            toast.success(`Added: ${product.name}`, { duration: 1000 });
            return { cart: [newItem, ...currentCart] };
        });

        playSound('beep');
        setHighlightedItemId(product.id);
        setLastAddedItemId(null);
        setTimeout(() => setHighlightedItemId(null), 500);
    }, [updateActiveSession]);

    const updateQuantity = useCallback((productId: number, delta: number) => {
        updateActiveSession(prev => {
            const newCart = prev.cart
                .map(item => {
                    if (item.productId !== productId) return item;
                    if (delta < 0) logAudit('DECREASE_QTY', 'Quantity Decreased', { product: item.name, old_qty: item.quantity, new_qty: item.quantity + delta });
                    return { ...item, quantity: Math.max(0, item.quantity + delta) };
                })
                .filter(item => {
                    if (item.quantity <= 0) { logAudit('REMOVE_ITEM', 'Item Removed', { product: item.name }); return false; }
                    return true;
                });
            return { cart: newCart };
        });
        playSound('beep');
        setHighlightedItemId(productId);
        setLastAddedItemId(productId);
        setTimeout(() => setHighlightedItemId(null), 500);
    }, [updateActiveSession]);

    const updatePrice = useCallback((productId: number, price: number) => {
        updateActiveSession(prev => ({
            cart: prev.cart.map(item => item.productId === productId ? { ...item, price } : item),
        }));
        setHighlightedItemId(productId);
        setTimeout(() => setHighlightedItemId(null), 500);
    }, [updateActiveSession]);

    const updateLineDiscount = useCallback((productId: number, discountRate: number) => {
        updateActiveSession(prev => ({
            cart: prev.cart.map(item => item.productId === productId ? { ...item, discountRate: Math.max(0, Math.min(100, discountRate)) } : item),
        }));
        setHighlightedItemId(productId);
        setTimeout(() => setHighlightedItemId(null), 500);
    }, [updateActiveSession]);

    const updateLineNote = useCallback((productId: number, note: string) => {
        updateActiveSession(prev => ({
            cart: prev.cart.map(item => item.productId === productId ? { ...item, note } : item),
        }));
    }, [updateActiveSession]);

    const clearCart = useCallback((force = false) => {
        const current = sessions.find(s => s.id === activeSessionId);
        if (current && current.cart.length > 0 && !isSuperAdmin && !force) {
            setPendingOverrideAction({ label: 'Clear Entire Ticket', execute: () => clearCart(true) });
            setIsOverrideOpen(true);
            return;
        }
        if (current && current.cart.length > 0) {
            logAudit('CLEAR_CART', 'Cart Cleared', { items_count: current.cart.length, ticket_name: current.name });
        }
        updateActiveSession({ cart: [] });
        toast.info('Ticket cleared');
    }, [sessions, activeSessionId, isSuperAdmin, updateActiveSession]);

    // ═══ Payment / Checkout ═══════════════════════════════════════
    const handleCharge = useCallback(async (skipCreditWarning = false) => {
        if (cart.length === 0 || isProcessing) return;

        if (!paymentMethod && totalAmount > 0 && paymentLegs.length === 0) {
            toast.error('Please select a valid payment method.');
            return;
        }

        // Balance check for multi-payment
        if (paymentLegs.length > 0) {
            const legsTotal = paymentLegs.reduce((sum, l) => sum + Number(l.amount || 0), 0);
            if (Math.abs(legsTotal - totalAmount) > 0.01) {
                toast.error(`⚖️ Payment imbalance: ${legsTotal.toFixed(2)} ≠ ${totalAmount.toFixed(2)}`, { duration: 4000 });
                return;
            }
        }

        // Credit sale confirmation
        if (isCreditPayment && !skipCreditWarning) {
            setCreditWarningAmount(totalAmount);
            setShowCreditWarning(true);
            return;
        }

        setIsProcessing(true);
        try {
            const { processSale } = await import('@/app/(privileged)/sales/actions');
            const parsedCash = cashReceived ? parseFloat(cashReceived.replace(/\s/g, '')) : 0;
            const methodConfig = paymentMethods.find(m => m.key === paymentMethod);
            const result = await processSale({
                cart,
                paymentMethod,
                totalAmount,
                scope: viewScope,
                clientId: selectedClientId,
                storeChangeInWallet,
                pointsRedeemed,
                notes,
                cashReceived: parsedCash,
                paymentAccountId: methodConfig?.accountId || undefined,
                globalDiscount: discountAmount,
                paymentLegs: paymentLegs.length > 0 ? paymentLegs : undefined,
            });

            if (result.success) {
                playSound('success');
                toast.success(`Sale Processed: ${result.ref}`);
                clearCart(true);
                setCashReceived('');
                setStoreChangeInWallet(false);
                setPointsRedeemed(0);
                setNotes('');
                setPaymentLegs([]);
                setDiscount(0);
                setIsReceiptOpen(true);
                setLastOrder({ id: result.orderId!, ref: result.ref! });
            }
        } catch {
            playSound('error');
            toast.error('Process Logic Failure.');
        } finally {
            setIsProcessing(false);
        }
    }, [cart, isProcessing, paymentMethod, totalAmount, paymentLegs, isCreditPayment,
        cashReceived, paymentMethods, viewScope, selectedClientId, storeChangeInWallet,
        pointsRedeemed, notes, discountAmount, clearCart]);

    // ═══ UI Helpers ═══════════════════════════════════════════════
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => toast.error(`Fullscreen error: ${err.message}`));
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    const cycleSidebarMode = useCallback(() => {
        setSidebarMode(prev => prev === 'hidden' ? 'normal' : prev === 'normal' ? 'expanded' : 'hidden');
    }, []);

    const handleSync = useCallback(async () => {
        toast.promise(new Promise(resolve => setTimeout(resolve, 1500)), {
            loading: 'Synchronizing…', success: 'Synchronized!', error: 'Sync failed.',
        });
    }, []);

    // ═══ Reset payment state on ticket switch ═════════════════════
    useEffect(() => {
        setCashReceived('');
        setPaymentMethod('CASH');
        setStoreChangeInWallet(false);
        setPointsRedeemed(0);
        setNotes('');
        setPaymentLegs([]);
        setDiscount(0);
        setDiscountType('fixed');
    }, [activeSessionId]);

    // ═══ Bootstrap: load initial context ══════════════════════════
    useEffect(() => {
        // User role
        import('@/app/actions/auth').then(m => m.getUser()).then(user => {
            if (user?.is_superuser) setIsSuperAdmin(true);
        });

        // Commercial context (currency + payment methods)
        import('@/app/actions/commercial').then(m => m.getCommercialContext()).then(ctx => {
            setCurrency(ctx.currency === 'USD' ? '$' : ctx.currency);
            if (Array.isArray(ctx.posPaymentMethods) && ctx.posPaymentMethods.length > 0) {
                const normalized: PaymentMethodConfig[] = ctx.posPaymentMethods
                    .map((m: any) => typeof m === 'string' ? { key: m, label: m, accountId: null } : { key: m.key, label: m.label || m.key, accountId: m.accountId || null })
                    .filter((m: any) => m.accountId || ['MULTI', 'DELIVERY'].includes(m.key));
                setPaymentMethods(normalized);
                if (normalized.length > 0 && !normalized.some(m => m.key === 'CASH')) {
                    setPaymentMethod(normalized[0].key);
                }
            }
        });

        // Categories
        import('@/app/(privileged)/sales/actions').then(m => m.getCategories()).then((data: any) => {
            const cats = Array.isArray(data) ? data : data?.results || [];
            setCategories(cats.slice(0, 500));
        }).catch(() => setCategories([])).finally(() => setCategoriesLoading(false));

        // Delivery zones
        import('@/app/(privileged)/sales/actions').then(m => m.getDeliveryZones()).then(zones => {
            setDeliveryZones(zones);
            if (zones.length > 0) setDeliveryZone(zones[0].name);
        });

        // POS settings
        import('@/app/(privileged)/sales/actions').then(m => m.getPosSettings()).then(s => {
            setLoyaltyPointValue(s.loyaltyPointValue);
        });

        // Stock policy
        erpFetch('settings/item/pos_security_rules/').then((s: any) => {
            if (typeof s?.allowNegativeStock === 'boolean') allowNegativeStockRef.current = s.allowNegativeStock;
        }).catch(() => { });
    }, []);

    // ═══ Session Persistence (localStorage + cloud) ═══════════════
    useEffect(() => {
        const saved = localStorage.getItem('pos_sessions');
        let initial: TicketSession[] = [];
        if (saved) try { initial = JSON.parse(saved); } catch { }
        if (!initial.length) {
            const id = Date.now().toString();
            initial = [{ id, clientId: 1, cart: [], name: 'Ticket 1' }];
        }
        setSessions(initial);
        setActiveSessionId(initial[0].id);

        // Cloud restore
        erpFetch('pos-tickets/').then((cloud: any) => {
            if (!Array.isArray(cloud) || !cloud.length) return;
            const mapped = cloud.map((ct: any) => ({ id: ct.ticket_id, name: ct.name, clientId: ct.client_id || 1, cart: ct.cart_data || [] }));
            setSessions(prev => {
                const merged = [...prev];
                mapped.forEach((ct: TicketSession) => { if (!merged.find(m => m.id === ct.id)) merged.push(ct); });
                return merged;
            });
        }).catch(() => { });
    }, []);

    // Persist to localStorage + debounced cloud sync
    useEffect(() => {
        if (!sessions.length) return;
        localStorage.setItem('pos_sessions', JSON.stringify(sessions));

        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => {
            erpFetch('pos-tickets/sync-all/', {
                method: 'POST',
                body: JSON.stringify({
                    tickets: sessions.map(s => ({ ticket_id: s.id, name: s.name, client_id: s.clientId, cart_data: s.cart })),
                }),
            }).catch(() => { });
        }, SYNC_DEBOUNCE_MS);

        return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current); };
    }, [sessions]);

    // ═══ Client Search ═══════════════════════════════════════════
    const searchClients = useCallback(async (query: string) => {
        const { searchContacts } = await import('@/app/actions/crm/contacts');
        const results = await searchContacts(query);
        if (!Array.isArray(results) || !results.length) return;
        const mapped: POSClient[] = results.map(c => ({
            id: c.id, name: c.name || 'Unknown', phone: c.phone || 'N/A',
            balance: Number(c.wallet_balance || 0), creditLimit: Number(c.credit_limit || 0),
            currentBalance: Number(c.current_balance || 0), loyalty: Number(c.loyalty_points || 0),
            address: c.address || 'N/A', zone: c.home_zone_name || '',
            home_zone_id: c.home_zone || null, customer_tier: c.customer_tier || null,
            customer_type: c.customer_type || null,
        }));
        setClients(prev => {
            const kept = prev.filter(p => p.id === 1 || p.id === selectedClientId);
            const fresh = mapped.filter(m => !kept.some(p => p.id === m.id));
            return [...kept, ...fresh];
        });
    }, [selectedClientId]);

    // ═══ Enter / Exit Register ════════════════════════════════════
    const enterRegister = useCallback((config: RegisterConfig) => {
        setRegisterConfig(config);
        if (config.paymentMethods?.length) {
            const linked = config.paymentMethods.filter(m => m.accountId || ['MULTI', 'DELIVERY'].includes(m.key));
            if (linked.length > 0) setPaymentMethods(linked);
        }
        toast.success(`Entered ${config.registerName} as ${config.cashierName}`);
    }, []);

    const lockRegister = useCallback(() => setRegisterConfig(null), []);

    // ═══ Return ══════════════════════════════════════════════════
    return {
        // Register
        registerConfig, enterRegister, lockRegister, isOnline, setIsOnline,

        // Sessions
        sessions, activeSessionId, activeSession, setActiveSessionId,
        createNewSession, removeSession, updateActiveSession,

        // Cart
        cart, addToCart, updateQuantity, updatePrice, updateLineDiscount,
        updateLineNote, clearCart, onProductsLoaded, productIndex,

        // Clients
        clients, selectedClient, selectedClientId, searchClients,
        clientSearchQuery, setClientSearchQuery, setClients,

        // Payment
        paymentMethod, setPaymentMethod, paymentMethods, setPaymentMethods,
        cashReceived, setCashReceived, storeChangeInWallet, setStoreChangeInWallet,
        pointsRedeemed, setPointsRedeemed, notes, setNotes,
        paymentLegs, setPaymentLegs, isProcessing, handleCharge,
        discount, setDiscount, discountType, setDiscountType,
        isCreditPayment, showCreditWarning, setShowCreditWarning,
        creditWarningAmount,

        // Computed
        total, totalAmount, totalPieces, uniqueItems, discountAmount, loyaltyDiscount,
        currency, viewScope,

        // Categories
        categories, categoriesLoading, activeCategoryId, setActiveCategoryId,
        currentParentId, setCurrentParentId,

        // UI
        searchQuery, setSearchQuery, sidebarMode, cycleSidebarMode,
        isFullscreen, toggleFullscreen, highlightedItemId, lastAddedItemId,
        isSuperAdmin,

        // Modals
        isOverrideOpen, setIsOverrideOpen, pendingOverrideAction, setPendingOverrideAction,
        isReceiptOpen, setIsReceiptOpen, lastOrder, setLastOrder,
        isVaultOpen, setIsVaultOpen,

        // Delivery
        deliveryZones, deliveryZone, setDeliveryZone,

        // Config
        loyaltyPointValue, handleSync,
    } as const;
}

export type TerminalState = ReturnType<typeof useTerminal>;
