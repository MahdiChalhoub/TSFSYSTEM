'use client';

/**
 * POSClient — main POS container.
 * Shows POSLobby until a register is opened, then renders the full POS screen.
 */

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import type { CartItem } from '@/types/pos';
import type { POSLayoutVariant } from '@/types/pos-layout';

const POSLobby = dynamic(() => import('@/components/pos/lobby/POSLobby'), { ssr: false });
const POSLayoutModern = dynamic(
    () => import('@/components/pos/layouts/POSLayoutModern').then(m => ({ default: m.POSLayoutModern })),
    { ssr: false }
);
const CloseRegisterModal = dynamic(() => import('@/components/pos/CloseRegisterModal'), { ssr: false });

type RegisterConfig = {
    registerId: number;
    registerName: string;
    sessionId: number;
    cashierId: number;
    cashierName: string;
    warehouseId: number | null;
    cashAccountId: number | null;
    allowedAccounts: any[];
    siteName: string;
    paymentMethods: Array<{ key: string; label: string; accountId: number | null }>;
};

const EMPTY_CLIENT = {
    id: 0, name: '', phone: '', balance: 0,
    creditLimit: 0, currentBalance: 0, loyalty: 0, address: '', zone: '',
};

export default function POSClient() {
    // ── Register / lobby ──────────────────────────────────────────────
    const [registerConfig, setRegisterConfig] = useState<RegisterConfig | null>(null);
    const [layout, setLayout] = useState<POSLayoutVariant>('grid');

    // ── Cart ──────────────────────────────────────────────────────────
    const [cart, setCart] = useState<CartItem[]>([]);
    const [discount, setDiscount] = useState(0);
    const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
    const [notes, setNotes] = useState('');
    const [paymentLegs, setPaymentLegs] = useState<any[]>([]);

    // ── Search / filter ───────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
    const [currentParentId, setCurrentParentId] = useState<number | null>(null);

    // ── UI state ──────────────────────────────────────────────────────
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [sidebarMode, setSidebarMode] = useState<'hidden' | 'normal' | 'expanded'>('normal');
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [cashReceived, setCashReceived] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isOverrideOpen, setIsOverrideOpen] = useState(false);
    const [pendingOverrideAction, setPendingOverrideAction] = useState<any>(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [lastOrder, setLastOrder] = useState<any>(null);
    const [storeChangeInWallet, setStoreChangeInWallet] = useState(false);
    const [pointsRedeemed, setPointsRedeemed] = useState(0);
    const [isOnline, setIsOnline] = useState(true);
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [deliveryZone, setDeliveryZone] = useState('');
    const [isVaultOpen, setIsVaultOpen] = useState(false);
    const [highlightedItemId, setHighlightedItemId] = useState<number | null>(null);
    const [lastAddedItemId, setLastAddedItemId] = useState<number | null>(null);
    const [showCloseModal, setShowCloseModal] = useState(false);

    // ── Remote data ───────────────────────────────────────────────────
    const [clients, setClients] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedClientId, setSelectedClientId] = useState(0);
    const [deliveryZones, setDeliveryZones] = useState<any[]>([]);

    // ── Sessions (multi-tab) ──────────────────────────────────────────
    const [sessions, setSessions] = useState([{ id: 'session-1', clientId: 0, cart: [], name: 'Sale 1' }]);
    const [activeSessionId, setActiveSessionId] = useState('session-1');

    // ── Computed values ───────────────────────────────────────────────
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = discountType === 'percentage' ? (total * discount) / 100 : discount;
    const totalAmount = Math.max(0, total - discountAmount);
    const totalPieces = cart.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueItems = cart.length;
    const selectedClient = clients.find(c => c.id === selectedClientId) || EMPTY_CLIENT;

    // ── Load categories ───────────────────────────────────────────────
    useEffect(() => {
        if (!registerConfig) return;
        import('./actions').then(({ getCategories }) =>
            getCategories().then(cats => { if (Array.isArray(cats)) setCategories(cats); }).catch(() => { })
        );
    }, [registerConfig]);

    // ── Load clients ──────────────────────────────────────────────────
    useEffect(() => {
        if (!registerConfig) return;
        import('@/lib/erp-api').then(({ erpFetch }) =>
            erpFetch('contacts/?type=CLIENT&page_size=200').then(data => {
                const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
                setClients(rows.map((c: any) => ({
                    id: c.id, name: c.name, phone: c.phone || '',
                    balance: 0, creditLimit: c.credit_limit || 0, currentBalance: 0,
                    loyalty: c.loyalty_points || 0, address: c.address || '', zone: c.zone || '',
                })));
            }).catch(() => { })
        );
    }, [registerConfig]);

    // ── Handlers ──────────────────────────────────────────────────────
    const fireSecurityEvent = useCallback(async (type: string, name: string, details: any) => {
        try {
            const { erpFetch } = await import('@/lib/erp-api');
            await erpFetch('pos/fire-event/', {
                method: 'POST',
                body: JSON.stringify({
                    event_type: type,
                    event_name: name,
                    details,
                    reference_id: registerConfig?.sessionId?.toString()
                })
            });
        } catch (e) {
            console.error('[POS] Failed to fire security event:', e);
        }
    }, [registerConfig]);

    const handleEnterPOS = useCallback((config: RegisterConfig) => {
        setRegisterConfig(config);
    }, []);

    const handleAddToCart = useCallback((product: Record<string, any>) => {
        const productId = product.id;
        setLastAddedItemId(productId);
        setCart(prev => {
            const existing = prev.find(p => p.productId === productId);
            if (existing) {
                setHighlightedItemId(productId);
                return prev.map(p => p.productId === productId ? { ...p, quantity: p.quantity + 1 } : p);
            }
            return [...prev, {
                productId,
                name: product.name || product.product_name || '',
                price: Number(product.selling_price_ttc ?? product.basePrice ?? product.price ?? 0),
                taxRate: Number(product.tva_rate ?? product.taxRate ?? 0),
                quantity: 1,
                isTaxIncluded: true,
                barcode: product.barcode,
                unitName: product.unit_short_name || product.unit_name,
            }];
        });
    }, []);

    const handleUpdateQuantity = useCallback((productId: number, delta: number) => {
        setCart(prev => {
            const item = prev.find(i => i.productId === productId);
            const newList = prev.map(item => item.productId === productId
                ? { ...item, quantity: Math.max(0, item.quantity + delta) }
                : item
            ).filter(i => i.quantity > 0);

            // Trigger audit if item was completely removed
            if (item && !newList.find(i => i.productId === productId)) {
                fireSecurityEvent('REMOVE_ITEM', 'Item Removed from Cart', {
                    product_id: productId,
                    product_name: item.name,
                    qty_before: item.quantity,
                    total_before: item.price * item.quantity
                });
            } else if (item && delta < 0) {
                // Decrease quantity audit
                fireSecurityEvent('DECREASE_QTY', 'Item Quantity Decreased', {
                    product_id: productId,
                    product_name: item.name,
                    old_qty: item.quantity,
                    new_qty: item.quantity + delta
                });
            }

            return newList;
        });
    }, [fireSecurityEvent]);

    const handleUpdatePrice = useCallback((productId: number, price: number) => {
        setCart(prev => prev.map(item => item.productId === productId ? { ...item, price } : item));
    }, []);

    const handleUpdateLineDiscount = useCallback((productId: number, discountRate: number) => {
        setCart(prev => prev.map(item => item.productId === productId ? { ...item, discountRate } : item));
    }, []);

    const handleUpdateLineNote = useCallback((productId: number, note: string) => {
        setCart(prev => prev.map(item => item.productId === productId ? { ...item, lineNote: note } : item));
    }, []);

    const handleClearCart = useCallback((_force?: boolean) => {
        if (cart.length > 0) {
            fireSecurityEvent('CLEAR_CART', 'Cart Cleared', {
                items_count: cart.length,
                total_value: total
            });
        }
        setCart([]);
        setDiscount(0);
        setNotes('');
        setPaymentLegs([]);
        setCashReceived('');
        setPointsRedeemed(0);
        setStoreChangeInWallet(false);
        setSelectedClientId(0);
        setDeliveryZone('');
    }, [cart, total, fireSecurityEvent]);

    const handleCharge = useCallback(async (skipWarning?: boolean, overrides?: any) => {
        if (!registerConfig) return;
        if (cart.length === 0) { toast.error('Cart is empty'); return; }
        setIsProcessing(true);
        try {
            const { erpFetch } = await import('@/lib/erp-api');
            const pm = overrides?.paymentMethod ?? paymentMethod;
            const legs = overrides?.paymentLegs ?? paymentLegs;
            const n = overrides?.notes ?? notes;
            const cr = overrides?.cashReceived ?? cashReceived;

            const result = await erpFetch('pos/checkout/', {
                method: 'POST',
                body: JSON.stringify({
                    items: cart.map(item => ({
                        product_id: item.productId,
                        quantity: item.quantity,
                        unit_price: item.price,
                        discount_rate: (item as any).discountRate ?? 0,
                        notes: (item as any).lineNote ?? '',
                    })),
                    warehouse_id: registerConfig.warehouseId,
                    payment_account_id: registerConfig.cashAccountId,
                    payment_method: pm,
                    payment_legs: legs,
                    contact_id: selectedClientId || null,
                    session_id: registerConfig.sessionId,
                    register_id: registerConfig.registerId,
                    notes: n,
                    global_discount: discountAmount,
                    cash_received: Number(cr) || 0,
                    store_change_in_wallet: storeChangeInWallet,
                    points_redeemed: pointsRedeemed,
                }),
            });

            setLastOrder({
                id: result.order_id, ref: result.ref,
                fneStatus: result.fne_status,
                fneReference: result.fne_reference,
                fneToken: result.fne_token,
            });
            setIsReceiptOpen(true);
            handleClearCart();
            toast.success(`Sale complete — ${result.ref}`);
        } catch (e: any) {
            toast.error(e?.message || 'Checkout failed');
        } finally {
            setIsProcessing(false);
        }
    }, [cart, registerConfig, paymentMethod, paymentLegs, notes, cashReceived,
        selectedClientId, discountAmount, storeChangeInWallet, pointsRedeemed, handleClearCart]);

    const handleCreateNewSession = useCallback(() => {
        const newId = `session-${Date.now()}`;
        setSessions(prev => [...prev, { id: newId, clientId: 0, cart: [], name: `Sale ${prev.length + 1}` }]);
        setActiveSessionId(newId);
        handleClearCart();
    }, [handleClearCart]);

    const handleRemoveSession = useCallback((id: string, _force?: boolean) => {
        setSessions(prev => {
            if (prev.length <= 1) return prev;
            const filtered = prev.filter(s => s.id !== id);
            if (activeSessionId === id) setActiveSessionId(filtered[0]?.id || '');
            return filtered;
        });
    }, [activeSessionId]);

    const handleSearchClients = useCallback(async (query: string) => {
        try {
            const { erpFetch } = await import('@/lib/erp-api');
            const data = await erpFetch(`contacts/?type=CLIENT&search=${encodeURIComponent(query)}&page_size=50`);
            const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
            setClients(rows.map((c: any) => ({
                id: c.id, name: c.name, phone: c.phone || '',
                balance: 0, creditLimit: c.credit_limit || 0, currentBalance: 0,
                loyalty: c.loyalty_points || 0, address: c.address || '', zone: c.zone || '',
            })));
        } catch { }
    }, []);

    const handleSync = useCallback(() => { toast.info('Syncing...'); }, []);

    const handleLockRegister = useCallback(() => {
        setRegisterConfig(null);
        handleClearCart();
    }, [handleClearCart]);

    const handleCloseRegister = useCallback(() => {
        setShowCloseModal(true);
    }, []);

    // ── Render: Lobby ─────────────────────────────────────────────────
    if (!registerConfig) {
        return <POSLobby currency="XOF" onEnterPOS={handleEnterPOS} />;
    }

    // ── Render: POS screen ────────────────────────────────────────────
    const posProps = {
        // Data
        cart, clients, selectedClient, selectedClientId, categories,
        sessions, activeSessionId, currency: 'XOF',
        // Computed
        total, discount, discountType, totalAmount, totalPieces, uniqueItems,
        discountAmount, subtotal: total, tax: 0, notes, paymentLegs,
        // Flags
        isSuperAdmin: false, selectedCategory: null, isCartVisible: true,
        showCloseRegister: true, showReturn: false, showCreditWarning: false,
        isVaultOpen, loyaltyPointValue: 1,
        productIndex: {}, allowNegativeStockRef: { current: false },
        // UI state
        searchQuery, activeCategoryId, currentParentId, sidebarMode,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        isOverrideOpen, pendingOverrideAction,
        isReceiptOpen, lastOrder, highlightedItemId, lastAddedItemId,
        isOnline, clientSearchQuery, deliveryZone, deliveryZones,
        storeChangeInWallet, pointsRedeemed,
        // Handlers
        onSetSearchQuery: setSearchQuery,
        onSetActiveCategoryId: setActiveCategoryId,
        onSetCurrentParentId: setCurrentParentId,
        onSetActiveSessionId: setActiveSessionId,
        onSetPaymentMethod: setPaymentMethod,
        onSetCashReceived: setCashReceived,
        onSetDiscount: setDiscount,
        onSetDiscountType: setDiscountType,
        onSetOverrideOpen: setIsOverrideOpen,
        onSetPendingOverrideAction: setPendingOverrideAction,
        onSetReceiptOpen: setIsReceiptOpen,
        onSetStoreChangeInWallet: setStoreChangeInWallet,
        onSetPointsRedeemed: setPointsRedeemed,
        onSetIsVaultOpen: setIsVaultOpen,
        setIsVaultOpen,
        onAddToCart: handleAddToCart,
        onUpdateQuantity: handleUpdateQuantity,
        onUpdatePrice: handleUpdatePrice,
        onUpdateLineDiscount: handleUpdateLineDiscount,
        onUpdateLineNote: handleUpdateLineNote,
        onClearCart: handleClearCart,
        onCreateNewSession: handleCreateNewSession,
        onRemoveSession: handleRemoveSession,
        onUpdateActiveSession: (_updates: any) => { },
        onToggleFullscreen: () => setIsFullscreen(v => !v),
        onCycleSidebarMode: () => setSidebarMode(v => v === 'hidden' ? 'normal' : v === 'normal' ? 'expanded' : 'hidden'),
        onCharge: handleCharge,
        onSync: handleSync,
        onSetIsOnline: setIsOnline,
        onSetClientSearchQuery: setClientSearchQuery,
        onSetDeliveryZone: setDeliveryZone,
        onSetNotes: setNotes,
        onSetPaymentLegs: setPaymentLegs,
        onSearchClients: handleSearchClients,
        onOpenLayoutSelector: () => { },
        onLockRegister: handleLockRegister,
        onCloseRegister: handleCloseRegister,
        // Layout
        currentLayout: layout,
        // Register config — map paymentMethods → payment_methods for the layout
        registerConfig: { ...registerConfig, payment_methods: registerConfig.paymentMethods },
        paymentMethods: registerConfig.paymentMethods,
    };

    return (
        <div className="absolute inset-0">
            <POSLayoutModern {...(posProps as any)} />
            {showCloseModal && registerConfig && (
                <CloseRegisterModal
                    sessionId={registerConfig.sessionId}
                    registerName={registerConfig.registerName}
                    cashierName={registerConfig.cashierName}
                    openingBalance={0}
                    currency="XOF"
                    onClose={() => {
                        setShowCloseModal(false);
                        handleLockRegister();
                    }}
                    onCancel={() => setShowCloseModal(false)}
                />
            )}
        </div>
    );
}
