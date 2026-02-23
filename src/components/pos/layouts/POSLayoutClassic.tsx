'use client';

import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CompactClientHeader } from '@/components/pos/CompactClientHeader';
import { Numpad } from '@/components/pos/Numpad';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import {
    Search, ShoppingCart, Plus, X, Minus, Trash2, User, ChevronDown, Layout,
    Maximize, Minimize, FileText, Settings, Wallet, Save, Book, File, ArrowLeft
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

/**
 * Layout A: "Classic" — Odoo-Inspired
 * Products left (65%), Order panel right (35%) with numpad.
 * Full functionality: fullscreen, all action buttons, sessions, client info.
 */
export function POSLayoutClassic(props: POSLayoutProps) {
    const {
        cart, clients, selectedClient, selectedClientId, categories,
        sessions, activeSessionId, currency, total, discount, totalAmount,
        totalPieces, uniqueItems, searchQuery, activeCategoryId,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        isOverrideOpen, isReceiptOpen, lastOrder, highlightedItemId, lastAddedItemId,
        onSetSearchQuery, onSetActiveCategoryId, onSetActiveSessionId,
        onSetPaymentMethod, onSetCashReceived, onSetDiscount, onAddToCart, onUpdateQuantity,
        onClearCart, onCreateNewSession, onRemoveSession, onUpdateActiveSession,
        onToggleFullscreen, onCharge, onOpenLayoutSelector,
        onSetOverrideOpen, onSetReceiptOpen
    } = props;

    return (
        <div className={clsx(
            "flex flex-col bg-[#f0f2f5] overflow-hidden select-none h-full",
            isFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen" : "absolute inset-0"
        )}>
            {/* ═══════ HEADER — FULL FEATURE ═══════ */}
            <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-5 shrink-0 z-50 shadow-sm">
                <div className="flex items-center gap-5">
                    <h1 className="text-xl font-black tracking-tighter text-gray-900 flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
                            <ShoppingCart size={18} className="text-white" />
                        </div>
                        Sales <span className="text-indigo-600">Terminal</span>
                    </h1>

                    {/* Session Tabs */}
                    <div className="flex gap-1.5 ml-2 overflow-x-auto max-w-md no-scrollbar">
                        {sessions.map(s => (
                            <div key={s.id} className="flex shrink-0 group">
                                <button
                                    onClick={() => onSetActiveSessionId(s.id)}
                                    className={clsx(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                        activeSessionId === s.id
                                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                                            : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                                    )}
                                >
                                    <ShoppingCart size={10} className={activeSessionId === s.id ? "text-white" : "text-gray-300"} />
                                    {s.name}
                                </button>
                                <button onClick={() => onRemoveSession(s.id)} className="ml-[-6px] p-0.5 text-gray-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100">
                                    <X size={9} />
                                </button>
                            </div>
                        ))}
                        <button onClick={onCreateNewSession} className="w-7 h-7 flex items-center justify-center bg-gray-50 text-gray-400 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                            <Plus size={13} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={onToggleFullscreen} className="bg-indigo-50 border border-indigo-100 text-indigo-600 h-9 px-3 rounded-xl font-bold shadow-sm hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1.5">
                        {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                        <span className="text-[9px] uppercase tracking-widest font-black">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
                    </button>
                    <div className="h-5 w-px bg-gray-100 mx-0.5" />
                    <button onClick={onOpenLayoutSelector} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-100 rounded-lg text-gray-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm" title="Switch Layout">
                        <Layout size={15} />
                    </button>
                    {[FileText, Settings, Wallet, Save, Book, File].map((Icon, i) => (
                        <button key={i} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-100 rounded-lg text-gray-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm">
                            <Icon size={15} />
                        </button>
                    ))}
                    <button className="w-8 h-8 flex items-center justify-center bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 ml-0.5">
                        <ArrowLeft size={15} />
                    </button>
                </div>
            </header>

            {/* ═══════ CLIENT INFO BAR ═══════ */}
            <CompactClientHeader
                client={selectedClient}
                currency={currency}
                uniqueItems={uniqueItems}
                totalPieces={totalPieces}
            />

            {/* ═══════ SEARCH + CLIENT SELECTOR ═══════ */}
            <div className="bg-white border-b border-gray-100 px-5 py-2.5 flex items-center gap-3 shrink-0">
                <div className="w-56">
                    <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={13} />
                        <select
                            value={selectedClientId}
                            onChange={(e) => onUpdateActiveSession({ clientId: Number(e.target.value) })}
                            className="w-full pl-9 pr-8 py-2 bg-gray-50/50 border border-gray-100 rounded-xl text-[10px] font-black appearance-none outline-none focus:bg-white focus:border-indigo-500 transition-all cursor-pointer shadow-sm uppercase tracking-widest"
                        >
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={12} />
                    </div>
                </div>

                <div className="h-7 w-px bg-gray-100" />

                {/* Category Pills inline */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => onSetActiveCategoryId(null)}
                        className={clsx(
                            "px-3 py-1.5 whitespace-nowrap rounded-full text-[9px] font-black uppercase tracking-widest transition-all border",
                            activeCategoryId === null
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-200 hover:text-indigo-600'
                        )}
                    >
                        All
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => onSetActiveCategoryId(cat.id)}
                            className={clsx(
                                "px-3 py-1.5 whitespace-nowrap rounded-full text-[9px] font-black uppercase tracking-widest transition-all border",
                                activeCategoryId === cat.id
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                                    : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-200 hover:text-indigo-600'
                            )}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                <div className="h-7 w-px bg-gray-100" />

                <div className="relative flex-1 group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors" size={15} />
                    <input
                        type="text"
                        placeholder="Search products..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all"
                        value={searchQuery}
                        onChange={(e) => onSetSearchQuery(e.target.value)}
                    />
                </div>

                <button className="h-9 px-5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-1.5">
                    <Plus size={14} />
                    Product
                </button>
            </div>

            {/* ═══════ MAIN CONTENT ═══════ */}
            <div className="flex-1 flex overflow-hidden">
                {/* ─── LEFT: Products ─── */}
                <div className="flex-1 flex flex-col bg-[#f0f2f5] overflow-hidden">
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
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{uniqueItems} lines</span>
                            <span className="text-[9px] font-black text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md">{totalPieces} pcs</span>
                            {cart.length > 0 && (
                                <button onClick={onClearCart} className="text-[8px] font-bold text-gray-400 hover:text-rose-500 uppercase tracking-widest ml-1 transition-colors">
                                    Clear
                                </button>
                            )}
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
                                    <div
                                        key={item.productId}
                                        className={clsx(
                                            "px-5 py-3 flex items-center gap-3 group transition-colors duration-300",
                                            highlightedItemId === item.productId ? "bg-indigo-100"
                                                : lastAddedItemId === item.productId ? "bg-indigo-500/10 hover:bg-indigo-500/20"
                                                    : "hover:bg-gray-50/50"
                                        )}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                                            <p className="text-[10px] text-gray-400 font-medium tabular-nums">
                                                {currency}{Number(item.price).toFixed(2)} × {item.quantity}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => onUpdateQuantity(item.productId, -1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center text-gray-400 transition-all active:scale-90">
                                                <Minus size={12} />
                                            </button>
                                            <span className="w-8 text-center text-sm font-black tabular-nums text-gray-900">{item.quantity}</span>
                                            <button onClick={() => onUpdateQuantity(item.productId, 1)} className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-all active:scale-90">
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                        <span className="w-20 text-right text-sm font-black tabular-nums text-gray-900">
                                            {currency}{(Number(item.price) * item.quantity).toFixed(2)}
                                        </span>
                                        <button onClick={() => onUpdateQuantity(item.productId, -100)} className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-rose-500 transition-all">
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
                            {(selectedClient?.loyalty || 0) > 0 && props.onSetPointsRedeemed && (
                                <div className="flex items-center justify-between text-xs pt-1">
                                    <span className="font-medium text-emerald-600">Loyalty ({selectedClient?.loyalty} pts)</span>
                                    <button
                                        onClick={() => {
                                            const toggleTo = props.pointsRedeemed === selectedClient?.loyalty ? 0 : selectedClient?.loyalty;
                                            props.onSetPointsRedeemed!(toggleTo || 0);
                                        }}
                                        className={clsx(
                                            "px-2 py-0.5 border rounded text-[10px] font-bold transition-all",
                                            props.pointsRedeemed! > 0 ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                        )}
                                    >
                                        {props.pointsRedeemed! > 0 ? `Redeeming ${props.pointsRedeemed}` : 'Redeem All'}
                                    </button>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-black text-gray-900 pt-2 border-t border-gray-100">
                                <span>Total</span>
                                <span className="tabular-nums">{currency}{totalAmount.toFixed(2)}</span>
                            </div>
                        </div>

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
