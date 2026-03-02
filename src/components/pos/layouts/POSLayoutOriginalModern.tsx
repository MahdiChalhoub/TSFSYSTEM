'use client';

import { useState } from 'react';
import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartTotals } from '@/components/pos/CartTotals';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import {
 Search, ShoppingCart, Plus, Minus, Trash2, X, Layout, User,
 ChevronDown, Maximize, Minimize, Settings, Tag, CreditCard,
 Eye, EyeOff, Package, Hash, DollarSign, ArrowLeft
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

/**
 * Layout B: "Modern" — Cart-Focused Layout
 * Based on user wireframe:
 * ┌──────────────────────────────────────────────────────┐
 * │ HEADER (branding + sessions + fullscreen + layout) │
 * ├──────────────────────────────────────────────────────┤
 * │ CLIENT INFO BAR │
 * ├──────────────────────────────────────────────────────┤
 * │ SEARCH BOX + CATEGORY FILTERS │
 * ├────────────────────────┬─────────────────────────────┤
 * │ Categories (expandable)│ │
 * │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│ FULL CART VIEW │
 * │ Payment / Finalize │ (all item info, │
 * │ (hidden when expanded) │ quantities, totals) │
 * │ │ │
 * └────────────────────────┴─────────────────────────────┘
 */
export function POSLayoutOriginalModern(props: POSLayoutProps) {
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
 {/* ═══════ HEADER ═══════ */}
 <header className="h-14 bg-app-surface border-b border-app-border flex items-center justify-between px-5 shrink-0 z-50 shadow-sm">
 <div className="flex items-center gap-5">
 <h1 className="text-xl font-black tracking-tighter text-app-text flex items-center gap-2.5">
 <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-100">
 <ShoppingCart size={18} className="text-app-text" />
 </div>
 Sales <span className="text-violet-600">Terminal</span>
 </h1>

 {/* Session Tabs */}
 <div className="flex gap-1 ml-2 overflow-x-auto max-w-md no-scrollbar">
 {sessions.map(s => (
 <div key={s.id} className="flex shrink-0 group">
 <button
 onClick={() => onSetActiveSessionId(s.id)}
 className={clsx(
 "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
 activeSessionId === s.id
 ? "bg-violet-600 text-app-text shadow-lg shadow-violet-100"
 : "bg-app-bg text-app-text-faint hover:bg-app-surface-2"
 )}
 >
 <ShoppingCart size={10} className={activeSessionId === s.id ? "text-app-text" : "text-gray-300"} />
 {s.name}
 </button>
 <button onClick={() => onRemoveSession(s.id)} className="ml-[-6px] p-0.5 text-gray-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100">
 <X size={9} />
 </button>
 </div>
 ))}
 <button onClick={onCreateNewSession} className="w-7 h-7 flex items-center justify-center bg-app-bg text-app-text-faint rounded-lg hover:bg-violet-50 hover:text-violet-600 transition-all">
 <Plus size={13} />
 </button>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <button onClick={onToggleFullscreen} className="h-8 px-3 bg-violet-50 border border-violet-100 text-violet-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-violet-600 hover:text-app-text transition-all flex items-center gap-1.5">
 {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
 {isFullscreen ? 'Exit' : 'Full'}
 </button>
 <button onClick={onOpenLayoutSelector} className="w-8 h-8 flex items-center justify-center bg-app-surface border border-app-border rounded-lg text-app-text-faint hover:text-violet-600 hover:border-violet-100 hover:bg-violet-50 transition-all" title="Switch Layout">
 <Layout size={15} />
 </button>
 </div>
 </header>

 {/* ═══════ CLIENT INFO BAR ═══════ */}
 <div className="h-10 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-100/50 px-5 flex items-center justify-between shrink-0">
 <div className="flex items-center gap-4">
 <div className="flex items-center gap-2">
 <User size={12} className="text-violet-600" />
 <select
 value={selectedClientId}
 onChange={(e) => onUpdateActiveSession({ clientId: Number(e.target.value) })}
 className="bg-transparent text-xs font-bold text-app-text appearance-none outline-none cursor-pointer pr-4"
 >
 {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
 </select>
 </div>
 <div className="h-4 w-px bg-violet-200/50" />
 <span className="text-[9px] font-bold text-app-text-muted">{selectedClient.phone}</span>
 {selectedClient.address !== 'Counter Sales' && (
 <>
 <div className="h-4 w-px bg-violet-200/50" />
 <span className="text-[9px] font-bold text-app-text-muted truncate max-w-[200px]">{selectedClient.address}</span>
 </>
 )}
 </div>
 <div className="flex items-center gap-3 text-[9px] font-black text-app-text-muted">
 <span className="flex items-center gap-1"><DollarSign size={10} className="text-violet-500" /> Bal: {currency}{selectedClient.balance}</span>
 <span className="flex items-center gap-1"><Tag size={10} className="text-amber-500" /> Loyalty: {selectedClient.loyalty}</span>
 <span className="flex items-center gap-1"><Package size={10} className="text-emerald-500" /> {uniqueItems} items</span>
 <span className="flex items-center gap-1"><Hash size={10} className="text-blue-500" /> {totalPieces} pcs</span>
 </div>
 </div>

 {/* ═══════ SEARCH + CATEGORY FILTER BAR ═══════ */}
 <div className="bg-app-surface border-b border-app-border px-5 py-2.5 flex items-center gap-3 shrink-0">
 <div className="relative flex-1 group">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-violet-500 transition-colors" size={15} />
 <input
 type="text"
 placeholder="Search products, scan barcode..."
 className="w-full pl-10 pr-4 py-2 bg-app-bg border border-app-border rounded-xl text-xs font-bold outline-none focus:bg-app-surface focus:border-violet-500 transition-all"
 value={searchQuery}
 onChange={(e) => onSetSearchQuery(e.target.value)}
 />
 </div>
 <div className="flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
 <button
 onClick={() => onSetActiveCategoryId(null)}
 className={clsx(
 "px-3 py-1.5 whitespace-nowrap rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
 activeCategoryId === null ? 'bg-violet-600 text-app-text border-violet-600' : 'bg-app-surface text-app-text-muted border-app-border hover:border-violet-200'
 )}
 >
 All
 </button>
 {categories.map(cat => (
 <button
 key={cat.id}
 onClick={() => onSetActiveCategoryId(cat.id)}
 className={clsx(
 "px-3 py-1.5 whitespace-nowrap rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
 activeCategoryId === cat.id ? 'bg-violet-600 text-app-text border-violet-600' : 'bg-app-surface text-app-text-muted border-app-border hover:border-violet-200'
 )}
 >
 {cat.name}
 </button>
 ))}
 </div>
 </div>

 {/* ═══════ MAIN CONTENT ═══════ */}
 <div className="flex-1 flex overflow-hidden">
 {/* ── LEFT: Categories (expandable) + Payment ── */}
 <aside className={clsx(
 "flex flex-col bg-app-surface border-r border-app-border shrink-0 transition-all duration-500 overflow-hidden",
 leftExpanded ? "w-[55%]" : "w-[340px]"
 )}>
 {/* Toggle + Title */}
 <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between shrink-0">
 <h3 className="text-[9px] font-black text-app-text uppercase tracking-widest flex items-center gap-2">
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

 {/* Categories (when not expanded, show as scrollable list) */}
 {!leftExpanded && (
 <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
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
 : "bg-app-surface border-app-border hover:border-violet-100"
 )}
 >
 <Tag size={16} className={clsx("mx-auto mb-1.5", activeCategoryId === cat.id ? "text-violet-500" : "text-gray-300 group-hover:text-violet-400")} />
 <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest">{cat.name}</span>
 </button>
 ))}
 </div>
 </div>
 )}

 {/* Payment Section (hidden when expanded) */}
 {!leftExpanded && (
 <div className="border-t border-app-border p-4 shrink-0 bg-gray-50/30">
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
 )}
 </aside>

 {/* ── RIGHT: FULL CART VIEW ── */}
 <main className="flex-1 flex flex-col bg-[#FAFBFC] overflow-hidden">
 {/* Cart Header */}
 <div className="px-5 py-3 border-b border-app-border bg-app-surface flex items-center justify-between shrink-0">
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
 <h2 className="text-xs font-black uppercase tracking-widest text-app-text italic">Cart — Full View</h2>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-[9px] font-black text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg">{uniqueItems} lines · {totalPieces} pcs</span>
 {cart.length > 0 && (
 <button onClick={onClearCart} className="text-[8px] font-bold text-app-text-faint hover:text-rose-500 uppercase tracking-widest transition-colors">
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
 <p className="text-xs text-app-text-faint">Select a category or search to add products</p>
 </div>
 ) : (
 <table className="w-full text-sm">
 <thead className="sticky top-0 bg-app-surface z-10 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
 <tr className="text-[9px] font-black uppercase tracking-widest text-app-text-faint border-b border-app-border">
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
 <span className="font-bold text-app-text">{item.name}</span>
 </td>
 <td className="px-3 py-3.5 text-center font-mono tabular-nums text-app-text-muted">{currency}{Number(item.price).toFixed(2)}</td>
 <td className="px-3 py-3.5">
 <div className="flex items-center justify-center gap-1">
 <button onClick={() => onUpdateQuantity(item.productId, -1)} className="w-7 h-7 rounded-lg bg-app-surface-2 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center text-app-text-faint transition-all active:scale-90">
 <Minus size={12} />
 </button>
 <span className="w-10 text-center font-black tabular-nums text-app-text">{item.quantity}</span>
 <button onClick={() => onUpdateQuantity(item.productId, 1)} className="w-7 h-7 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-600 flex items-center justify-center transition-all active:scale-90">
 <Plus size={12} />
 </button>
 </div>
 </td>
 <td className="px-3 py-3.5 text-center text-[10px] font-mono text-app-text-faint">{(item.taxRate || 0)}%</td>
 <td className="px-5 py-3.5 text-right font-black tabular-nums text-app-text">{currency}{(Number(item.price) * item.quantity).toFixed(2)}</td>
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

 {/* Cart Footer Totals (always visible) */}
 <div className="border-t border-app-border bg-app-surface px-5 py-3 shrink-0">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-6">
 <div className="text-center">
 <p className="text-[8px] font-bold text-app-text-faint uppercase tracking-widest">Subtotal</p>
 <p className="text-sm font-black tabular-nums text-app-text-muted">{currency}{total.toFixed(2)}</p>
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
 <p className="text-[8px] font-bold text-app-text-faint uppercase tracking-widest">Total</p>
 <p className="text-xl font-black tabular-nums text-app-text">{currency}{totalAmount.toFixed(2)}</p>
 </div>
 {/* Quick payment when expanded */}
 {leftExpanded && (
 <button
 onClick={onCharge}
 disabled={cart.length === 0 || isProcessing}
 className={clsx(
 "py-3 px-8 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
 cart.length > 0 && !isProcessing
 ? "bg-violet-600 text-app-text shadow-lg shadow-violet-200 hover:bg-violet-700 active:scale-[0.98]"
 : "bg-app-surface-2 text-gray-300 cursor-not-allowed"
 )}
 >
 {isProcessing ? 'Processing...' : `Charge ${currency}${totalAmount.toFixed(2)}`}
 </button>
 )}
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
