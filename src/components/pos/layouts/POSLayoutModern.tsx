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
    DollarSign, Hash, CreditCard
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

/**
 * Layout B: "Modern" — Cart-Focused Layout (per user wireframe)
 * ┌──────────────────────────────────────────────────────┐
 * │ HEADER (full: branding, sessions, all action btns)   │
 * ├──────────────────────────────────────────────────────┤
 * │ CLIENT INFO BAR                                      │
 * ├──────────────────────────────────────────────────────┤
 * │ SEARCH BOX + CATEGORY FILTERS                        │
 * ├────────────────────────┬─────────────────────────────┤
 * │ Categories (expandable)│                             │
 * │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│     FULL CART VIEW          │
 * │ Payment / Finalize     │     (all item info,         │
 * │ (hidden when expanded) │      quantities, totals)    │
 * └────────────────────────┴─────────────────────────────┘
 */
export function POSLayoutModern(props: POSLayoutProps) {
    const {
        cart, clients, selectedClient, selectedClientId, categories,
        sessions, activeSessionId, currency, total, discount, totalAmount,
        totalPieces, uniqueItems, searchQuery, activeCategoryId, sidebarMode,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        isOverrideOpen, isReceiptOpen, lastOrder,
        onSetSearchQuery, onSetActiveCategoryId, onSetActiveSessionId,
        onSetPaymentMethod, onSetCashReceived, onAddToCart, onUpdateQuantity,
        onClearCart, onCreateNewSession, onRemoveSession, onUpdateActiveSession,
        onToggleFullscreen, onCycleSidebarMode, onCharge,
        onSetOverrideOpen, onSetReceiptOpen, onOpenLayoutSelector
    } = props;

    const [leftExpanded, setLeftExpanded] = useState(false);

    return (
        <div className={clsx(
            "flex flex-col bg-[#F1F5F9] overflow-hidden select-none h-full",
            isFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen" : "absolute inset-0"
        )}>
            {/* ═══════ HEADER — FULL FEATURE ═══════ */}
            <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-5 shrink-0 z-50 shadow-sm">
                <div className="flex items-center gap-5">
                    <h1 className="text-xl font-black tracking-tighter text-gray-900 flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-100">
                            <ShoppingCart size={18} className="text-white" />
                        </div>
                        Sales <span className="text-violet-600">Terminal</span>
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
                                            ? "bg-violet-600 text-white shadow-lg shadow-violet-100"
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
                        <button onClick={onCreateNewSession} className="w-7 h-7 flex items-center justify-center bg-gray-50 text-gray-400 rounded-lg hover:bg-violet-50 hover:text-violet-600 transition-all">
                            <Plus size={13} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={onToggleFullscreen} className="bg-violet-50 border border-violet-100 text-violet-600 h-9 px-3 rounded-xl font-bold shadow-sm hover:bg-violet-600 hover:text-white transition-all flex items-center gap-1.5">
                        {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                        <span className="text-[9px] uppercase tracking-widest font-black">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
                    </button>
                    <div className="h-5 w-px bg-gray-100 mx-0.5" />
                    <button onClick={onOpenLayoutSelector} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-100 rounded-lg text-gray-400 hover:text-violet-600 hover:border-violet-100 hover:bg-violet-50 transition-all shadow-sm" title="Switch Layout">
                        <Layout size={15} />
                    </button>
                    {[FileText, Settings, Wallet, Save, Book, File].map((Icon, i) => (
                        <button key={i} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-100 rounded-lg text-gray-400 hover:text-violet-600 hover:border-violet-100 hover:bg-violet-50 transition-all shadow-sm">
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

            {/* ═══════ SEARCH + CLIENT SELECTOR + CATEGORIES ═══════ */}
            <div className="bg-white border-b border-gray-100 px-5 py-2.5 flex items-center gap-3 shrink-0">
                <div className="w-56">
                    <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-violet-600 transition-colors" size={13} />
                        <select
                            value={selectedClientId}
                            onChange={(e) => onUpdateActiveSession({ clientId: Number(e.target.value) })}
                            className="w-full pl-9 pr-8 py-2 bg-gray-50/50 border border-gray-100 rounded-xl text-[10px] font-black appearance-none outline-none focus:bg-white focus:border-violet-500 transition-all cursor-pointer shadow-sm uppercase tracking-widest"
                        >
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={12} />
                    </div>
                </div>

                <div className="h-7 w-px bg-gray-100" />

                {/* Category Pills */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => onSetActiveCategoryId(null)}
                        className={clsx(
                            "px-3 py-1.5 whitespace-nowrap rounded-full text-[9px] font-black uppercase tracking-widest transition-all border",
                            activeCategoryId === null
                                ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-100'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-violet-200 hover:text-violet-600'
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
                                    ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-100'
                                    : 'bg-white text-gray-500 border-gray-200 hover:border-violet-200 hover:text-violet-600'
                            )}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                <div className="h-7 w-px bg-gray-100" />

                <div className="relative flex-1 group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-violet-500 transition-colors" size={15} />
                    <input
                        type="text"
                        placeholder="Search products, scan barcode..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-violet-500 transition-all"
                        value={searchQuery}
                        onChange={(e) => onSetSearchQuery(e.target.value)}
                    />
                </div>

                <button className="h-9 px-5 bg-violet-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all flex items-center gap-1.5">
                    <Plus size={14} />
                    Product
                </button>
            </div>

            {/* ═══════ MAIN CONTENT ═══════ */}
            <div className="flex-1 flex overflow-hidden">
                {/* ── LEFT: Categories (expandable) + Payment ── */}
                <aside className={clsx(
                    "flex flex-col bg-white border-r border-gray-100 shrink-0 transition-all duration-500 overflow-hidden",
                    leftExpanded ? "w-[55%]" : "w-[340px]"
                )}>
                    {/* Toggle + Title */}
                    <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between shrink-0">
                        <h3 className="text-[9px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-violet-600 rounded-full"></span>
                            {leftExpanded ? 'Product Discovery' : 'Categories & Payment'}
                        </h3>
                        <button
                            onClick={() => setLeftExpanded(!leftExpanded)}
                            className="text-[8px] font-bold text-violet-600 hover:text-violet-800 uppercase tracking-widest flex items-center gap-1 transition-colors"
                        >
                            {leftExpanded ? <EyeOff size={10} /> : <Eye size={10} />}
                            {leftExpanded ? 'Collapse' : 'Expand'}
                        </button>
                    </div>

                    {/* Expandable Product Grid (visible when expanded) */}
                    {leftExpanded && (
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar border-b border-gray-50">
                            <ProductGrid
                                searchQuery={searchQuery}
                                categoryId={activeCategoryId}
                                onAddToCart={onAddToCart}
                                currency={currency}
                            />
                        </div>
                    )}

                    {/* Collapsed: Categories + Payment SIDE BY SIDE */}
                    {!leftExpanded && (
                        <div className="flex-1 flex overflow-hidden">
                            {/* LEFT COLUMN: Category Tiles */}
                            <div className="w-1/2 border-r border-gray-100 p-3 overflow-y-auto custom-scrollbar">
                                <h4 className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-2.5">Categories</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => { onSetActiveCategoryId(null); setLeftExpanded(true); }}
                                        className="p-3 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 text-center group hover:shadow-md transition-all"
                                    >
                                        <Package size={20} className="mx-auto text-violet-500 mb-1.5" />
                                        <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest">All Products</span>
                                    </button>
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => { onSetActiveCategoryId(cat.id); setLeftExpanded(true); }}
                                            className={clsx(
                                                "p-3 rounded-xl border text-center group hover:shadow-md transition-all",
                                                activeCategoryId === cat.id
                                                    ? "bg-violet-50 border-violet-200"
                                                    : "bg-white border-gray-100 hover:border-violet-100"
                                            )}
                                        >
                                            <Tag size={16} className={clsx("mx-auto mb-1.5", activeCategoryId === cat.id ? "text-violet-500" : "text-gray-300 group-hover:text-violet-400")} />
                                            <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest">{cat.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* RIGHT COLUMN: Payment & Finalize */}
                            <div className="w-1/2 p-3 overflow-y-auto custom-scrollbar bg-gray-50/30">
                                <h4 className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-2.5">Payment</h4>
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

                {/* ── RIGHT: FULL CART VIEW ── */}
                <main className="flex-1 flex flex-col bg-[#FAFBFC] overflow-hidden">
                    {/* Cart Header */}
                    <div className="px-5 py-3 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <h2 className="text-xs font-black uppercase tracking-widest text-gray-900 italic">Cart — Full View</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg">{uniqueItems} lines · {totalPieces} pcs</span>
                            {cart.length > 0 && (
                                <button onClick={onClearCart} className="text-[8px] font-bold text-gray-400 hover:text-rose-500 uppercase tracking-widest transition-colors">
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Cart Table — Full width, detailed */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3">
                                <ShoppingCart size={48} strokeWidth={1} />
                                <p className="text-sm font-bold">No items yet</p>
                                <p className="text-xs text-gray-400">Select a category or search to add products</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                                    <tr className="text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                                        <th className="text-left px-5 py-3 w-8">#</th>
                                        <th className="text-left px-3 py-3">Product</th>
                                        <th className="text-center px-3 py-3 w-20">Unit Price</th>
                                        <th className="text-center px-3 py-3 w-28">Quantity</th>
                                        <th className="text-center px-3 py-3 w-16">Tax</th>
                                        <th className="text-right px-5 py-3 w-24">Total</th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {cart.map((item: any, idx: number) => (
                                        <tr key={item.productId} className="group hover:bg-violet-50/30 transition-colors">
                                            <td className="px-5 py-3.5 text-xs text-gray-300 font-mono">{idx + 1}</td>
                                            <td className="px-3 py-3.5">
                                                <span className="font-bold text-gray-900">{item.name}</span>
                                            </td>
                                            <td className="px-3 py-3.5 text-center font-mono tabular-nums text-gray-500">{currency}{Number(item.price).toFixed(2)}</td>
                                            <td className="px-3 py-3.5">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => onUpdateQuantity(item.productId, -1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center text-gray-400 transition-all active:scale-90">
                                                        <Minus size={12} />
                                                    </button>
                                                    <span className="w-10 text-center font-black tabular-nums text-gray-900">{item.quantity}</span>
                                                    <button onClick={() => onUpdateQuantity(item.productId, 1)} className="w-7 h-7 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-600 flex items-center justify-center transition-all active:scale-90">
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3.5 text-center text-[10px] font-mono text-gray-400">{(item.taxRate || 0)}%</td>
                                            <td className="px-5 py-3.5 text-right font-black tabular-nums text-gray-900">{currency}{(Number(item.price) * item.quantity).toFixed(2)}</td>
                                            <td className="pr-3 py-3.5">
                                                <button onClick={() => onUpdateQuantity(item.productId, -100)} className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-rose-500 transition-all">
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Cart Footer — Totals + Payment (always visible) */}
                    <div className="border-t border-gray-200 bg-white px-5 py-3 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="text-center">
                                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Subtotal</p>
                                    <p className="text-sm font-black tabular-nums text-gray-600">{currency}{total.toFixed(2)}</p>
                                </div>
                                {discount > 0 && (
                                    <div className="text-center">
                                        <p className="text-[8px] font-bold text-amber-500 uppercase tracking-widest">Discount</p>
                                        <p className="text-sm font-black tabular-nums text-amber-600">-{currency}{discount.toFixed(2)}</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Total</p>
                                    <p className="text-xl font-black tabular-nums text-gray-900">{currency}{totalAmount.toFixed(2)}</p>
                                </div>
                                <button
                                    onClick={onCharge}
                                    disabled={cart.length === 0 || isProcessing}
                                    className={clsx(
                                        "py-3 px-8 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                        cart.length > 0 && !isProcessing
                                            ? "bg-violet-600 text-white shadow-lg shadow-violet-200 hover:bg-violet-700 active:scale-[0.98]"
                                            : "bg-gray-100 text-gray-300 cursor-not-allowed"
                                    )}
                                >
                                    {isProcessing ? 'Processing...' : `Charge ${currency}${totalAmount.toFixed(2)}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
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
