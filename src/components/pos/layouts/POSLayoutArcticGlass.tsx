// @ts-nocheck
'use client';

/**
 * POSLayoutArcticGlass — 6th POS Layout
 * Design Language: Arctic Glass (sky #0EA5E9 primary) + SF Pro Display typography
 * A clean, modern "Apple-meets-sky" aesthetic. Light glassmorphism, high legibility.
 * Follows the UI Theme Extraction guide with Arctic Glass colors instead of purple.
 */

import { useState, useEffect, useRef } from 'react';
import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { POSToolbar } from '@/components/pos/POSToolbar';
import { MultiPaymentHub } from '@/components/pos/MultiPaymentHub';
import {
    Search, ShoppingCart, X, Plus, Minus, Trash2, User, ChevronDown,
    ArrowLeft, CreditCard, Banknote, Wallet, Building2, FileText,
    RefreshCw, ShieldCheck, MapPin, Wifi, WifiOff, Zap, LayoutGrid
} from 'lucide-react';
import { toast } from 'sonner';

// ── Arctic Glass color tokens ──────────────────────────────────
const AG = {
    sky: '#0EA5E9',
    skyLight: '#BAE6FD',
    skyDark: '#0369A1',
    skyGlow: 'rgba(14,165,233,0.25)',
    bg: '#EFF6FF',          // same as app-theme-engine arctic-glass --app-bg
    surface: 'rgba(255,255,255,0.85)',
    surface2: 'rgba(241,245,249,0.9)',
    border: 'rgba(14,165,233,0.18)',
    text: '#0F172A',
    textMuted: '#475569',
    textFaint: '#94A3B8',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
};

const METHOD_ICONS: Record<string, any> = {
    CASH: Banknote, CARD: CreditCard, WALLET: Wallet,
    WAVE: Zap, OM: Building2, DELIVERY: MapPin, MULTI: LayoutGrid, CHECK: FileText,
};

const formatNumber = (num: number | string) => {
    const val = Number(num) || 0;
    const parts = val.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts[1] === '00' ? parts[0] : parts.join('.');
};

export function POSLayoutArcticGlass(props: POSLayoutProps) {
    const {
        cart, clients, selectedClient, categories,
        sessions, activeSessionId, currency, total, discount, discountType, totalAmount,
        totalPieces, uniqueItems, searchQuery, activeCategoryId, currentParentId,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        isOverrideOpen, isReceiptOpen, lastOrder, highlightedItemId, lastAddedItemId,
        isOnline, clientSearchQuery, deliveryZone, deliveryZones, registerConfig,

        onSetSearchQuery, onSetActiveCategoryId, onSetCurrentParentId, onSetActiveSessionId,
        onSetPaymentMethod, onSetCashReceived, onSetDiscount, onSetDiscountType,
        onSetOverrideOpen, onSetReceiptOpen, onAddToCart,
        onUpdateQuantity, onClearCart, onCreateNewSession, onRemoveSession,
        onUpdateActiveSession, onToggleFullscreen, onCharge,
        onSync, onSetIsOnline, onSetClientSearchQuery, onSetDeliveryZone,
        onOpenLayoutSelector, onSetNotes, onLockRegister, onCloseRegister, onOpenReturn,
        onSearchClients, currentLayout
    } = props;

    const paymentMethods = (registerConfig as any)?.payment_methods || (props as any).paymentMethods || [
        { key: 'CASH', label: 'Cash' }, { key: 'CARD', label: 'Card' },
        { key: 'WALLET', label: 'Wallet' }, { key: 'OM', label: 'OM' },
        { key: 'WAVE', label: 'Wave' }, { key: 'MULTI', label: 'Split' },
    ];

    const receivedNum = Number(cashReceived) || 0;
    const changeDue = receivedNum > totalAmount ? receivedNum - totalAmount : 0;
    const [isMultiPayMode, setIsMultiPayMode] = useState(false);

    return (
        <div
            className="flex flex-col overflow-hidden select-none h-full font-sans transition-all duration-500 relative"
            style={{
                background: AG.bg,
                color: AG.text,
                fontFamily: "'SF Pro Display', 'Inter', system-ui, sans-serif",
                ...(isFullscreen ? { position: 'fixed', inset: 0, zIndex: 1000 } : { position: 'absolute', inset: 0 })
            }}
        >
            {/* Ambient sky glow blobs */}
            <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full pointer-events-none blur-[100px]"
                style={{ background: 'rgba(14,165,233,0.07)' }} />
            <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full pointer-events-none blur-[100px]"
                style={{ background: 'rgba(186,230,253,0.15)' }} />

            {/* ═══ SHARED TOOLBAR ═══ */}
            <POSToolbar
                sessions={sessions} activeSessionId={activeSessionId}
                onSetActiveSessionId={onSetActiveSessionId}
                onCreateNewSession={onCreateNewSession} onRemoveSession={onRemoveSession}
                registerConfig={registerConfig as any}
                selectedClient={selectedClient} clients={clients}
                clientSearchQuery={clientSearchQuery} onSetClientSearchQuery={onSetClientSearchQuery}
                onSelectClient={(id: number) => onUpdateActiveSession({ clientId: id })}
                currency={currency} deliveryZone={deliveryZone} deliveryZones={deliveryZones}
                onSetDeliveryZone={onSetDeliveryZone}
                isOnline={isOnline} isProcessing={isProcessing} isFullscreen={isFullscreen}
                totalPieces={totalPieces} uniqueItems={uniqueItems} currentLayout={currentLayout}
                onSetIsOnline={onSetIsOnline} onSync={onSync} onToggleFullscreen={onToggleFullscreen}
                onOpenLayoutSelector={onOpenLayoutSelector}
                onLockRegister={onLockRegister || (() => { })}
                onCloseRegister={onCloseRegister || (() => { })}
                onOpenReturn={onOpenReturn || (() => { })}
            />

            {/* ═══ CLIENT + SEARCH BAR ═══ */}
            <div className="px-4 py-3 flex items-center gap-3 border-b shrink-0 backdrop-blur-xl relative z-10"
                style={{ background: AG.surface, borderColor: AG.border }}>

                {/* Client Badge */}
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border"
                    style={{ background: AG.bg, borderColor: AG.border, minWidth: 160 }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0"
                        style={{ background: AG.sky }}>
                        {(selectedClient?.name || 'W').substring(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: AG.text }}>
                            {selectedClient?.name || 'Walk-in Customer'}
                        </p>
                        <p className="text-[10px]" style={{ color: AG.textFaint }}>
                            {selectedClient ? `Balance: ${currency}${formatNumber(selectedClient.balance || 0)}` : 'No customer selected'}
                        </p>
                    </div>
                </div>

                {/* Product Search */}
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: AG.textFaint }} />
                    <input
                        type="text"
                        placeholder="Search products by name, barcode, or SKU..."
                        value={searchQuery}
                        onChange={(e) => onSetSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                        style={{
                            background: AG.bg, border: `1px solid ${AG.border}`,
                            color: AG.text, fontFamily: 'inherit'
                        }}
                        onFocus={(e) => e.target.style.borderColor = AG.sky}
                        onBlur={(e) => e.target.style.borderColor = AG.border}
                    />
                </div>

                {/* Delivery Zone */}
                {deliveryZones.length > 0 && (
                    <div className="relative shrink-0">
                        <MapPin size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: AG.textFaint }} />
                        <select
                            value={deliveryZone || ''}
                            onChange={(e) => onSetDeliveryZone(e.target.value)}
                            className="pl-8 pr-8 py-2.5 rounded-xl text-xs outline-none appearance-none cursor-pointer"
                            style={{ background: AG.bg, border: `1px solid ${AG.border}`, color: AG.text }}>
                            {deliveryZones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: AG.textFaint }} />
                    </div>
                )}

                {/* Online status */}
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                    style={{ background: isOnline ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', color: isOnline ? AG.success : AG.error }}>
                    {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
                    <span className="hidden sm:inline">{isOnline ? 'Live' : 'Offline'}</span>
                </div>
            </div>

            {/* ═══ CATEGORY BAR ═══ */}
            <div className="px-4 py-2.5 flex items-center gap-2 border-b shrink-0 overflow-x-auto no-scrollbar"
                style={{ background: 'rgba(255,255,255,0.6)', borderColor: AG.border }}>
                {currentParentId !== null && (
                    <button
                        onClick={() => { onSetCurrentParentId(null); onSetActiveCategoryId(null); }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all"
                        style={{ color: AG.sky, background: 'rgba(14,165,233,0.08)' }}>
                        <ArrowLeft size={13} /> Back
                    </button>
                )}
                <button
                    onClick={() => { onSetActiveCategoryId(null); onSetCurrentParentId(null); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all"
                    style={activeCategoryId === null && currentParentId === null
                        ? { background: AG.sky, color: '#fff', boxShadow: `0 2px 8px ${AG.skyGlow}` }
                        : { background: AG.surface2, color: AG.textMuted, border: `1px solid ${AG.border}` }}>
                    All
                </button>
                {categories
                    .filter(c => currentParentId === null
                        ? !((c as any).parent || (c as any).parent_id)
                        : ((c as any).parent || (c as any).parent_id) === currentParentId
                    )
                    .map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => {
                                onSetActiveCategoryId(cat.id);
                                const hasChildren = categories.some(c => ((c as any).parent || (c as any).parent_id) === cat.id);
                                if (hasChildren) onSetCurrentParentId(cat.id);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all"
                            style={activeCategoryId === cat.id
                                ? { background: AG.sky, color: '#fff', boxShadow: `0 2px 8px ${AG.skyGlow}` }
                                : { background: AG.surface2, color: AG.textMuted, border: `1px solid ${AG.border}` }}>
                            {cat.name}
                        </button>
                    ))}
            </div>

            {/* ═══ MAIN CONTENT: Products + Cart ═══ */}
            <div className="flex-1 flex overflow-hidden relative z-10">

                {/* ─── LEFT: Product Grid 60% ─── */}
                <div className="flex flex-col overflow-hidden border-r" style={{ width: '60%', borderColor: AG.border }}>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <ProductGrid
                            searchQuery={searchQuery}
                            categoryId={activeCategoryId}
                            onAddToCart={onAddToCart}
                            currency={currency}
                            variant="compact"
                        />
                    </div>
                </div>

                {/* ─── RIGHT: Cart + Payment 40% ─── */}
                <div className="flex flex-col overflow-hidden" style={{ width: '40%', background: AG.surface }}>

                    {/* Cart Header */}
                    <div className="px-4 py-3 border-b flex items-center justify-between shrink-0"
                        style={{ borderColor: AG.border }}>
                        <div className="flex items-center gap-2">
                            <ShoppingCart size={16} style={{ color: AG.sky }} />
                            <span className="text-sm font-semibold" style={{ color: AG.text }}>Order</span>
                            {cart.length > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                                    style={{ background: AG.sky }}>
                                    {uniqueItems}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs" style={{ color: AG.textFaint }}>{totalPieces} items</span>
                            {cart.length > 0 && (
                                <button onClick={() => onClearCart(false)}
                                    className="p-1.5 rounded-lg transition-all"
                                    style={{ color: AG.textFaint }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = AG.error}
                                    onMouseLeave={(e) => e.currentTarget.style.color = AG.textFaint}>
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                                <ShoppingCart size={40} strokeWidth={1.5} style={{ color: AG.textFaint, opacity: 0.4 }} />
                                <div>
                                    <p className="text-sm font-medium" style={{ color: AG.textMuted }}>Cart is empty</p>
                                    <p className="text-xs mt-0.5" style={{ color: AG.textFaint }}>Add products to get started</p>
                                </div>
                            </div>
                        ) : (
                            cart.map((item: any) => (
                                <div key={item.productId}
                                    className="flex items-center gap-2 p-3 rounded-xl border transition-all duration-200"
                                    style={{
                                        background: highlightedItemId === item.productId ? 'rgba(14,165,233,0.08)' : 'rgba(255,255,255,0.8)',
                                        borderColor: highlightedItemId === item.productId ? AG.sky : AG.border,
                                        boxShadow: highlightedItemId === item.productId ? `0 0 0 1px ${AG.sky}` : 'none',
                                    }}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: AG.text }}>{item.name}</p>
                                        <p className="text-xs mt-0.5" style={{ color: AG.textFaint }}>
                                            {currency}{Number(item.price).toFixed(2)} × {item.quantity}
                                        </p>
                                    </div>

                                    {/* Qty Controls */}
                                    <div className="flex items-center gap-1 rounded-lg p-1"
                                        style={{ background: AG.bg, border: `1px solid ${AG.border}` }}>
                                        <button onClick={() => onUpdateQuantity(item.productId, -1)}
                                            className="w-6 h-6 rounded-md flex items-center justify-center transition-all text-xs"
                                            style={{ color: AG.textMuted }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = AG.skyLight; e.currentTarget.style.color = AG.skyDark; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = AG.textMuted; }}>
                                            <Minus size={10} strokeWidth={2.5} />
                                        </button>
                                        <span className="w-6 text-center text-xs font-semibold tabular-nums" style={{ color: AG.text }}>
                                            {item.quantity}
                                        </span>
                                        <button onClick={() => onUpdateQuantity(item.productId, 1)}
                                            className="w-6 h-6 rounded-md flex items-center justify-center transition-all"
                                            onMouseEnter={(e) => { e.currentTarget.style.background = AG.skyLight; e.currentTarget.style.color = AG.skyDark; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = AG.textMuted; }}>
                                            <Plus size={10} strokeWidth={2.5} style={{ color: AG.textMuted }} />
                                        </button>
                                    </div>

                                    {/* Line total */}
                                    <span className="text-sm font-semibold w-16 text-right tabular-nums"
                                        style={{ color: AG.sky }}>
                                        {currency}{formatNumber(Number(item.price) * item.quantity)}
                                    </span>

                                    <button onClick={() => onUpdateQuantity(item.productId, -100)}
                                        className="p-1 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        style={{ color: AG.textFaint }}
                                        onMouseEnter={(e) => e.currentTarget.style.color = AG.error}
                                        onMouseLeave={(e) => e.currentTarget.style.color = AG.textFaint}>
                                        <X size={12} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* ─── PAYMENT PANEL ─── */}
                    <div className="shrink-0 border-t p-4 space-y-4" style={{ borderColor: AG.border, background: 'rgba(255,255,255,0.95)' }}>

                        {/* Subtotal + Discount row */}
                        <div className="flex items-center justify-between">
                            <div className="text-xs" style={{ color: AG.textMuted }}>
                                Subtotal: <span className="font-medium" style={{ color: AG.text }}>{currency}{formatNumber(total)}</span>
                                {discount > 0 && (
                                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold"
                                        style={{ background: 'rgba(245,158,11,0.1)', color: AG.warning }}>
                                        -{discountType === 'fixed' ? currency : ''}{formatNumber(discount)}{discountType === 'percentage' ? '%' : ''}
                                    </span>
                                )}
                            </div>
                            <div className="text-xl font-semibold tabular-nums" style={{ color: AG.text }}>
                                <span className="text-sm mr-1" style={{ color: AG.textFaint }}>{currency}</span>
                                {formatNumber(totalAmount)}
                            </div>
                        </div>

                        {/* Payment Method Pills */}
                        <div className="grid grid-cols-3 gap-1.5">
                            {paymentMethods.map((m: any) => {
                                const key = typeof m === 'string' ? m : m.key;
                                const label = typeof m === 'string' ? m : (m.label || key);
                                const isLinked = ['MULTI', 'DELIVERY', 'CREDIT'].includes(key) || (typeof m === 'object' && m.accountId);
                                const isActive = paymentMethod === key;
                                const Icon = METHOD_ICONS[key] || Banknote;
                                return (
                                    <button key={key}
                                        disabled={!isLinked}
                                        onClick={() => {
                                            if (key === 'MULTI') setIsMultiPayMode(true);
                                            else if (isLinked) onSetPaymentMethod(key);
                                        }}
                                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition-all"
                                        style={!isLinked
                                            ? { background: AG.bg, borderColor: AG.border, color: AG.textFaint, opacity: 0.4, cursor: 'not-allowed' }
                                            : isActive
                                                ? { background: AG.sky, borderColor: AG.sky, color: '#fff', boxShadow: `0 2px 10px ${AG.skyGlow}` }
                                                : { background: AG.bg, borderColor: AG.border, color: AG.textMuted }}>
                                        <Icon size={12} />
                                        <span>{label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Cash Received Input */}
                        <div className="relative">
                            <label className="absolute -top-2 left-3 text-[10px] font-medium px-1"
                                style={{ color: AG.textFaint, background: 'rgba(255,255,255,0.95)' }}>
                                Amount Received
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="0.00"
                                value={cashReceived ? cashReceived.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''}
                                onChange={(e) => {
                                    const raw = e.target.value.replace(/\s+/g, '').replace(',', '.');
                                    if (raw === '' || /^\d*\.?\d*$/.test(raw)) onSetCashReceived(raw);
                                }}
                                className="w-full px-4 py-3 rounded-xl text-base font-semibold text-right outline-none transition-all tabular-nums"
                                style={{
                                    background: AG.bg, border: `1.5px solid ${AG.border}`,
                                    color: AG.text, fontFamily: 'inherit'
                                }}
                                onFocus={(e) => e.target.style.borderColor = AG.sky}
                                onBlur={(e) => e.target.style.borderColor = AG.border}
                            />
                        </div>

                        {/* Change display */}
                        {changeDue > 0 && (
                            <div className="flex items-center justify-between px-3 py-2 rounded-xl"
                                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                <span className="text-xs font-medium" style={{ color: AG.success }}>Change Due</span>
                                <span className="text-sm font-bold tabular-nums" style={{ color: AG.success }}>
                                    {currency}{formatNumber(changeDue)}
                                </span>
                            </div>
                        )}

                        {/* Charge Button */}
                        <button
                            onClick={() => onCharge()}
                            disabled={isProcessing || cart.length === 0}
                            className="w-full h-14 rounded-2xl flex items-center justify-between px-5 transition-all duration-300 font-semibold"
                            style={cart.length > 0 && !isProcessing
                                ? {
                                    background: `linear-gradient(135deg, ${AG.sky} 0%, ${AG.skyDark} 100%)`,
                                    color: '#fff',
                                    boxShadow: `0 4px 20px ${AG.skyGlow}`,
                                    transform: 'scale(1)',
                                }
                                : { background: AG.surface2, color: AG.textFaint, cursor: 'not-allowed', border: `1px solid ${AG.border}` }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                    style={{ background: 'rgba(255,255,255,0.2)' }}>
                                    {isProcessing
                                        ? <RefreshCw size={18} className="animate-spin" />
                                        : <ShieldCheck size={20} />}
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] opacity-70 font-medium">
                                        {isProcessing ? 'Processing...' : changeDue > 0 ? 'Give Change' : 'Charge'}
                                    </p>
                                    <p className="text-base leading-none font-semibold">
                                        {isProcessing ? '...' : changeDue > 0 ? 'Complete' : 'Pay Now'}
                                    </p>
                                </div>
                            </div>
                            <span className="text-lg font-bold tabular-nums">
                                {currency}{formatNumber(changeDue > 0 ? changeDue : totalAmount)}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Modals ─── */}
            <ManagerOverride
                isOpen={isOverrideOpen} onClose={() => onSetOverrideOpen(false)}
                onOverrideApproved={(discount, type) => { onSetDiscount(discount); onSetDiscountType(type); onSetOverrideOpen(false); }}
            />
            <ReceiptModal
                isOpen={isReceiptOpen} onClose={() => onSetReceiptOpen(false)}
                orderId={lastOrder?.id || null} refCode={lastOrder?.ref || null}
            />
            <MultiPaymentHub
                isOpen={isMultiPayMode} onClose={() => setIsMultiPayMode(false)}
                totalAmount={totalAmount} currency={currency}
                paymentMethods={paymentMethods} client={selectedClient}
                isProcessing={isProcessing}
                allowedAccounts={(registerConfig as any)?.allowedAccounts || []}
                onConfirm={(legs: { method: string; amount: number }[]) => {
                    const legsNote = legs.map(l => `${l.method}:${l.amount.toFixed(2)}`).join(' | ');
                    if (onSetNotes) onSetNotes(legsNote);
                    if ((props as any).onSetPaymentLegs) (props as any).onSetPaymentLegs(legs);
                    const totalPaid = legs.reduce((s, l) => s + l.amount, 0);
                    onSetCashReceived(String(totalPaid));
                    const first = legs[0]?.method;
                    if (first) onSetPaymentMethod(first);
                    setIsMultiPayMode(false);
                    setTimeout(() => onCharge(false, { paymentLegs: legs, notes: legsNote, paymentMethod: first || 'CASH', cashReceived: String(totalPaid) }), 300);
                }}
            />
        </div>
    );
}
