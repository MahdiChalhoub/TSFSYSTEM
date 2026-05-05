// @ts-nocheck
'use client';
/**
 * POS Layout — Kiosk Mode
 * ========================
 * Self-checkout / scan-focused interface inspired by SupermarcheLayoutKiosk.
 * - LEFT: Scan bar + last scanned product display + numpad for quantity
 * - RIGHT: Live cart + checkout
 *
 * Uses the full POSLayoutProps for real terminal state.
 * All colors use --app-* theme variables — zero hardcoded colors.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { AccountBook } from '@/components/pos/AccountBook';
import { POSToolbar } from '@/components/pos/POSToolbar';
import { Numpad as POSNumpad, NumpadMode } from '@/components/pos/Numpad';
import { POSSalesHistoryPanel } from '@/components/pos/POSSalesHistoryPanel';
import { POSDeliveryModal } from '@/components/pos/POSDeliveryModal';
import { POSPendingDeliveriesPanel } from '@/components/pos/POSPendingDeliveriesPanel';
import { MultiPaymentDashboard } from '@/components/pos/MultiPaymentHub';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import {
    Search, ShoppingCart, X, Minus, Plus, Trash2,
    Scan, ShoppingBag, Calculator, MapPin,
    CreditCard, Wallet, Banknote, Smartphone, Landmark, Star,
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

const formatNumber = (num: number | string) => {
    const val = Number(num) || 0;
    const parts = val.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return parts[1] === '00' ? parts[0] : parts.join('.');
};

const DEFAULT_PAYMENT_METHODS = ['CASH', 'CARD', 'WALLET', 'WAVE', 'OM', 'MULTI', 'DELIVERY'];

export function POSLayoutKiosk(props: POSLayoutProps) {
    const {
        cart, clients, selectedClient, selectedClientId, categories,
        sessions, activeSessionId, currency, total, discount, discountType, totalAmount,
        totalPieces, uniqueItems, searchQuery, activeCategoryId, currentParentId,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        isReceiptOpen, lastOrder, highlightedItemId,
        isOnline, clientSearchQuery, deliveryZone, deliveryZones,
        storeChangeInWallet, pointsRedeemed,
        onSetSearchQuery, onSetActiveCategoryId, onSetCurrentParentId, onSetActiveSessionId,
        onSetPaymentMethod, onSetCashReceived, onSetDiscount, onSetDiscountType, onAddToCart,
        onUpdateQuantity, onUpdatePrice,
        onClearCart, onCreateNewSession, onRemoveSession, onUpdateActiveSession,
        onToggleFullscreen, onCharge,
        onSync, onSetIsOnline, onSetClientSearchQuery, onSetDeliveryZone,
        onSetOverrideOpen, onSetReceiptOpen, onOpenLayoutSelector,
        onSetStoreChangeInWallet, onSetPointsRedeemed, onSetNotes,
        currentLayout, onSearchClients,
    } = props;

    const paymentMethods = (props as any).paymentMethods || DEFAULT_PAYMENT_METHODS;
    const registerConfig = (props as any).registerConfig;
    const onLockRegister = (props as any).onLockRegister;
    const receivedNum = Number(cashReceived) || 0;
    const changeDue = receivedNum > totalAmount ? receivedNum - totalAmount : 0;

    // Kiosk-specific state
    const [lastScanned, setLastScanned] = useState<any>(null);
    const [numpadValue, setNumpadValue] = useState('1');
    const [isAccountBookOpen, setIsAccountBookOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
    const [isPendingDeliveriesOpen, setIsPendingDeliveriesOpen] = useState(false);
    const [isMultiPayMode, setIsMultiPayMode] = useState(false);

    // Track last added item from cart for the "last scanned" display
    useEffect(() => {
        if (cart.length > 0) {
            setLastScanned(cart[cart.length - 1]);
        }
    }, [cart.length]);

    const handleNumpadKey = (key: string) => {
        setNumpadValue(v => {
            if (key === '.' && v.includes('.')) return v;
            if (v === '0' || v === '1') return key;
            return (v + key).slice(0, 6);
        });
    };

    const handleProtectedQuantity = useCallback((productId: number, delta: number) => {
        const item = cart.find(i => i.productId === productId);
        if (delta < 0) {
            props.onSetPendingOverrideAction({
                label: (item?.quantity || 0) + delta <= 0
                    ? `Delete "${item?.name || 'Item'}" from cart`
                    : `Decrease "${item?.name || 'Item'}" qty by ${Math.abs(delta)}`,
                execute: () => onUpdateQuantity(productId, delta),
            });
            onSetOverrideOpen(true);
        } else {
            onUpdateQuantity(productId, delta);
        }
    }, [cart, onUpdateQuantity, onSetOverrideOpen]);

    return (
        <div className={clsx(
            "flex flex-col overflow-hidden select-none h-full",
            isFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen" : "absolute inset-0"
        )} style={{ background: 'var(--app-bg)' }}>

            {/* ═══════════ SHARED TOOLBAR ═══════════ */}
            <POSToolbar
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSetActiveSessionId={onSetActiveSessionId}
                onCreateNewSession={onCreateNewSession}
                onRemoveSession={onRemoveSession}
                registerConfig={registerConfig}
                selectedClient={selectedClient}
                clients={clients}
                clientSearchQuery={clientSearchQuery}
                onSetClientSearchQuery={onSetClientSearchQuery}
                onSelectClient={(id: number) => onUpdateActiveSession({ clientId: id })}
                currency={currency}
                deliveryZone={deliveryZone}
                deliveryZones={deliveryZones}
                onSetDeliveryZone={onSetDeliveryZone}
                isOnline={isOnline}
                isProcessing={isProcessing}
                isFullscreen={isFullscreen}
                totalPieces={totalPieces}
                uniqueItems={uniqueItems}
                currentLayout={currentLayout}
                onSetIsOnline={onSetIsOnline}
                onSync={onSync}
                onToggleFullscreen={onToggleFullscreen}
                onOpenLayoutSelector={onOpenLayoutSelector}
                onLockRegister={onLockRegister}
                onCloseRegister={(props as any).onCloseRegister}
                onOpenReturn={(props as any).onOpenReturn}
                onOpenAccountBook={() => setIsAccountBookOpen(true)}
                onOpenPendingDeliveries={() => setIsPendingDeliveriesOpen(true)}
            />

            {/* ═══════════ KIOSK HEADER ═══════════ */}
            <header
                className="flex items-center justify-center py-3 flex-shrink-0"
                style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--app-primary-light, rgba(var(--app-primary-rgb, 99,102,241), 0.1))' }}
                    >
                        <ShoppingBag size={20} style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-black" style={{ color: 'var(--app-foreground)' }}>
                            {registerConfig?.siteName || 'POS'}
                        </p>
                        <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                            Self-Checkout Kiosk
                        </p>
                    </div>
                </div>
            </header>

            {/* ═══════════ MAIN BODY ═══════════ */}
            <div className="flex-1 flex overflow-hidden">

                {/* ── LEFT: Scan + Last item + Numpad ── */}
                <div className="flex-1 flex flex-col p-5 gap-4" style={{ background: 'var(--app-bg)' }}>

                    {/* Scan bar */}
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--app-muted-foreground)' }}>
                            <Scan size={14} /> Scan or Search Product
                        </p>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--app-muted-foreground)' }} />
                            <input
                                type="text"
                                autoFocus
                                placeholder="Scan barcode or search product..."
                                value={searchQuery}
                                onChange={(e) => onSetSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-bold outline-none transition-all"
                                style={{
                                    background: 'var(--app-surface)',
                                    border: '2px solid var(--app-border)',
                                    color: 'var(--app-foreground)',
                                }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--app-primary)'; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--app-border)'; }}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => onSetSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--app-muted-foreground)' }}
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Product grid — compact for kiosk */}
                    <div className="flex-1 overflow-y-auto rounded-xl" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <ProductGrid
                            searchQuery={searchQuery}
                            categoryId={activeCategoryId || currentParentId}
                            onAddToCart={onAddToCart}
                            currency={currency}
                            onProductsLoaded={(products) => {
                                if ((props as any).onProductsLoaded) (props as any).onProductsLoaded(products);
                            }}
                            onAutoAdd={(product) => {
                                onAddToCart(product);
                                setLastScanned(product);
                                setTimeout(() => onSetSearchQuery(''), 300);
                            }}
                            onNotFound={(q) => {
                                toast.error(`"${q}" not found`, {
                                    description: 'No product matches this barcode or search.',
                                    duration: 3000,
                                });
                                setTimeout(() => onSetSearchQuery(''), 1500);
                            }}
                        />
                    </div>

                    {/* Numpad for quantity */}
                    <div className="shrink-0">
                        <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>
                            Quick Quantity
                        </p>
                        <div className="grid grid-cols-5 gap-2">
                            {['1', '2', '3', '5', '10'].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setNumpadValue(n)}
                                    className="py-3 rounded-xl text-sm font-black transition-all active:scale-95"
                                    style={{
                                        background: numpadValue === n ? 'var(--app-primary)' : 'var(--app-surface)',
                                        color: numpadValue === n ? '#fff' : 'var(--app-foreground)',
                                        border: `1px solid ${numpadValue === n ? 'var(--app-primary)' : 'var(--app-border)'}`,
                                    }}
                                >
                                    ×{n}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Cart + Payment + Checkout ── */}
                <aside
                    className="w-[380px] flex-shrink-0 flex flex-col"
                    style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)' }}
                >
                    {/* Cart header */}
                    <div className="px-4 py-2.5 flex items-center justify-between shrink-0"
                        style={{ borderBottom: '1px solid var(--app-border)' }}
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--app-success, #22c55e)' }} />
                            <h2 className="text-sm font-black" style={{ color: 'var(--app-foreground)' }}>Order</h2>
                            <span className="text-xs font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                {uniqueItems} lines · {totalPieces} pcs
                            </span>
                        </div>
                        {cart.length > 0 && (
                            <button
                                onClick={() => {
                                    props.onSetPendingOverrideAction({ label: 'Clear entire cart', execute: () => onClearCart(true) });
                                    onSetOverrideOpen(true);
                                }}
                                className="text-xs font-bold transition-colors"
                                style={{ color: 'var(--app-muted-foreground)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--app-error, #ef4444)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--app-muted-foreground)'; }}
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Cart items */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--app-muted-foreground)' }}>
                                <ShoppingCart size={40} strokeWidth={1} />
                                <p className="text-xs font-bold">Scan items to begin</p>
                            </div>
                        ) : (
                            <div>
                                {cart.map((item: any, idx: number) => (
                                    <div
                                        key={item.productId}
                                        className="px-4 py-2.5 flex items-center gap-3 transition-colors"
                                        style={{
                                            borderBottom: '1px solid var(--app-border)',
                                            background: highlightedItemId === item.productId ? 'var(--app-primary-light, rgba(99,102,241,0.08))' : 'transparent',
                                        }}
                                    >
                                        {/* Name + price */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black truncate" style={{ color: 'var(--app-foreground)' }}>{item.name}</p>
                                            <p className="text-xs font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                                {currency}{Number(item.price).toFixed(2)}
                                            </p>
                                        </div>

                                        {/* Qty controls */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => handleProtectedQuantity(item.productId, -1)}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                                                style={{ background: 'var(--app-surface-2, var(--app-bg))', color: 'var(--app-muted-foreground)' }}
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <span className="w-8 text-center text-sm font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => onUpdateQuantity(item.productId, 1)}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                                                style={{ background: 'var(--app-primary-light, rgba(99,102,241,0.1))', color: 'var(--app-primary)' }}
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>

                                        {/* Line total */}
                                        <span className="text-sm font-black tabular-nums shrink-0 w-20 text-right" style={{ color: 'var(--app-primary)' }}>
                                            {currency}{(Number(item.price) * item.quantity).toFixed(2)}
                                        </span>

                                        {/* Remove */}
                                        <button
                                            onClick={() => handleProtectedQuantity(item.productId, -item.quantity)}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0"
                                            style={{ background: 'var(--app-error-bg, rgba(239,68,68,0.08))', color: 'var(--app-error, #ef4444)' }}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Checkout footer */}
                    <div className="shrink-0 p-4 space-y-3" style={{ borderTop: '2px solid var(--app-border)' }}>
                        {/* Summary */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Total</span>
                            <span className="text-2xl font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>
                                {currency}{formatNumber(totalAmount)}
                            </span>
                        </div>

                        {/* Received */}
                        <div className="relative">
                            <span className="absolute left-3 top-1.5 text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                                Received
                            </span>
                            <input
                                type="text"
                                value={cashReceived ? cashReceived.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ''}
                                onChange={(e) => {
                                    const raw = e.target.value.replace(/\s+/g, '').replace(',', '.');
                                    if (raw === '' || /^\d*\.?\d*$/.test(raw)) onSetCashReceived(raw);
                                }}
                                placeholder={formatNumber(totalAmount)}
                                className="w-full pt-5 pb-2 px-3 text-right rounded-xl text-lg font-black outline-none transition-all tabular-nums"
                                style={{
                                    background: 'var(--app-bg)',
                                    border: '2px solid var(--app-border)',
                                    color: 'var(--app-foreground)',
                                }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--app-primary)'; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--app-border)'; }}
                            />
                        </div>

                        {/* Charge button */}
                        <button
                            onClick={() => onCharge()}
                            disabled={cart.length === 0 || isProcessing}
                            className="w-full py-4 rounded-xl font-black text-lg uppercase tracking-wider transition-all active:scale-[0.98]"
                            style={{
                                background: cart.length > 0 && !isProcessing ? 'var(--app-primary)' : 'var(--app-surface-2, var(--app-bg))',
                                color: cart.length > 0 && !isProcessing ? '#fff' : 'var(--app-muted-foreground)',
                                boxShadow: cart.length > 0 && !isProcessing ? '0 8px 24px var(--app-primary-glow, rgba(99,102,241,0.3))' : 'none',
                            }}
                        >
                            {changeDue > 0 ? `Change: ${currency}${formatNumber(changeDue)}` : `Charge ${currency}${formatNumber(totalAmount)}`}
                        </button>
                    </div>
                </aside>
            </div>

            {/* ═══════════ MODALS ═══════════ */}
            <ReceiptModal
                isOpen={isReceiptOpen}
                onClose={() => onSetReceiptOpen(false)}
                orderId={lastOrder?.id || null}
                refCode={lastOrder?.ref || null}
                fneStatus={lastOrder?.fneStatus}
                fneReference={lastOrder?.fneReference}
                fneToken={lastOrder?.fneToken}
            />
            <AccountBook
                isOpen={isAccountBookOpen}
                onClose={() => setIsAccountBookOpen(false)}
                sessionId={registerConfig?.sessionId || null}
                cashierId={registerConfig?.cashierId || null}
                currency={currency}
                isManager={registerConfig?.isManager || false}
            />
            <POSSalesHistoryPanel
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                currency={currency}
                registerName={registerConfig?.registerName}
                sessionId={registerConfig?.sessionId}
            />
            <POSDeliveryModal
                isOpen={isDeliveryModalOpen}
                onClose={() => setIsDeliveryModalOpen(false)}
                orderTotal={totalAmount}
                currency={currency}
                selectedClient={selectedClient}
                sessionId={registerConfig?.sessionId}
                hasClientCredit={!!(selectedClient as any)?.credit_limit}
                preSelectedZoneName={deliveryZone || null}
                onConfirm={async (deliveryData) => {
                    onSetPaymentMethod('DELIVERY');
                    if (onSetNotes) {
                        onSetNotes(`DELIVERY|${deliveryData.recipient_name}|${deliveryData.phone}|${deliveryData.address_line1}|${deliveryData.payment_mode}|zone:${deliveryData.zone ?? 'none'}`);
                    }
                    if (deliveryData.payment_mode === 'IMMEDIATE') {
                        await new Promise(r => setTimeout(r, 200));
                        onCharge();
                    }
                }}
            />
            {isPendingDeliveriesOpen && registerConfig?.sessionId && (
                <POSPendingDeliveriesPanel
                    sessionId={registerConfig.sessionId}
                    currency={currency}
                    onClose={() => setIsPendingDeliveriesOpen(false)}
                />
            )}
        </div>
    );
}
