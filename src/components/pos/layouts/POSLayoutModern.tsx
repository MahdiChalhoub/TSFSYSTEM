'use client';

import { useState } from 'react';
import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CompactClientHeader } from '@/components/pos/CompactClientHeader';
import { CartTotals } from '@/components/pos/CartTotals';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import {
    Search, ShoppingCart, Plus, Minus, Trash2, X, Layout, User,
    ChevronDown, Maximize, Minimize, FileText, Settings, Wallet,
    Save, Book, File, ArrowLeft, Eye, EyeOff, Package, Tag,
    CreditCard, Banknote
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════
 * MODERN POS — Redesigned (Per User Wireframe)
 * ┌──────────────────────────────────────────────────────────────┐
 * │ HEADER (full width)                                          │
 * ├─────────────────────────────┬────────────────────────────────┤
 * │ Client Info                 │                                │
 * ├─────────────────────────────┤         CART                   │
 * │ Search + Category Pills     │    (full height from           │
 * ├─────────────┬───────────────┤     header to bottom)          │
 * │ Category    │ Payment &     │                                │
 * │ Tiles       │ Finalize      │     items, qty, tax,           │
 * │             │               │     totals                     │
 * │             │               │                                │
 * │ When expanded → Products    │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
 * │ (payment hides)             │  Subtotal · Discount · Cash    │
 * │                             │  [████ CHARGE ████]            │
 * └─────────────┴───────────────┴────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════ */

export function POSLayoutModern(props: POSLayoutProps) {
    const {
        cart, clients, selectedClient, selectedClientId, categories,
        sessions, activeSessionId, currency, total, discount, totalAmount,
        totalPieces, uniqueItems, searchQuery, activeCategoryId, sidebarMode,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        isOverrideOpen, isReceiptOpen, lastOrder,
        onSetSearchQuery, onSetActiveCategoryId, onSetActiveSessionId,
        onSetPaymentMethod, onSetCashReceived, onSetDiscount, onAddToCart, onUpdateQuantity,
        onClearCart, onCreateNewSession, onRemoveSession, onUpdateActiveSession,
        onToggleFullscreen, onCycleSidebarMode, onCharge,
        onSetOverrideOpen, onSetReceiptOpen, onOpenLayoutSelector
    } = props;

    const receivedNum = Number(cashReceived) || 0;
    const changeDue = receivedNum > totalAmount ? receivedNum - totalAmount : 0;
    const [leftExpanded, setLeftExpanded] = useState(false);

    return (
        <div className={clsx(
            "flex flex-col overflow-hidden select-none h-full",
            isFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen bg-[#f4f6f8]" : "absolute inset-0 bg-[#f4f6f8]"
        )}>

            {/* ═══════════ HEADER — FULL WIDTH ═══════════ */}
            <header className="h-[52px] bg-white border-b border-gray-200/80 flex items-center justify-between px-4 shrink-0 z-50 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-extrabold tracking-tight text-gray-900 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                            <ShoppingCart size={16} className="text-white" />
                        </div>
                        <span>POS</span>
                    </h1>

                    {/* Session Tabs */}
                    <div className="flex gap-1 ml-2 overflow-x-auto max-w-md no-scrollbar">
                        {sessions.map(s => (
                            <div key={s.id} className="flex shrink-0 group">
                                <button
                                    onClick={() => onSetActiveSessionId(s.id)}
                                    className={clsx(
                                        "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                        activeSessionId === s.id
                                            ? "bg-emerald-500 text-white shadow-md"
                                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                    )}
                                >
                                    <ShoppingCart size={11} />
                                    {s.name}
                                </button>
                                <button onClick={() => onRemoveSession(s.id)} className="ml-[-4px] p-0.5 text-gray-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100">
                                    <X size={9} />
                                </button>
                            </div>
                        ))}
                        <button onClick={onCreateNewSession} className="w-7 h-7 flex items-center justify-center bg-gray-100 text-gray-400 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-all">
                            <Plus size={13} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <button onClick={onToggleFullscreen} className="h-8 px-3 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-all flex items-center gap-1.5">
                        {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
                        {isFullscreen ? 'Exit' : 'Fullscreen'}
                    </button>
                    <button onClick={onOpenLayoutSelector} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg text-gray-500 hover:bg-gray-200 transition-all" title="Switch Layout">
                        <Layout size={14} />
                    </button>
                </div>
            </header>

            {/* ═══════════ MAIN SPLIT — LEFT + RIGHT (CART FULL HEIGHT) ═══════════ */}
            <div className="flex-1 flex overflow-hidden">

                {/* ════ LEFT COLUMN ════ */}
                <aside className={clsx(
                    "flex flex-col bg-white border-r border-gray-200/80 shrink-0 transition-all duration-300 overflow-hidden",
                    leftExpanded ? "w-[62%]" : "w-[62%]"
                )}>

                    {/* ── Client Info Bar ── */}
                    <div className="px-4 py-2.5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                    {selectedClient?.name?.charAt(0) || 'C'}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={selectedClientId}
                                            onChange={(e) => onUpdateActiveSession({ clientId: Number(e.target.value) })}
                                            className="text-sm font-bold text-gray-900 bg-transparent border-none outline-none cursor-pointer appearance-none pr-4"
                                        >
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <ChevronDown size={12} className="text-gray-400 -ml-3" />
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                                        <span>{selectedClient?.phone || '—'}</span>
                                        <span className="text-emerald-500 font-semibold">Balance: {currency}{(selectedClient?.balance || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="bg-gray-100 px-2.5 py-1 rounded-md font-medium">{uniqueItems} items</span>
                                <span className="bg-gray-100 px-2.5 py-1 rounded-md font-medium">{totalPieces} pcs</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Search + Category Pills ── */}
                    <div className="px-4 py-2.5 border-b border-gray-100 space-y-2 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                            <input
                                type="text"
                                placeholder="Search products, scan barcode..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition-all"
                                value={searchQuery}
                                onChange={(e) => onSetSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                            <button
                                onClick={() => onSetActiveCategoryId(null)}
                                className={clsx(
                                    "px-3 py-1 whitespace-nowrap rounded-full text-xs font-semibold transition-all",
                                    activeCategoryId === null
                                        ? 'bg-emerald-500 text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                )}
                            >
                                All
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => onSetActiveCategoryId(cat.id)}
                                    className={clsx(
                                        "px-3 py-1 whitespace-nowrap rounded-full text-xs font-semibold transition-all",
                                        activeCategoryId === cat.id
                                            ? 'bg-emerald-500 text-white shadow-sm'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Toggle Bar ── */}
                    <div className="px-4 py-1.5 border-b border-gray-50 flex items-center justify-between shrink-0 bg-gray-50/50">
                        <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            {leftExpanded ? 'Products' : 'Quick Access'}
                        </span>
                        <button
                            onClick={() => setLeftExpanded(!leftExpanded)}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                        >
                            {leftExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
                            {leftExpanded ? 'Show Categories' : 'Browse Products'}
                        </button>
                    </div>

                    {/* ── Expanded: Product Grid ── */}
                    {leftExpanded && (
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/30">
                            <ProductGrid
                                searchQuery={searchQuery}
                                categoryId={activeCategoryId}
                                onAddToCart={onAddToCart}
                                currency={currency}
                            />
                        </div>
                    )}

                    {/* ── Collapsed: Categories + Payment SIDE BY SIDE ── */}
                    {!leftExpanded && (
                        <div className="flex-1 flex overflow-hidden">
                            {/* LEFT: Category Tiles */}
                            <div className="w-1/2 border-r border-gray-100 p-3 overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => { onSetActiveCategoryId(null); setLeftExpanded(true); }}
                                        className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 text-center group hover:shadow-md hover:border-emerald-200 transition-all"
                                    >
                                        <Package size={20} className="mx-auto text-emerald-500 mb-1.5" />
                                        <span className="text-xs font-semibold text-gray-700">All Products</span>
                                    </button>
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => { onSetActiveCategoryId(cat.id); setLeftExpanded(true); }}
                                            className={clsx(
                                                "p-3 rounded-xl border text-center group hover:shadow-md transition-all",
                                                activeCategoryId === cat.id
                                                    ? "bg-emerald-50 border-emerald-200"
                                                    : "bg-white border-gray-100 hover:border-emerald-100"
                                            )}
                                        >
                                            <Tag size={16} className={clsx("mx-auto mb-1.5", activeCategoryId === cat.id ? "text-emerald-500" : "text-gray-300 group-hover:text-emerald-400")} />
                                            <span className="text-xs font-semibold text-gray-700">{cat.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* RIGHT: Payment & Finalize */}
                            <div className="w-1/2 p-3 overflow-y-auto custom-scrollbar bg-gray-50/30">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Payment</h4>
                                <CartTotals
                                    subtotal={total}
                                    discount={discount}
                                    totalAmount={totalAmount}
                                    cashReceived={cashReceived}
                                    paymentMethod={paymentMethod}
                                    isPending={isProcessing}
                                    currency={currency}
                                    onSetCashReceived={onSetCashReceived}
                                    onSetPaymentMethod={onSetPaymentMethod}
                                    onCharge={onCharge}
                                    onDiscountClick={() => onSetOverrideOpen(true)}
                                />
                            </div>
                        </div>
                    )}
                </aside>

                {/* ════ RIGHT COLUMN: CART (FULL HEIGHT from header to bottom) ════ */}
                <main className="flex-1 flex flex-col bg-[#fafbfc] overflow-hidden">

                    {/* Cart Header */}
                    <div className="px-4 py-2.5 border-b border-gray-200/80 bg-white flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <h2 className="text-sm font-bold text-gray-900">Order</h2>
                            <span className="text-xs text-gray-400 font-medium ml-1">{uniqueItems} lines · {totalPieces} pcs</span>
                        </div>
                        {cart.length > 0 && (
                            <button onClick={onClearCart} className="text-xs text-gray-400 hover:text-rose-500 font-medium transition-colors">
                                Clear All
                            </button>
                        )}
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3">
                                <ShoppingCart size={44} strokeWidth={1} className="text-gray-200" />
                                <p className="text-sm font-medium text-gray-400">No items in cart</p>
                                <p className="text-xs text-gray-400">Browse products to start adding</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100/80">
                                {cart.map((item: any, idx: number) => (
                                    <div key={item.productId} className="px-4 py-3 group hover:bg-white transition-colors">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-300 font-mono w-4">{idx + 1}</span>
                                                    <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 ml-6">
                                                    <span className="text-xs text-gray-400">{currency}{Number(item.price).toFixed(2)} × {item.quantity}</span>
                                                    {(item.taxRate || 0) > 0 && (
                                                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-medium">Tax {item.taxRate}%</span>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm font-bold text-gray-900 tabular-nums shrink-0">
                                                {currency}{(Number(item.price) * item.quantity).toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between mt-2 ml-6">
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => onUpdateQuantity(item.productId, -1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center text-gray-400 transition-all active:scale-90">
                                                    <Minus size={12} />
                                                </button>
                                                <span className="w-9 text-center text-sm font-bold tabular-nums text-gray-900">{item.quantity}</span>
                                                <button onClick={() => onUpdateQuantity(item.productId, 1)} className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-all active:scale-90">
                                                    <Plus size={12} />
                                                </button>
                                            </div>
                                            <button onClick={() => onUpdateQuantity(item.productId, -100)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-rose-500 transition-all p-1">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Cart Footer: Totals + Payment + Charge ── */}
                    <div className="border-t border-gray-200 bg-white shrink-0">
                        <div className="px-4 py-3 space-y-1.5">
                            {/* Subtotal */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Subtotal</span>
                                <span className="text-sm font-semibold tabular-nums">{currency}{total.toFixed(2)}</span>
                            </div>
                            {/* Discount */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Discount</span>
                                <div className="relative w-24">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-amber-500">{currency}</span>
                                    <input
                                        type="number" min="0" step="0.01"
                                        value={discount || ''}
                                        onChange={(e) => onSetDiscount(Math.max(0, Number(e.target.value) || 0))}
                                        placeholder="0.00"
                                        className="w-full pl-5 pr-2 py-1 text-right bg-amber-50/50 border border-gray-200 rounded-md text-sm font-semibold tabular-nums text-amber-600 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 transition-all"
                                    />
                                </div>
                            </div>
                            {/* Divider + Total */}
                            <div className="border-t border-gray-100 pt-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-base font-bold text-gray-900">Total</span>
                                    <span className="text-xl font-extrabold tabular-nums text-gray-900">{currency}{totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                            {/* Cash Received */}
                            <div className="flex items-center justify-between pt-0.5">
                                <span className="text-sm text-gray-500">Cash Received</span>
                                <div className="relative w-28">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{currency}</span>
                                    <input
                                        type="number" min="0" step="0.01"
                                        value={cashReceived}
                                        onChange={(e) => onSetCashReceived(e.target.value)}
                                        placeholder={totalAmount.toFixed(2)}
                                        className="w-full pl-5 pr-2 py-1 text-right bg-gray-50 border border-gray-200 rounded-md text-sm font-semibold tabular-nums outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 transition-all"
                                    />
                                </div>
                            </div>
                            {/* Change Due */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Change</span>
                                <span className={clsx(
                                    "text-sm font-bold tabular-nums",
                                    changeDue > 0 ? "text-emerald-600" : "text-gray-400"
                                )}>{currency}{changeDue.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Payment Methods */}
                        <div className="px-4 pb-2">
                            <div className="flex gap-1.5">
                                {[
                                    { key: 'CASH', label: 'Cash', icon: Banknote },
                                    { key: 'CARD', label: 'Card', icon: CreditCard },
                                    { key: 'WALLET', label: 'Wallet', icon: Wallet },
                                ].map(m => (
                                    <button
                                        key={m.key}
                                        onClick={() => onSetPaymentMethod(m.key)}
                                        className={clsx(
                                            "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                                            paymentMethod === m.key
                                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                                : "bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300"
                                        )}
                                    >
                                        <m.icon size={13} />
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Charge Button */}
                        <div className="px-4 pb-3 pt-1">
                            <button
                                onClick={onCharge}
                                disabled={cart.length === 0 || isProcessing}
                                className={clsx(
                                    "w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                                    cart.length > 0 && !isProcessing
                                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600 active:scale-[0.98]"
                                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                )}
                            >
                                {isProcessing ? 'Processing...' : `Charge ${currency}${totalAmount.toFixed(2)}`}
                            </button>
                        </div>
                    </div>
                </main>
            </div>

            {/* Modals */}
            <ManagerOverride
                isOpen={isOverrideOpen}
                actionLabel="Authorize Change"
                onClose={() => onSetOverrideOpen(false)}
                onSuccess={() => toast.success("Action authorized")}
            />
            <ReceiptModal
                isOpen={isReceiptOpen}
                onClose={() => onSetReceiptOpen(false)}
                orderId={lastOrder?.id || null}
                refCode={lastOrder?.ref || null}
            />
        </div>
    );
}
