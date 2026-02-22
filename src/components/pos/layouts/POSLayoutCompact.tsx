'use client';

import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { Search, ShoppingCart, Plus, Minus, Trash2, X, Layout, User, ChevronDown, Zap, CreditCard, Banknote, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

/**
 * Layout C: "Compact" — Speed Terminal
 * Optimized for high-speed cashiers. 50/50 split, dark theme,
 * dense table rows, monospace numbers, keyboard-first workflow.
 */
export function POSLayoutCompact(props: POSLayoutProps) {
    const {
        cart, clients, selectedClient, selectedClientId, categories,
        sessions, activeSessionId, currency, total, discount, totalAmount,
        totalPieces, uniqueItems, searchQuery, activeCategoryId,
        isFullscreen, paymentMethod, isProcessing,
        onSetSearchQuery, onSetActiveCategoryId, onSetActiveSessionId,
        onSetPaymentMethod, onAddToCart, onUpdateQuantity,
        onCreateNewSession, onRemoveSession, onUpdateActiveSession,
        onToggleFullscreen, onCharge, onOpenLayoutSelector
    } = props;

    return (
        <div className={clsx(
            "flex flex-col bg-[#0f1117] overflow-hidden select-none h-full text-gray-100",
            isFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen" : "absolute inset-0"
        )}>
            {/* ─── HEADER ─── */}
            <header className="h-10 bg-[#161822] border-b border-gray-800 flex items-center justify-between px-4 shrink-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Zap size={14} className="text-amber-400" />
                        <span className="text-xs font-bold text-amber-400 tracking-wider uppercase">Speed Terminal</span>
                    </div>
                    <div className="h-4 w-px bg-gray-700" />
                    {/* Session Tabs */}
                    <div className="flex gap-1">
                        {sessions.map(s => (
                            <div key={s.id} className="flex items-center group">
                                <button
                                    onClick={() => onSetActiveSessionId(s.id)}
                                    className={clsx(
                                        "px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all font-mono",
                                        activeSessionId === s.id
                                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                            : "text-gray-500 hover:text-gray-300 border border-transparent"
                                    )}
                                >
                                    {s.name}
                                </button>
                                <button onClick={() => onRemoveSession(s.id)} className="p-0.5 text-gray-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all">
                                    <X size={8} />
                                </button>
                            </div>
                        ))}
                        <button onClick={onCreateNewSession} className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-amber-400 rounded transition-all">
                            <Plus size={10} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Client */}
                    <select
                        value={selectedClientId}
                        onChange={(e) => onUpdateActiveSession({ clientId: Number(e.target.value) })}
                        className="px-2 py-1 bg-transparent border border-gray-700 rounded text-[9px] text-gray-400 font-mono appearance-none outline-none focus:border-amber-500 cursor-pointer uppercase"
                    >
                        {clients.map(c => <option key={c.id} value={c.id} className="bg-gray-900">{c.name}</option>)}
                    </select>
                    <button onClick={onOpenLayoutSelector} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-amber-400 rounded transition-all" title="Switch Layout">
                        <Layout size={12} />
                    </button>
                </div>
            </header>

            {/* ─── MAIN SPLIT ─── */}
            <div className="flex-1 flex overflow-hidden">
                {/* ─── LEFT: Product Discovery ─── */}
                <div className="flex-1 flex flex-col border-r border-gray-800 overflow-hidden">
                    {/* Search + Category */}
                    <div className="p-3 flex items-center gap-2 border-b border-gray-800 bg-[#161822] shrink-0">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" size={13} />
                            <input
                                type="text"
                                placeholder="Search or scan..."
                                className="w-full pl-8 pr-3 py-1.5 bg-[#0f1117] border border-gray-700 rounded-lg text-xs text-gray-200 font-mono outline-none focus:border-amber-500 transition-all placeholder:text-gray-600"
                                value={searchQuery}
                                onChange={(e) => onSetSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-1 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => onSetActiveCategoryId(null)}
                                className={clsx(
                                    "px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wider whitespace-nowrap transition-all font-mono",
                                    activeCategoryId === null ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-gray-500 border border-gray-700 hover:text-gray-300'
                                )}
                            >
                                ALL
                            </button>
                            {categories.slice(0, 8).map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => onSetActiveCategoryId(cat.id)}
                                    className={clsx(
                                        "px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wider whitespace-nowrap transition-all font-mono",
                                        activeCategoryId === cat.id ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-gray-500 border border-gray-700 hover:text-gray-300'
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Grid */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                        <ProductGrid
                            searchQuery={searchQuery}
                            categoryId={activeCategoryId}
                            onAddToCart={onAddToCart}
                            currency={currency}
                        />
                    </div>
                </div>

                {/* ─── RIGHT: Cart ─── */}
                <div className="w-[420px] flex flex-col bg-[#161822] overflow-hidden shrink-0">
                    {/* Cart Header */}
                    <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between bg-[#1c1f2e]">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">Order</span>
                            <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{uniqueItems}L / {totalPieces}P</span>
                        </div>
                        <span className="text-[9px] font-mono text-gray-600">{selectedClient.name}</span>
                    </div>

                    {/* Cart Lines — Dense Table */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {cart.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-700">
                                <span className="text-xs font-mono">Empty order</span>
                            </div>
                        ) : (
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-[#1c1f2e] z-10">
                                    <tr className="text-[8px] font-mono uppercase tracking-wider text-gray-600 border-b border-gray-800">
                                        <th className="text-left px-3 py-1.5">Item</th>
                                        <th className="text-center px-2 py-1.5 w-24">Qty</th>
                                        <th className="text-right px-3 py-1.5 w-20">Price</th>
                                        <th className="text-right px-3 py-1.5 w-24">Total</th>
                                        <th className="w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/50">
                                    {cart.map((item: any) => (
                                        <tr key={item.productId} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="px-3 py-2 font-medium text-gray-200 truncate max-w-[140px]">{item.name}</td>
                                            <td className="px-2 py-2">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <button onClick={() => onUpdateQuantity(item.productId, -1)} className="w-5 h-5 rounded bg-gray-800 hover:bg-rose-900/50 hover:text-rose-400 flex items-center justify-center text-gray-500 active:scale-90 transition-all">
                                                        <Minus size={10} />
                                                    </button>
                                                    <span className="w-8 text-center font-mono font-bold text-amber-400 tabular-nums">{item.quantity}</span>
                                                    <button onClick={() => onUpdateQuantity(item.productId, 1)} className="w-5 h-5 rounded bg-gray-800 hover:bg-emerald-900/50 hover:text-emerald-400 flex items-center justify-center text-gray-500 active:scale-90 transition-all">
                                                        <Plus size={10} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-400">{Number(item.price).toFixed(2)}</td>
                                            <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-gray-200">{(Number(item.price) * item.quantity).toFixed(2)}</td>
                                            <td className="pr-2 py-2">
                                                <button onClick={() => onUpdateQuantity(item.productId, -100)} className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-gray-600 hover:text-rose-400 transition-all">
                                                    <Trash2 size={10} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Payment Footer */}
                    <div className="border-t border-gray-700 bg-[#1c1f2e] px-4 py-3 shrink-0 space-y-3">
                        {/* Totals */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-gray-500">
                                <span>SUBTOTAL</span>
                                <span className="tabular-nums">{currency}{total.toFixed(2)}</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between text-[10px] font-mono text-amber-500">
                                    <span>DISCOUNT</span>
                                    <span className="tabular-nums">-{currency}{discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm font-mono font-black pt-1 border-t border-gray-700">
                                <span className="text-gray-300">TOTAL</span>
                                <span className="text-amber-400 tabular-nums">{currency}{totalAmount.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Payment Toggle + Charge */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => onSetPaymentMethod(paymentMethod === 'CASH' ? 'CARD' : 'CASH')}
                                className={clsx(
                                    "flex-1 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider font-mono flex items-center justify-center gap-2 border transition-all",
                                    paymentMethod === 'CASH'
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                        : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                )}
                            >
                                {paymentMethod === 'CASH' ? <Banknote size={14} /> : <CreditCard size={14} />}
                                {paymentMethod}
                            </button>
                            <button
                                onClick={onCharge}
                                disabled={cart.length === 0 || isProcessing}
                                className={clsx(
                                    "flex-[2] py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider font-mono flex items-center justify-center gap-2 transition-all",
                                    cart.length > 0 && !isProcessing
                                        ? "bg-amber-500 text-black hover:bg-amber-400 active:scale-[0.98]"
                                        : "bg-gray-800 text-gray-600 cursor-not-allowed"
                                )}
                            >
                                {isProcessing ? 'PROCESSING...' : `CHARGE ${currency}${totalAmount.toFixed(2)}`}
                                {!isProcessing && <ChevronRight size={14} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
