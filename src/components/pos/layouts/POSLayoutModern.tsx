'use client';

import { useState } from 'react';
import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import {
    Search, ShoppingCart, Plus, Minus, Trash2, X, Layout,
    ChevronDown, Maximize, Minimize, Eye, EyeOff, Package, Tag,
    CreditCard, Banknote, Wallet, MapPin, Star
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════
 * MODERN POS — Per User Wireframe
 * ┌──────────────────────────────────────────────────────────────┐
 * │ HEADER (full width)                                          │
 * ├─────────────────────────────┬────────────────────────────────┤
 * │ Client (name,addr,zone,loy) │  Order header                 │
 * ├─────────────────────────────┤  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
 * │ Search + Category Pills     │  Compact item rows            │
 * ├─────────────────────────────┤  (name, price, qty, tax, tot) │
 * │ Category Tiles (only)       │                                │
 * │  OR expanded → Products     │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
 * │                             │  Subtotal · Discount · Total   │
 * │                             │  Cash/Card/Wallet              │
 * │                             │  Cash Received + Charge        │
 * └─────────────────────────────┴────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════ */

export function POSLayoutModern(props: POSLayoutProps) {
    const {
        cart, clients, selectedClient, selectedClientId, categories,
        sessions, activeSessionId, currency, total, discount, discountType, totalAmount,
        totalPieces, uniqueItems, searchQuery, activeCategoryId, sidebarMode,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        isOverrideOpen, isReceiptOpen, lastOrder, highlightedItemId, lastAddedItemId,
        onSetSearchQuery, onSetActiveCategoryId, onSetActiveSessionId,
        onSetPaymentMethod, onSetCashReceived, onSetDiscount, onSetDiscountType, onAddToCart, onUpdateQuantity,
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

            {/* ═══════════ HEADER ═══════════ */}
            <header className="h-[48px] bg-white border-b border-gray-200/80 flex items-center justify-between px-4 shrink-0 z-50 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                            <ShoppingCart size={14} className="text-white" />
                        </div>
                        <span className="text-base font-extrabold tracking-tight text-gray-900">POS</span>
                    </div>
                    {/* Session Tabs */}
                    <div className="flex gap-1 ml-1 overflow-x-auto max-w-md no-scrollbar">
                        {sessions.map(s => (
                            <div key={s.id} className="flex shrink-0 group">
                                <button
                                    onClick={() => onSetActiveSessionId(s.id)}
                                    className={clsx(
                                        "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                                        activeSessionId === s.id
                                            ? "bg-emerald-500 text-white shadow-sm"
                                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                    )}
                                >
                                    <ShoppingCart size={10} />
                                    {s.name}
                                </button>
                                <button onClick={() => onRemoveSession(s.id)} className="ml-[-2px] p-0.5 text-gray-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100">
                                    <X size={8} />
                                </button>
                            </div>
                        ))}
                        <button onClick={onCreateNewSession} className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-400 rounded-md hover:bg-emerald-50 hover:text-emerald-600 transition-all">
                            <Plus size={12} />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="bg-gray-100 px-2 py-0.5 rounded font-semibold">{uniqueItems} items</span>
                    <span className="bg-gray-100 px-2 py-0.5 rounded font-semibold">{totalPieces} pcs</span>
                    <button onClick={onToggleFullscreen} className="h-7 px-2 bg-gray-100 text-gray-600 rounded-md text-[11px] font-semibold hover:bg-gray-200 transition-all flex items-center gap-1">
                        {isFullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
                    </button>
                    <button onClick={onOpenLayoutSelector} className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-md text-gray-500 hover:bg-gray-200 transition-all">
                        <Layout size={13} />
                    </button>
                </div>
            </header>

            {/* ═══════════ MAIN SPLIT ═══════════ */}
            <div className="flex-1 flex overflow-hidden">

                {/* ════ LEFT COLUMN (62%) ════ */}
                <aside className="w-[62%] flex flex-col bg-white border-r border-gray-200/80 shrink-0 overflow-hidden">

                    {/* Client Info */}
                    <div className="px-3 py-2 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
                                {selectedClient?.name?.charAt(0) || 'C'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => onUpdateActiveSession({ clientId: Number(e.target.value) })}
                                        className="text-xs font-bold text-gray-900 bg-transparent border-none outline-none cursor-pointer appearance-none pr-3"
                                    >
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <ChevronDown size={10} className="text-gray-400 -ml-2" />
                                    <span className="text-[10px] text-gray-400 ml-1">{selectedClient?.phone || '—'}</span>
                                    <span className="bg-emerald-50 text-emerald-700 px-1.5 py-px rounded text-[10px] font-bold ml-1">Bal: {currency}{(selectedClient?.balance || 0).toFixed(2)}</span>
                                    <span className="bg-amber-50 text-amber-700 px-1.5 py-px rounded text-[10px] font-bold flex items-center gap-0.5"><Star size={8} />{selectedClient?.loyalty || 0} pts</span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-0.5">
                                    <span className="flex items-center gap-0.5 truncate"><MapPin size={8} />{selectedClient?.address || 'No address'}</span>
                                    <span className="shrink-0">Zone: {selectedClient?.zone || '—'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Search + Category Pills */}
                    <div className="px-3 py-2 border-b border-gray-100 space-y-1.5 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search products, scan barcode..."
                                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition-all"
                                value={searchQuery}
                                onChange={(e) => onSetSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-1 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => onSetActiveCategoryId(null)}
                                className={clsx(
                                    "px-2.5 py-0.5 whitespace-nowrap rounded-full text-[10px] font-semibold transition-all",
                                    activeCategoryId === null ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                )}
                            >All</button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => onSetActiveCategoryId(cat.id)}
                                    className={clsx(
                                        "px-2.5 py-0.5 whitespace-nowrap rounded-full text-[10px] font-semibold transition-all",
                                        activeCategoryId === cat.id ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    )}
                                >{cat.name}</button>
                            ))}
                        </div>
                    </div>

                    {/* Toggle */}
                    <div className="px-3 py-1 border-b border-gray-50 flex items-center justify-between shrink-0 bg-gray-50/50">
                        <span className="text-[10px] font-semibold text-gray-500 flex items-center gap-1">
                            <span className="w-1 h-1 bg-emerald-500 rounded-full" />
                            {leftExpanded ? 'Products' : 'Categories'}
                        </span>
                        <button
                            onClick={() => setLeftExpanded(!leftExpanded)}
                            className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                        >
                            {leftExpanded ? <EyeOff size={10} /> : <Eye size={10} />}
                            {leftExpanded ? 'Categories' : 'Products'}
                        </button>
                    </div>

                    {/* Expanded → Product Grid */}
                    {leftExpanded && (
                        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-gray-50/30">
                            <ProductGrid searchQuery={searchQuery} categoryId={activeCategoryId} onAddToCart={onAddToCart} currency={currency} />
                        </div>
                    )}

                    {/* Collapsed → Category Tiles ONLY (no payment) */}
                    {!leftExpanded && (
                        <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => { onSetActiveCategoryId(null); setLeftExpanded(true); }}
                                    className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 text-center group hover:shadow-md hover:border-emerald-200 transition-all"
                                >
                                    <Package size={18} className="mx-auto text-emerald-500 mb-1" />
                                    <span className="text-[10px] font-semibold text-gray-700">All Products</span>
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
                                        <Tag size={14} className={clsx("mx-auto mb-1", activeCategoryId === cat.id ? "text-emerald-500" : "text-gray-300 group-hover:text-emerald-400")} />
                                        <span className="text-[10px] font-semibold text-gray-700">{cat.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </aside>

                {/* ════ RIGHT COLUMN: CART (full height) ════ */}
                <main className="flex-1 flex flex-col bg-[#fafbfc] overflow-hidden">

                    {/* Cart Header */}
                    <div className="px-3 py-1.5 border-b border-gray-200/80 bg-white flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <h2 className="text-xs font-bold text-gray-900">Order</h2>
                            <span className="text-[10px] text-gray-400 font-medium">{uniqueItems} lines · {totalPieces} pcs</span>
                        </div>
                        {cart.length > 0 && (
                            <button onClick={onClearCart} className="text-[10px] text-gray-400 hover:text-rose-500 font-medium transition-colors">Clear</button>
                        )}
                    </div>

                    {/* Cart Items — COMPACT single row */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
                                <ShoppingCart size={36} strokeWidth={1} className="text-gray-200" />
                                <p className="text-xs text-gray-400">No items yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {cart.map((item: any, idx: number) => (
                                    <div
                                        key={item.productId}
                                        className={clsx(
                                            "px-2.5 py-1 group transition-colors duration-300 flex items-center gap-1.5",
                                            highlightedItemId === item.productId ? "bg-emerald-100"
                                                : lastAddedItemId === item.productId ? "bg-emerald-500/20 hover:bg-emerald-500/30"
                                                    : "hover:bg-white"
                                        )}
                                    >
                                        <span className="text-[9px] text-gray-300 font-mono w-3 shrink-0 text-center">{idx + 1}</span>
                                        <p className="text-[11px] font-semibold text-gray-900 truncate flex-1 min-w-0">{item.name}</p>
                                        <span className="text-[9px] text-gray-400 shrink-0">{currency}{Number(item.price).toFixed(2)}</span>
                                        <div className="flex items-center gap-px shrink-0">
                                            <button onClick={() => onUpdateQuantity(item.productId, -1)} className="w-5 h-5 rounded bg-gray-100 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center text-gray-400 transition-all active:scale-90">
                                                <Minus size={9} />
                                            </button>
                                            <span className="w-5 text-center text-[11px] font-bold tabular-nums">{item.quantity}</span>
                                            <button onClick={() => onUpdateQuantity(item.productId, 1)} className="w-5 h-5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-all active:scale-90">
                                                <Plus size={9} />
                                            </button>
                                        </div>
                                        {(item.taxRate || 0) > 0 && (
                                            <span className="text-[8px] text-gray-400 bg-gray-100 px-1 rounded shrink-0">{item.taxRate}%</span>
                                        )}
                                        <p className="text-[11px] font-bold text-gray-900 tabular-nums shrink-0 w-12 text-right">
                                            {currency}{(Number(item.price) * item.quantity).toFixed(2)}
                                        </p>
                                        <button onClick={() => onUpdateQuantity(item.productId, -100)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-rose-500 transition-all shrink-0">
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Cart Footer: Compact payment + Charge ── */}
                    <div className="border-t border-gray-200 bg-white px-3 py-2 shrink-0 space-y-2">
                        {/* Subtotal + Discount row */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-gray-400">Subtotal</span>
                                <span className="font-semibold tabular-nums text-gray-600">{currency}{total.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-gray-400">Discount</span>
                                <div className="flex items-center gap-1">
                                    {/* Discount Type Toggle */}
                                    <div className="flex items-center bg-gray-100 rounded p-0.5">
                                        <button
                                            onClick={() => onSetDiscountType('fixed')}
                                            className={clsx("px-2 py-0.5 rounded text-[10px] font-bold transition-all", discountType === 'fixed' ? "bg-white shadow text-gray-800" : "text-gray-400")}
                                        >
                                            {currency}
                                        </button>
                                        <button
                                            onClick={() => onSetDiscountType('percentage')}
                                            className={clsx("px-2 py-0.5 rounded text-[10px] font-bold transition-all", discountType === 'percentage' ? "bg-white shadow text-gray-800" : "text-gray-400")}
                                        >
                                            %
                                        </button>
                                    </div>
                                    <div className="relative w-24">
                                        <input
                                            type="number" min="0" step="0.01"
                                            value={discount || ''}
                                            onChange={(e) => onSetDiscount(Math.max(0, Number(e.target.value) || 0))}
                                            placeholder="0"
                                            className="w-full pl-2 pr-1 py-1 text-right bg-amber-50/50 border border-gray-200 rounded text-[12px] font-semibold tabular-nums text-amber-600 outline-none focus:border-amber-400 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between border-t border-gray-100 pt-1">
                            <span className="text-sm font-bold text-gray-900">Total</span>
                            <span className="text-lg font-extrabold tabular-nums text-gray-900">{currency}{totalAmount.toFixed(2)}</span>
                        </div>

                        {/* Payment methods */}
                        <div className="grid grid-cols-4 gap-1">
                            {[
                                { key: 'CASH', label: 'Cash', icon: Banknote },
                                { key: 'CARD', label: 'Card', icon: CreditCard },
                                { key: 'WALLET', label: 'Wallet', icon: Wallet },
                                { key: 'WAVE', label: 'Wave', icon: Wallet },
                                { key: 'OM', label: 'OM', icon: Wallet },
                                { key: 'MULTI', label: 'Multi', icon: CreditCard },
                                { key: 'DELIVERY', label: 'Delivery', icon: Package },
                            ].map(m => (
                                <button
                                    key={m.key}
                                    onClick={() => onSetPaymentMethod(m.key)}
                                    className={clsx(
                                        "flex items-center justify-center gap-0.5 py-1 rounded text-[9px] font-semibold transition-all border",
                                        paymentMethod === m.key
                                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                            : "bg-gray-50 border-gray-100 text-gray-400"
                                    )}
                                >
                                    <m.icon size={10} />
                                    {m.label}
                                </button>
                            ))}
                        </div>

                        {/* Advanced Input & Integrated Charge Button */}
                        <div className="flex items-center gap-2 pt-1">
                            {/* Received Amount Input (Formatted) */}
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-gray-500 mb-0.5 block">Received Amount</label>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">{currency}</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={cashReceived ? Number(cashReceived.replace(/\D/g, '')).toLocaleString('fr-FR') : ''}
                                        onChange={(e) => {
                                            const numericValue = e.target.value.replace(/\s+/g, '').replace(/,/g, '.');
                                            if (/^\d*\.?\d*$/.test(numericValue)) {
                                                onSetCashReceived(numericValue);
                                            }
                                        }}
                                        placeholder={totalAmount.toFixed(0)}
                                        className="w-full pl-6 pr-2 py-2 text-right bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold tabular-nums outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Integrated Charge Button */}
                            <button
                                onClick={onCharge}
                                disabled={cart.length === 0 || isProcessing}
                                className={clsx(
                                    "px-4 py-2 mt-4 rounded-lg flex flex-col items-center justify-center transition-all h-[42px] min-w-[140px]",
                                    cart.length > 0 && !isProcessing
                                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-200 hover:bg-emerald-600 active:scale-[0.98]"
                                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                )}
                            >
                                {isProcessing ? (
                                    <span className="text-sm font-bold">Processing...</span>
                                ) : (
                                    <>
                                        <span>Charge</span>
                                        {changeDue > 0 && (
                                            <span className="text-[9px] font-medium text-emerald-100 uppercase tracking-widest leading-none mt-0.5">
                                                Change: {currency}{changeDue.toLocaleString('fr-FR', { minimumFractionDigits: 0 })}
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>
                        </div>
                        {changeDue > 0 && props.onSetStoreChangeInWallet && (
                            <label className="flex items-center justify-center gap-1.5 cursor-pointer mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 py-1.5 px-2 rounded-lg hover:bg-emerald-100 transition-colors w-full border border-emerald-100">
                                <input
                                    type="checkbox"
                                    checked={props.storeChangeInWallet}
                                    onChange={(e) => props.onSetStoreChangeInWallet!(e.target.checked)}
                                    className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 w-3 h-3"
                                />
                                Save {currency}{changeDue.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} change to Wallet
                            </label>
                        )}
                    </div>
                </main>
            </div>

            {/* Modals */}
            <ManagerOverride isOpen={isOverrideOpen} actionLabel="Authorize Change" onClose={() => onSetOverrideOpen(false)} onSuccess={() => toast.success("Action authorized")} />
            <ReceiptModal isOpen={isReceiptOpen} onClose={() => onSetReceiptOpen(false)} orderId={lastOrder?.id || null} refCode={lastOrder?.ref || null} />
        </div>
    );
}
