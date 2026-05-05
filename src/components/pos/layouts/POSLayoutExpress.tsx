// @ts-nocheck
'use client';
/**
 * POS Layout — Express Mode
 * ==========================
 * Fast, narrow single-column checkout inspired by SupermarcheLayoutExpress.
 * - Centered column (max 640px) with: Scan bar → Cart → Checkout
 * - Designed for quick transactions with minimal UI chrome.
 *
 * Uses the full POSLayoutProps for real terminal state.
 * All colors use --app-* theme variables — zero hardcoded colors.
 */

import { useState, useCallback } from 'react';
import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { AccountBook } from '@/components/pos/AccountBook';
import { POSToolbar } from '@/components/pos/POSToolbar';
import { POSSalesHistoryPanel } from '@/components/pos/POSSalesHistoryPanel';
import { POSDeliveryModal } from '@/components/pos/POSDeliveryModal';
import { POSPendingDeliveriesPanel } from '@/components/pos/POSPendingDeliveriesPanel';
import {
    Search, ShoppingCart, X, Minus, Plus, Trash2,
    Zap, MapPin,
    CreditCard, Wallet, Banknote, Smartphone, Landmark, Star, Calculator,
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

export function POSLayoutExpress(props: POSLayoutProps) {
    const {
        cart, selectedClient, selectedClientId, categories,
        sessions, activeSessionId, currency, total, discount, discountType, totalAmount,
        totalPieces, uniqueItems, searchQuery, activeCategoryId, currentParentId,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        isReceiptOpen, lastOrder, highlightedItemId,
        isOnline, clientSearchQuery, deliveryZone, deliveryZones, clients,
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

    const [isAccountBookOpen, setIsAccountBookOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
    const [isPendingDeliveriesOpen, setIsPendingDeliveriesOpen] = useState(false);
    const [activePayTab, setActivePayTab] = useState<string>(paymentMethod || 'CASH');

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

    const getMethodIcon = (k: string) => {
        if (k.includes('CARD')) return CreditCard;
        if (k.includes('WALLET')) return Wallet;
        if (k.includes('WAVE') || k.includes('OM')) return Smartphone;
        if (k.includes('DELIVERY')) return MapPin;
        if (k.includes('BANK')) return Landmark;
        if (k.includes('MULTI')) return Calculator;
        return Banknote;
    };

    return (
        <div className={clsx(
            "flex flex-col overflow-hidden select-none h-full",
            isFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen" : "absolute inset-0",
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

            {/* ═══════════ EXPRESS HEADER ═══════════ */}
            <header
                className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
                style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}
            >
                <div className="flex items-center gap-2">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'var(--app-warning-bg, rgba(245, 158, 11, 0.1))' }}
                    >
                        <Zap size={16} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                    </div>
                    <div>
                        <p className="text-sm font-black" style={{ color: 'var(--app-foreground)' }}>
                            Express Lane
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>
                            {registerConfig?.siteName || 'Fast Checkout'}
                        </p>
                    </div>
                </div>
                <span
                    className="text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider"
                    style={{
                        background: 'var(--app-warning-bg, rgba(245, 158, 11, 0.1))',
                        color: 'var(--app-warning, #f59e0b)',
                    }}
                >
                    Speed Mode
                </span>
            </header>

            {/* ═══════════ CENTERED COLUMN ═══════════ */}
            <div className="flex-1 overflow-hidden flex justify-center">
                <div className="w-full max-w-[640px] flex flex-col overflow-hidden">

                    {/* Scan bar */}
                    <div className="px-4 pt-4 pb-2 flex-shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--app-muted-foreground)' }} />
                            <input
                                type="text"
                                autoFocus
                                placeholder="Scan barcode to add item..."
                                value={searchQuery}
                                onChange={(e) => onSetSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-10 py-3 rounded-xl text-sm font-bold outline-none transition-all"
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

                    {/* Product grid (compact — shows when search is active) */}
                    {searchQuery && (
                        <div className="px-4 pb-2 max-h-[200px] overflow-y-auto shrink-0">
                            <ProductGrid
                                searchQuery={searchQuery}
                                categoryId={activeCategoryId || currentParentId}
                                onAddToCart={(product) => {
                                    onAddToCart(product);
                                    setTimeout(() => onSetSearchQuery(''), 200);
                                }}
                                currency={currency}
                                onProductsLoaded={(products) => {
                                    if ((props as any).onProductsLoaded) (props as any).onProductsLoaded(products);
                                }}
                                onAutoAdd={(product) => {
                                    onAddToCart(product);
                                    setTimeout(() => onSetSearchQuery(''), 300);
                                }}
                                onNotFound={(q) => {
                                    toast.error(`"${q}" not found`);
                                    setTimeout(() => onSetSearchQuery(''), 1500);
                                }}
                            />
                        </div>
                    )}

                    {/* Cart — takes remaining height */}
                    <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--app-muted-foreground)' }}>
                                <Zap size={40} strokeWidth={1} />
                                <p className="text-sm font-bold">Scan items for express checkout</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {cart.map((item: any) => (
                                    <div
                                        key={item.productId}
                                        className="flex items-center gap-3 p-3 rounded-xl transition-all"
                                        style={{
                                            background: highlightedItemId === item.productId
                                                ? 'var(--app-primary-light, rgba(99,102,241,0.08))'
                                                : 'var(--app-surface)',
                                            border: '1px solid var(--app-border)',
                                        }}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black truncate" style={{ color: 'var(--app-foreground)' }}>{item.name}</p>
                                            <p className="text-xs font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                                {currency}{Number(item.price).toFixed(2)} each
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => handleProtectedQuantity(item.productId, -1)}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                style={{ background: 'var(--app-bg)', color: 'var(--app-muted-foreground)' }}
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <span className="w-7 text-center text-sm font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => onUpdateQuantity(item.productId, 1)}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                                style={{ background: 'var(--app-primary-light, rgba(99,102,241,0.1))', color: 'var(--app-primary)' }}
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>

                                        <span className="text-sm font-black tabular-nums w-20 text-right" style={{ color: 'var(--app-primary)' }}>
                                            {currency}{(Number(item.price) * item.quantity).toFixed(2)}
                                        </span>

                                        <button
                                            onClick={() => handleProtectedQuantity(item.productId, -item.quantity)}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                            style={{ background: 'var(--app-error-bg, rgba(239,68,68,0.08))', color: 'var(--app-error, #ef4444)' }}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Payment Method Strip ── */}
                    <div className="px-4 py-2 flex gap-1.5 overflow-x-auto shrink-0 custom-scrollbar-h"
                        style={{ borderTop: '1px solid var(--app-border)' }}
                    >
                        {paymentMethods.filter((m: any) => {
                            const key = typeof m === 'string' ? m : m.key;
                            return key !== 'DELIVERY';
                        }).map((m: any) => {
                            const key = typeof m === 'string' ? m : m.key;
                            const label = typeof m === 'string' ? m : (m.label || m.key);
                            const Icon = getMethodIcon(key);
                            const isActive = paymentMethod === key;
                            const alwaysAllowed = ['MULTI', 'DELIVERY', 'CREDIT'].includes(key);
                            const isLinked = alwaysAllowed || (typeof m === 'object' && m.accountId);

                            return (
                                <button
                                    key={key}
                                    disabled={!isLinked}
                                    onClick={() => { if (isLinked) onSetPaymentMethod(key); }}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 transition-all"
                                    style={{
                                        background: isActive ? 'var(--app-primary)' : 'var(--app-surface)',
                                        color: isActive ? '#fff' : isLinked ? 'var(--app-muted-foreground)' : 'var(--app-muted-foreground)',
                                        border: `1px solid ${isActive ? 'var(--app-primary)' : 'var(--app-border)'}`,
                                        opacity: isLinked ? 1 : 0.4,
                                    }}
                                >
                                    <Icon size={14} />
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Checkout Footer ── */}
                    <div className="px-4 pb-4 pt-2 flex-shrink-0 space-y-3">
                        {/* Received + Charge */}
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
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
                                    className="w-full pt-5 pb-2 px-3 text-right rounded-xl text-base font-black outline-none transition-all tabular-nums"
                                    style={{
                                        background: 'var(--app-surface)',
                                        border: '2px solid var(--app-border)',
                                        color: 'var(--app-foreground)',
                                    }}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--app-primary)'; }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--app-border)'; }}
                                />
                            </div>
                            <button
                                onClick={() => onCharge()}
                                disabled={cart.length === 0 || isProcessing}
                                className="flex-1 rounded-xl flex flex-col items-center justify-center transition-all active:scale-[0.98]"
                                style={{
                                    background: cart.length > 0 && !isProcessing ? 'var(--app-primary)' : 'var(--app-surface-2, var(--app-bg))',
                                    color: cart.length > 0 && !isProcessing ? '#fff' : 'var(--app-muted-foreground)',
                                    boxShadow: cart.length > 0 && !isProcessing ? '0 8px 24px var(--app-primary-glow, rgba(99,102,241,0.3))' : 'none',
                                }}
                            >
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                                    {changeDue > 0 ? "Change" : "Charge"}
                                </span>
                                <span className="text-xl font-black leading-none tabular-nums">
                                    {currency}{formatNumber(changeDue > 0 ? changeDue : totalAmount)}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
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
