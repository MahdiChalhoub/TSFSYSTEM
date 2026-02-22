'use client';

import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartTotals } from '@/components/pos/CartTotals';
import { Numpad } from '@/components/pos/Numpad';
import { Search, ShoppingCart, Plus, X, Minus, Trash2, User, Settings, ChevronDown, Layout } from 'lucide-react';
import clsx from 'clsx';

/**
 * Layout A: "Classic" — Odoo-Inspired
 * Products left (65%), Order panel right (35%) with numpad.
 * Clean, familiar retail layout with category-colored product cards.
 */
export function POSLayoutClassic(props: POSLayoutProps) {
    const {
        cart, clients, selectedClient, selectedClientId, categories,
        sessions, activeSessionId, currency, total, discount, totalAmount,
        totalPieces, uniqueItems, searchQuery, activeCategoryId,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        onSetSearchQuery, onSetActiveCategoryId, onSetActiveSessionId,
        onSetPaymentMethod, onSetCashReceived, onAddToCart, onUpdateQuantity,
        onClearCart, onCreateNewSession, onRemoveSession, onUpdateActiveSession,
        onToggleFullscreen, onCharge, onOpenLayoutSelector, onSetOverrideOpen
    } = props;

    return (
        <div className={clsx(
            "flex flex-col bg-[#f0f2f5] overflow-hidden select-none h-full",
            isFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen" : "absolute inset-0"
        )}>
            {/* ─── TOP BAR ─── */}
            <header className="h-14 bg-[#1B1D2A] flex items-center justify-between px-5 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <ShoppingCart size={16} className="text-white" />
                        </div>
                        <span className="text-white font-black text-sm tracking-tight">POS Terminal</span>
                    </div>

                    {/* Session Tabs */}
                    <div className="flex gap-1 ml-4">
                        {sessions.map(s => (
                            <div key={s.id} className="flex items-center group">
                                <button
                                    onClick={() => onSetActiveSessionId(s.id)}
                                    className={clsx(
                                        "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                        activeSessionId === s.id
                                            ? "bg-indigo-600 text-white"
                                            : "bg-white/10 text-white/60 hover:bg-white/20"
                                    )}
                                >
                                    {s.name}
                                </button>
                                <button
                                    onClick={() => onRemoveSession(s.id)}
                                    className="ml-[-4px] p-0.5 text-white/30 hover:text-rose-400 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={onCreateNewSession}
                            className="w-7 h-7 flex items-center justify-center bg-white/10 text-white/50 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Client Selector */}
                    <div className="relative">
                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" size={12} />
                        <select
                            value={selectedClientId}
                            onChange={(e) => onUpdateActiveSession({ clientId: Number(e.target.value) })}
                            className="pl-8 pr-6 py-1.5 bg-white/10 border border-white/10 rounded-lg text-[10px] text-white font-bold appearance-none outline-none focus:border-indigo-500 transition-all cursor-pointer uppercase tracking-wider"
                        >
                            {clients.map(c => (
                                <option key={c.id} value={c.id} className="text-gray-900">{c.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={10} />
                    </div>

                    <button onClick={onOpenLayoutSelector} className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all" title="Switch Layout">
                        <Layout size={16} />
                    </button>
                    <button onClick={onToggleFullscreen} className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                        <Settings size={16} />
                    </button>
                </div>
            </header>

            {/* ─── MAIN CONTENT ─── */}
            <div className="flex-1 flex overflow-hidden">
                {/* ─── LEFT: Products ─── */}
                <div className="flex-1 flex flex-col bg-[#f0f2f5] overflow-hidden">
                    {/* Search + Categories */}
                    <div className="p-4 pb-2 flex flex-col gap-3 shrink-0 bg-white border-b border-gray-100">
                        {/* Search */}
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search products..."
                                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-indigo-500 transition-all"
                                value={searchQuery}
                                onChange={(e) => onSetSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Category Pills */}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            <button
                                onClick={() => onSetActiveCategoryId(null)}
                                className={clsx(
                                    "px-4 py-2 whitespace-nowrap rounded-full text-xs font-bold transition-all border",
                                    activeCategoryId === null
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-200 hover:text-indigo-600'
                                )}
                            >
                                All Items
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => onSetActiveCategoryId(cat.id)}
                                    className={clsx(
                                        "px-4 py-2 whitespace-nowrap rounded-full text-xs font-bold transition-all border",
                                        activeCategoryId === cat.id
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                                            : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-200 hover:text-indigo-600'
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Grid */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <ProductGrid
                            searchQuery={searchQuery}
                            categoryId={activeCategoryId}
                            onAddToCart={onAddToCart}
                            currency={currency}
                        />
                    </div>
                </div>

                {/* ─── RIGHT: Order Panel ─── */}
                <aside className="w-[380px] bg-white border-l border-gray-200 flex flex-col shrink-0 shadow-[-4px_0_24px_rgba(0,0,0,0.04)]">
                    {/* Order Header */}
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <h2 className="text-xs font-black uppercase tracking-widest text-gray-900">Current Order</h2>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400">
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-black">{uniqueItems} lines</span>
                            <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded-md font-black">{totalPieces} pcs</span>
                        </div>
                    </div>

                    {/* Order Lines */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3">
                                <ShoppingCart size={40} strokeWidth={1} />
                                <p className="text-xs font-bold">No items in this order</p>
                                <p className="text-[10px]">Tap products to add them</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {cart.map((item: any) => (
                                    <div key={item.productId} className="px-5 py-3 flex items-center gap-3 group hover:bg-gray-50/50 transition-colors">
                                        {/* Product Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                                            <p className="text-[10px] text-gray-400 font-medium tabular-nums">
                                                {currency}{Number(item.price).toFixed(2)} × {item.quantity}
                                            </p>
                                        </div>

                                        {/* Qty Controls */}
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => onUpdateQuantity(item.productId, -1)}
                                                className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center text-gray-400 transition-all active:scale-90"
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <span className="w-8 text-center text-sm font-black tabular-nums text-gray-900">{item.quantity}</span>
                                            <button
                                                onClick={() => onUpdateQuantity(item.productId, 1)}
                                                className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-all active:scale-90"
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>

                                        {/* Line Total */}
                                        <span className="w-20 text-right text-sm font-black tabular-nums text-gray-900">
                                            {currency}{(Number(item.price) * item.quantity).toFixed(2)}
                                        </span>

                                        {/* Delete */}
                                        <button
                                            onClick={() => onUpdateQuantity(item.productId, -100)}
                                            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-rose-500 transition-all"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Numpad */}
                    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                        <Numpad
                            onValueConfirm={(val, mode) => {
                                if (mode === 'qty' && cart.length > 0) {
                                    const lastItem = cart[0] as any;
                                    const delta = val - lastItem.quantity;
                                    onUpdateQuantity(lastItem.productId, delta);
                                }
                            }}
                        />
                    </div>

                    {/* Totals & Payment */}
                    <div className="px-5 py-4 border-t border-gray-200 bg-white shrink-0">
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span className="font-medium">Subtotal</span>
                                <span className="font-bold tabular-nums">{currency}{total.toFixed(2)}</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between text-xs text-amber-600">
                                    <span className="font-medium">Discount</span>
                                    <span className="font-bold tabular-nums">-{currency}{discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-black text-gray-900 pt-2 border-t border-gray-100">
                                <span>Total</span>
                                <span className="tabular-nums">{currency}{totalAmount.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Payment Button */}
                        <button
                            onClick={onCharge}
                            disabled={cart.length === 0 || isProcessing}
                            className={clsx(
                                "w-full mt-4 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all",
                                cart.length > 0 && !isProcessing
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98]"
                                    : "bg-gray-100 text-gray-300 cursor-not-allowed"
                            )}
                        >
                            {isProcessing ? 'Processing...' : `Payment · ${currency}${totalAmount.toFixed(2)}`}
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    );
}
