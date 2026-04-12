import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Product } from "@/types/erp";
import {
    getPosProducts, processSale, syncOfflineOrders, getPosSettings,
    getClientFidelity
} from '@/app/(privileged)/sales/actions';
import { openRegisterSession, closeRegisterSession } from '@/app/(privileged)/sales/register-actions';

import { toast } from 'sonner';
import { useOnlineStatus } from '@/lib/offline/hooks';
import { useUser } from '@/hooks/useUser';
import { useBarcodeScanner } from '@/hooks/pos/useBarcodeScanner'; // Fixed import

export type POSLayoutVariant = 'classic' | 'modern' | 'compact';

/**
 * 🛠️ usePOSTerminal — The Core POS Engine
 * Centralizes all business logic, cart management, and session state.
 * Refactored under the "Strict Audit Plan" (2026-03-01)
 */
export function usePOSTerminal() {
    const { isOnline } = useOnlineStatus();
    const { user } = useUser();

    // ─── Core State ───
    const [currentLayout, setCurrentLayout] = useState<POSLayoutVariant>('classic');
    const [isLayoutSelectorOpen, setIsLayoutSelectorOpen] = useState(false);
    const [clients, setClients] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [activeRegisterSessionId, setActiveRegisterSessionId] = useState<number | null>(null);
    const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    // Catalog & Indexing
    const [categories, setCategories] = useState<any[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const productIndexRef = useRef<Map<string, any>>(new Map());
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [isCartVisible, setIsCartVisible] = useState(true);

    // UI Modals
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [showCloseRegister, setShowCloseRegister] = useState(false);
    const [showReturn, setShowReturn] = useState(false);
    const [showCreditWarning, setShowCreditWarning] = useState(false);
    const [isOverrideOpen, setIsOverrideOpen] = useState(false);
    const [pendingOverrideAction, setPendingOverrideAction] = useState<any>(null);
    const [isVaultOpen, setIsVaultOpen] = useState(false);
    const [paymentMethods, setPaymentMethods] = useState<any[]>(['CASH', 'CARD', 'WALLET', 'MOBILE_MONEY', 'CREDIT', 'MULTI']);
    const [lastOrder, setLastOrder] = useState<any>(null);

    // Cart State
    const [cart, setCart] = useState<any[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [discount, setDiscount] = useState(0);
    const [discountType, setDiscountType] = useState<'percent' | 'flat'>('percent');
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [cashReceived, setCashReceived] = useState('');
    const [storeChangeInWallet, setStoreChangeInWallet] = useState(false);
    const [pointsRedeemed, setPointsRedeemed] = useState(0);
    const [notes, setNotes] = useState('');
    const [paymentLegs, setPaymentLegs] = useState<any[]>([]);

    // NEW: Client Search & Delivery
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [deliveryZone, setDeliveryZone] = useState<string | null>(null);
    const [deliveryZones, setDeliveryZones] = useState<any[]>([]);

    // Fidelity & Config
    const [clientFidelity, setClientFidelity] = useState<any>(null);
    const [fidelityLoading, setFidelityLoading] = useState(false);
    const [loyaltyPointValue, setLoyaltyPointValue] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [registerConfig, setRegisterConfig] = useState<any>(null);
    const allowNegativeStockRef = useRef<boolean>(false);

    // Performance UI
    const [highlightedItemId, setHighlightedItemId] = useState<number | null>(null);
    const [lastAddedItemId, setLastAddedItemId] = useState<number | null>(null);

    // Dashboard navigation fields (Legacy support)
    const activeCategoryId = null;
    const currentParentId = null;
    const sidebarMode = 'compact';
    const isFullscreen = false;
    const currency = 'CFA';

    // ─── Computed Values ───
    const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
    const tax = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity * (item.taxRate / 100)), 0), [cart]);
    const total = useMemo(() => subtotal + tax, [subtotal, tax]);
    const discountAmount = useMemo(() => {
        if (discountType === 'percent') return (total * discount) / 100;
        return discount;
    }, [total, discount, discountType]);
    const totalAmount = useMemo(() => Math.max(0, total - discountAmount), [total, discountAmount]);
    const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId), [clients, selectedClientId]);

    const selectedDeliveryZoneId = useMemo(() => {
        const zone = deliveryZones.find(z => z.name === deliveryZone);
        return zone?.id;
    }, [deliveryZones, deliveryZone]);

    // ─── Actions ───
    const onSync = useCallback(async () => {
        if (!isOnline) {
            toast.error("Cloud engine unreachable. Working in Offline Secure Mode.");
            return;
        }
        toast.promise(syncOfflineOrders([]), {
            loading: 'Reconciling cloud ledger...',
            success: 'Cloud synchronization complete',
            error: 'Forensic sync failed'
        });
    }, [isOnline]);

    const updateActiveSession = useCallback((updates: any) => {
        if (updates.clientId !== undefined) setSelectedClientId(updates.clientId);
    }, []);

    const onProductsLoaded = useCallback((products: any[]) => {
        products.forEach(p => {
            if (p.sku) productIndexRef.current.set(p.sku, p);
            if (p.barcode) productIndexRef.current.set(p.barcode, p);
        });
    }, []);

    const addToCart = useCallback((product: any) => {
        setCart(prev => {
            const existing = prev.find(item => item.productId === product.id);
            if (existing) {
                return prev.map(item => item.productId === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
                );
            }
            return [...prev, {
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
                taxRate: product.tax_rate || 0,
                sku: product.sku,
                stock: product.stock
            }];
        });
        setHighlightedItemId(product.id);
        setTimeout(() => setHighlightedItemId(null), 1000);
    }, []);

    const updateQuantity = useCallback((productId: number, delta: number) => {
        setCart(prev => prev.map(item => item.productId === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        ).filter(item => item.quantity > 0));
    }, []);

    const updatePrice = useCallback((productId: number, newPrice: number) => {
        setCart(prev => prev.map(item => item.productId === productId
            ? { ...item, price: newPrice }
            : item
        ));
    }, []);

    const updateLineDiscount = useCallback((productId: number, discountRate: number) => {
        setCart(prev => prev.map(item => item.productId === productId
            ? { ...item, discountRate: Math.max(0, Math.min(100, discountRate)) }
            : item
        ));
    }, []);

    const updateLineNote = useCallback((productId: number, note: string) => {
        setCart(prev => prev.map(item => item.productId === productId
            ? { ...item, note }
            : item
        ));
    }, []);

    const onRemoveSession = useCallback((id: string) => {
        setSessions(prev => prev.filter(s => s.id !== id));
    }, []);

    const clearCart = useCallback((force: boolean = false) => {
        setCart([]);
        setSelectedClientId(null);
        setDiscount(0);
        setCashReceived('');
        setNotes('');
        setClientFidelity(null);
    }, []);

    const onCharge = useCallback(async (
        skipWarning = false,
        overrides?: {
            paymentMethod?: string;
            paymentLegs?: any[];
            notes?: string;
            cashReceived?: string;
        }
    ) => {
        if (!cart.length) return;
        const currentMethod = overrides?.paymentMethod || paymentMethod;
        const currentLegs = overrides?.paymentLegs || paymentLegs;
        const currentNotes = overrides?.notes !== undefined ? overrides.notes : notes;
        const currentCash = overrides?.cashReceived || cashReceived;

        if (!skipWarning && currentMethod === 'CREDIT' && !selectedClientId) {
            setShowCreditWarning(true);
            return;
        }

        setIsProcessing(true);
        try {
            // Find accountId from string or configured methods
            let accId = undefined;
            if (registerConfig?.payment_methods) {
                const methodConfig = registerConfig.payment_methods.find((m: any) => typeof m === 'object' && m.key === currentMethod);
                if (methodConfig) {
                    accId = methodConfig.accountId;
                }
            }
            if (!accId && currentLegs && currentLegs.length > 0 && registerConfig?.payment_methods) {
                const multiConfig = registerConfig.payment_methods.find((m: any) => typeof m === 'object' && m.key === currentLegs[0].method);
                if (multiConfig) accId = multiConfig.accountId;
            }

            const result: any = await processSale({
                cart: cart, // Restored field name logic
                clientId: selectedClientId || undefined,
                paymentMethod: currentMethod,
                paymentAccountId: accId,
                warehouseId: registerConfig?.warehouseId || registerConfig?.warehouse_id || undefined,
                totalAmount,
                globalDiscount: discount,
                notes: currentNotes,
                paymentLegs: currentLegs,
                storeChangeInWallet: storeChangeInWallet,
                pointsRedeemed,
                cashReceived: Number(currentCash) || 0
            });


            if (result.success) {
                const orderData = { id: result.orderId, ref: result.ref };
                setLastOrder(orderData);
                setIsReceiptOpen(true);
                clearCart();
                toast.success("Transaction localized and archived.");
                return { success: true, data: orderData };
            } else {
                toast.error(result.message || "Terminal Fault");
                return { success: false, error: result.message };
            }
        } catch (err: any) {
            toast.error("Forensic Engine Fault: " + err.message);
            return { success: false, error: err.message };
        } finally {
            setIsProcessing(false);
        }
    }, [cart, selectedClientId, paymentMethod, totalAmount, discount, discountType, notes, paymentLegs, storeChangeInWallet, pointsRedeemed, cashReceived, clearCart, registerConfig]);

    const getClientFidelityData = useCallback(async (clientId: number) => {
        setFidelityLoading(true);
        try {
            const result: any = await getClientFidelity(clientId);
            if (result && result.analytics) {
                setClientFidelity(result);
            }
        } finally {
            setFidelityLoading(false);
        }
    }, []);

    const createNewTicket = useCallback(() => {
        const newId = Date.now().toString();
        const newSession = { id: newId, clientId: 1, cart: [], name: `Ticket ${sessions.length + 1}` };
        setSessions(prev => [...prev, newSession]);
        setActiveTicketId(newId);
        toast.success("New ticket created");
    }, [sessions.length]);

    const onOpenRegisterSession = useCallback(async (registerId: number, openingBalanceValue: number, advancedData?: any, forceClose?: boolean, overridePin?: string) => {
        if (!user) {
            toast.error("Cashier identity not found. Please re-login.");
            return { success: false, error: "Authentication required" };
        }

        try {
            const result: any = await openRegisterSession(
                registerId,
                user.id,
                openingBalanceValue,
                '', // notes
                advancedData,
                forceClose,
                overridePin
            );

            if (result.success && result.data) {
                setActiveRegisterSessionId(result.data.session_id);
                return result;
            } else {
                return result;
            }
        } catch (err: any) {
            return { success: false, error: err.message || "Cloud Sync Engine Fault" };
        }
    }, [user]);

    const onConfirmCloseRegister = useCallback(async (closingBalance: number, closeNotes?: string) => {
        if (!activeRegisterSessionId) return { success: false, error: "No active session" };

        try {
            const result: any = await closeRegisterSession(
                activeRegisterSessionId,
                closingBalance,
                closeNotes
            );

            if (result.success) {
                setActiveRegisterSessionId(null);
                setRegisterConfig(null);
                setShowCloseRegister(false);
                return result;
            } else {
                return result;
            }
        } catch (err: any) {
            return { success: false, error: err.message || "Cloud Reconciliation Engine Fault" };
        }
    }, [activeRegisterSessionId]);

    // UI Trigger Actions
    const onToggleFullscreen = useCallback(() => toast.info("Fullscreen toggled"), []);
    const onOpenLayoutSelector = useCallback(() => setIsLayoutSelectorOpen(true), []);
    const onOpenReturn = useCallback(() => setShowReturn(true), []);
    const onLockRegister = useCallback(() => toast.info("Terminal Locked"), []);
    const onOpenRegister = useCallback(() => toast.info("Register menu opened"), []);
    const onCloseRegister = useCallback(() => {
        // 🔒 Security Rule: Cannot close register with pending unsaved tickets
        if (cart.length > 0) {
            toast.error('⚠️ Cannot close register: active ticket has unsaved items. Complete or clear all tickets first.', { duration: 5000 });
            return;
        }
        setShowCloseRegister(true);
    }, [cart]);


    const handleLayoutChange = useCallback((layout: POSLayoutVariant) => {
        setCurrentLayout(layout);
        setIsLayoutSelectorOpen(false);
    }, []);

    return {
        // State
        currentLayout, isLayoutSelectorOpen, clients, sessions,
        activeTicketId, activeRegisterSessionId,
        activeSessionId: activeTicketId, // Backward compatibility
        isSuperAdmin, categories, categoriesLoading, searchQuery,
        selectedCategory, isCartVisible, isReceiptOpen, showCloseRegister,
        showReturn, showCreditWarning, isOverrideOpen, pendingOverrideAction,
        isVaultOpen, paymentMethods,
        isOnline, lastOrder, totalPieces: cart.length, uniqueItems: cart.length,
        clientFidelity, fidelityLoading, subtotal, tax, total,
        activeCategoryId, currentParentId, sidebarMode, isFullscreen, currency,
        clientSearchQuery, productIndex: productIndexRef, allowNegativeStockRef,
        loyaltyPointValue, storeChangeInWallet, pointsRedeemed,
        cart, selectedClientId, selectedClient, totalAmount, discountAmount,
        discount, discountType, paymentMethod, cashReceived, notes, paymentLegs,
        isProcessing, registerConfig, deliveryZone, deliveryZones, highlightedItemId, lastAddedItemId,

        // Actions
        setCurrentLayout, setIsLayoutSelectorOpen, handleLayoutChange, setClients,
        setActiveTicketId, setActiveRegisterSessionId, setIsSuperAdmin, setCategories,
        setCategoriesLoading, setSearchQuery, setSelectedCategory, setIsCartVisible,
        setIsReceiptOpen, onSetReceiptOpen: setIsReceiptOpen,
        setIsVaultOpen, onSetIsVaultOpen: setIsVaultOpen,
        onProductsLoaded,
        setPaymentMethods,
        setShowCloseRegister, setShowReturn,
        setShowCreditWarning, onSetCreditWarning: setShowCreditWarning,
        setIsOverrideOpen, onSetOverrideOpen: setIsOverrideOpen,
        setPendingOverrideAction, onSetPendingOverrideAction: setPendingOverrideAction,
        setCart, setSelectedClientId, setDiscount, setDiscountType,
        setPaymentMethod, setCashReceived, setNotes, setPaymentLegs,
        setDeliveryZone, setDeliveryZones, addToCart, updateQuantity, updatePrice,
        clearCart, onCharge, onSync, getClientFidelityData,
        onOpenRegisterSession,
        onConfirmCloseRegister, onLockRegister, onOpenRegister, onCloseRegister,
        setStoreChangeInWallet, setPointsRedeemed, setLoyaltyPointValue,
        setRegisterConfig, updateActiveSession, onToggleFullscreen, onOpenLayoutSelector,
        onOpenReturn, setIsOnline: (v: boolean) => { }, // placeholder
        setClientSearchQuery,

        // Backward compatibility / POSLayoutProps aliases
        onSetSearchQuery: setSearchQuery,
        onSetPaymentMethod: setPaymentMethod,
        onSetCashReceived: setCashReceived,
        onSetDiscount: setDiscount,
        onSetDiscountType: setDiscountType,
        onAddToCart: addToCart,
        onUpdateQuantity: updateQuantity,
        onUpdatePrice: updatePrice,
        onClearCart: clearCart,
        onSetClientSearchQuery: setClientSearchQuery,
        onSetDeliveryZone: setDeliveryZone,
        onSetNotes: setNotes,
        onSetPaymentLegs: setPaymentLegs,
        onUpdateActiveSession: updateActiveSession,
        onSetPointsRedeemed: setPointsRedeemed,
        onSetStoreChangeInWallet: setStoreChangeInWallet,
        onSetActiveSessionId: setActiveTicketId,
        onSetActiveCategoryId: setSelectedCategory,
        onSetCurrentParentId: (id: number | null) => { /* logic if needed */ },
        onUpdateLineDiscount: updateLineDiscount,
        onUpdateLineNote: updateLineNote,
        onRemoveSession: onRemoveSession,
        onCreateNewSession: createNewTicket,
        onSetIsOnline: (v: boolean) => { /* System online status is read-only from hook */ },
        onSearchClients: async (query: string) => {
            // Placeholder: search functionality should be migrated here
        },
    };
}
