'use client';

import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CompactClientHeader } from '@/components/pos/CompactClientHeader';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import {
    Search, ShoppingCart, Plus, X, Minus, Trash2, User, ChevronDown,
    Layout, Maximize, Minimize, FileText, Settings, Wallet, Save,
    Book, File, ArrowLeft, CreditCard, Banknote, Zap
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

/**
 * Layout C: "Compact" — Speed Terminal
 * High-density, dark-themed layout for expert cashiers.
 * Products left (50%), cart + payment right (50%).
 * Full functionality with all buttons, monospace numbers, keyboard-ready.
 */
export function POSLayoutCompact(props: POSLayoutProps) {
    const {
        cart, clients, selectedClient, selectedClientId, categories,
        sessions, activeSessionId, currency, total, discount, totalAmount,
        totalPieces, uniqueItems, searchQuery, activeCategoryId,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        isOverrideOpen, isReceiptOpen, lastOrder,
        onSetSearchQuery, onSetActiveCategoryId, onSetActiveSessionId,
        onSetPaymentMethod, onSetCashReceived, onSetDiscount, onAddToCart, onUpdateQuantity,
        onClearCart, onCreateNewSession, onRemoveSession, onUpdateActiveSession,
        onToggleFullscreen, onCharge, onOpenLayoutSelector,
        onSetOverrideOpen, onSetReceiptOpen
    } = props;

    return (
        <div className={clsx(
            "flex flex-col bg-[#0f1117] overflow-hidden select-none h-full text-gray-100",
            isFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen" : "absolute inset-0"
        )}>
            {/* ═══════ HEADER — FULL FEATURE (Dark) ═══════ */}
            <header className="h-12 bg-[#1a1d27] border-b border-[#2a2d37] flex items-center justify-between px-4 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-black tracking-tighter text-gray-100 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                            <Zap size={16} className="text-white" />
                        </div>
                        <span className="text-amber-400">Speed</span> Terminal
                    </h1>

                    {/* Session Tabs */}
                    <div className="flex gap-1 ml-2 overflow-x-auto max-w-md no-scrollbar">
                        {sessions.map(s => (
                            <div key={s.id} className="flex shrink-0 group">
                                <button
                                    onClick={() => onSetActiveSessionId(s.id)}
                                    className={clsx(
                                        "flex items-center gap-1 px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all font-mono",
                                        activeSessionId === s.id
                                            ? "bg-amber-500 text-black"
                                            : "bg-[#2a2d37] text-gray-500 hover:bg-[#333640]"
                                    )}
                                >
                                    {s.name}
                                </button>
                                <button onClick={() => onRemoveSession(s.id)} className="ml-[-4px] p-0.5 text-gray-600 hover:text-rose-400 transition-all opacity-0 group-hover:opacity-100">
                                    <X size={8} />
                                </button>
                            </div>
                        ))}
                        <button onClick={onCreateNewSession} className="w-6 h-6 flex items-center justify-center bg-[#2a2d37] text-gray-500 rounded hover:bg-amber-500/20 hover:text-amber-400 transition-all">
                            <Plus size={11} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <button onClick={onToggleFullscreen} className="bg-amber-500/10 border border-amber-500/20 text-amber-400 h-7 px-2.5 rounded font-bold hover:bg-amber-500 hover:text-black transition-all flex items-center gap-1">
                        {isFullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
                        <span className="text-[8px] uppercase tracking-widest font-black font-mono">{isFullscreen ? 'Exit' : 'Full'}</span>
                    </button>
                    <div className="h-4 w-px bg-[#2a2d37] mx-0.5" />
                    <button onClick={onOpenLayoutSelector} className="w-7 h-7 flex items-center justify-center bg-[#1a1d27] border border-[#2a2d37] rounded text-gray-500 hover:text-amber-400 hover:border-amber-500/30 transition-all" title="Switch Layout">
                        <Layout size={13} />
                    </button>
                    {[FileText, Settings, Wallet, Save, Book, File].map((Icon, i) => (
                        <button key={i} className="w-7 h-7 flex items-center justify-center bg-[#1a1d27] border border-[#2a2d37] rounded text-gray-500 hover:text-amber-400 hover:border-amber-500/30 transition-all">
                            <Icon size={13} />
                        </button>
                    ))}
                    <button className="w-7 h-7 flex items-center justify-center bg-white/5 text-gray-400 rounded hover:bg-white/10 transition-all ml-0.5">
                        <ArrowLeft size={13} />
                    </button>
                </div>
            </header>

            {/* ═══════ CLIENT INFO (Dark) ═══════ */}
            <div className="h-8 bg-[#15171f] border-b border-[#2a2d37] px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <User className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" size={10} />
                        <select
                            value={selectedClientId}
                            onChange={(e) => onUpdateActiveSession({ clientId: Number(e.target.value) })}
                            className="pl-6 pr-4 py-0.5 bg-transparent text-[9px] font-black text-gray-300 appearance-none outline-none cursor-pointer uppercase tracking-widest"
                        >
                            {clients.map(c => <option key={c.id} value={c.id} className="bg-[#1a1d27]">{c.name}</option>)}
                        </select>
                    </div>
                    <span className="text-[8px] font-mono text-gray-600">|</span>
                    <span className="text-[8px] font-mono text-gray-500">{selectedClient.phone}</span>
                    <span className="text-[8px] font-mono text-gray-600">|</span>
                    <span className="text-[8px] font-mono text-amber-500/60">BAL: {currency}{selectedClient.balance}</span>
                </div>
                <div className="flex items-center gap-3 text-[8px] font-mono text-gray-600">
                    <span>{uniqueItems} SKU</span>
                    <span>·</span>
                    <span>{totalPieces} PCS</span>
                </div>
            </div>

            {/* ═══════ SEARCH + CATEGORY BAR (Dark) ═══════ */}
            <div className="bg-[#1a1d27] border-b border-[#2a2d37] px-4 py-2 flex items-center gap-2 shrink-0">
                <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-amber-500 transition-colors" size={13} />
                    <input
                        type="text"
                        placeholder="SKU / barcode / name..."
                        className="w-full pl-9 pr-4 py-1.5 bg-[#0f1117] border border-[#2a2d37] rounded-lg text-xs font-mono font-bold text-gray-200 outline-none focus:border-amber-500/50 transition-all placeholder:text-gray-700"
                        value={searchQuery}
                        onChange={(e) => onSetSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-1 overflow-x-auto no-scrollbar shrink-0">
                    <button
                        onClick={() => onSetActiveCategoryId(null)}
                        className={clsx(
                            "px-2.5 py-1 whitespace-nowrap rounded text-[8px] font-black uppercase tracking-widest transition-all font-mono",
                            activeCategoryId === null ? 'bg-amber-500 text-black' : 'bg-[#2a2d37] text-gray-500 hover:text-amber-400'
                        )}
                    >
                        ALL
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => onSetActiveCategoryId(cat.id)}
                            className={clsx(
                                "px-2.5 py-1 whitespace-nowrap rounded text-[8px] font-black uppercase tracking-widest transition-all font-mono",
                                activeCategoryId === cat.id ? 'bg-amber-500 text-black' : 'bg-[#2a2d37] text-gray-500 hover:text-amber-400'
                            )}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
                <button className="h-7 px-3 bg-amber-500 text-black rounded text-[8px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all flex items-center gap-1 font-mono shrink-0">
                    <Plus size={12} />
                    ADD
                </button>
            </div>

            {/* ═══════ MAIN CONTENT ═══════ */}
            <div className="flex-1 flex overflow-hidden">
                {/* ─── LEFT: Products ─── */}
                <div className="w-1/2 flex flex-col overflow-hidden border-r border-[#2a2d37]">
                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                        <ProductGrid
                            searchQuery={searchQuery}
                            categoryId={activeCategoryId}
                            onAddToCart={onAddToCart}
                            currency={currency}
                            variant="compact"
                        />
                    </div>
                </div>

                {/* ─── RIGHT: Cart + Payment ─── */}
                <div className="w-1/2 flex flex-col overflow-hidden bg-[#12141c]">
                    {/* Cart Header */}
                    <div className="px-4 py-2 border-b border-[#2a2d37] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <h2 className="text-[9px] font-black uppercase tracking-widest text-gray-400 font-mono">ORDER</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[8px] font-mono font-bold text-amber-500">{uniqueItems}L · {totalPieces}P</span>
                            {cart.length > 0 && (
                                <button onClick={onClearCart} className="text-[7px] font-black text-gray-600 hover:text-rose-400 uppercase tracking-widest font-mono transition-colors">
                                    CLR
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Dense Cart Table */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-2">
                                <ShoppingCart size={32} strokeWidth={1} />
                                <p className="text-[10px] font-mono font-bold">EMPTY</p>
                            </div>
                        ) : (
                            <table className="w-full text-xs font-mono">
                                <thead className="sticky top-0 bg-[#1a1d27] z-10">
                                    <tr className="text-[7px] font-black uppercase tracking-widest text-gray-600 border-b border-[#2a2d37]">
                                        <th className="text-left px-3 py-2">Item</th>
                                        <th className="text-center px-2 py-2 w-16">Price</th>
                                        <th className="text-center px-2 py-2 w-24">Qty</th>
                                        <th className="text-center px-1 py-2 w-10">Tax</th>
                                        <th className="text-right px-3 py-2 w-18">Total</th>
                                        <th className="w-7"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1e2029]">
                                    {cart.map((item: any) => (
                                        <tr key={item.productId} className="group hover:bg-amber-500/5 transition-colors">
                                            <td className="px-3 py-2">
                                                <span className="font-bold text-gray-200 text-[11px]">{item.name}</span>
                                            </td>
                                            <td className="px-2 py-2 text-center tabular-nums text-gray-500 text-[10px]">{Number(item.price).toFixed(2)}</td>
                                            <td className="px-2 py-2">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <button onClick={() => onUpdateQuantity(item.productId, -1)} className="w-5 h-5 rounded bg-[#2a2d37] hover:bg-rose-500/20 hover:text-rose-400 flex items-center justify-center text-gray-500 transition-all">
                                                        <Minus size={9} />
                                                    </button>
                                                    <span className="w-8 text-center font-black tabular-nums text-amber-400 text-[11px]">{item.quantity}</span>
                                                    <button onClick={() => onUpdateQuantity(item.productId, 1)} className="w-5 h-5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 flex items-center justify-center transition-all">
                                                        <Plus size={9} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-1 py-2 text-center text-[9px] text-gray-600">{(item.taxRate || 0)}%</td>
                                            <td className="px-3 py-2 text-right font-black tabular-nums text-gray-200 text-[11px]">{(Number(item.price) * item.quantity).toFixed(2)}</td>
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

                    {/* Payment & Totals */}
                    <div className="border-t border-[#2a2d37] bg-[#1a1d27] px-4 py-3 shrink-0">
                        {/* Totals Row */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-4 text-[9px] font-mono">
                                <span className="text-gray-600">SUB: <span className="text-gray-400 font-bold">{currency}{total.toFixed(2)}</span></span>
                                {discount > 0 && (
                                    <span className="text-amber-600 flex items-center gap-1">
                                        DISC:
                                        {props.onSetDiscountType && (
                                            <div className="flex bg-[#2a2d37] rounded overflow-hidden cursor-pointer" onClick={(e) => {
                                                e.stopPropagation();
                                                props.onSetDiscountType!(props.discountType === 'fixed' ? 'percentage' : 'fixed')
                                            }}>
                                                <span className={clsx("px-1.5 py-px", props.discountType === 'fixed' ? "bg-amber-500 text-black" : "text-amber-600")}>{currency}</span>
                                                <span className={clsx("px-1.5 py-px", props.discountType === 'percentage' ? "bg-amber-500 text-black" : "text-amber-600")}>%</span>
                                            </div>
                                        )}
                                        <span className="font-bold ml-1">-{props.discountType === 'fixed' ? currency : ''}{discount.toFixed(2)}{props.discountType === 'percentage' ? '%' : ''}</span>
                                    </span>
                                )}
                            </div>
                            <div className="text-right">
                                <span className="text-lg font-black tabular-nums text-amber-400 font-mono">{currency}{totalAmount.toFixed(2)}</span>
                            </div>
                        </div>
                        {(selectedClient?.loyalty || 0) > 0 && props.onSetPointsRedeemed && (
                            <div className="flex items-center justify-between mb-3 text-[9px] font-mono border-t border-[#2a2d37] pt-2">
                                <span className="text-emerald-500 font-bold">LOYALTY: {selectedClient?.loyalty} PTS</span>
                                <button
                                    onClick={() => {
                                        const toggleTo = props.pointsRedeemed === selectedClient?.loyalty ? 0 : selectedClient?.loyalty;
                                        props.onSetPointsRedeemed!(toggleTo || 0);
                                    }}
                                    className={clsx(
                                        "px-2 py-1 rounded font-black transition-all",
                                        props.pointsRedeemed! > 0 ? "bg-emerald-500 text-black border-emerald-500" : "bg-[#2a2d37] text-gray-400 hover:text-emerald-400"
                                    )}
                                >
                                    {props.pointsRedeemed! > 0 ? `REDEEMING ${props.pointsRedeemed}` : 'USE ALL'}
                                </button>
                            </div>
                        )}

                        {/* Payment Method */}
                        <div className="flex gap-1.5 mb-3">
                            <button
                                onClick={() => onSetPaymentMethod('CASH')}
                                className={clsx(
                                    "flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest font-mono flex items-center justify-center gap-1.5 transition-all",
                                    paymentMethod === 'CASH' ? 'bg-emerald-500 text-black' : 'bg-[#2a2d37] text-gray-500 hover:text-emerald-400'
                                )}
                            >
                                <Banknote size={12} /> CASH
                            </button>
                            <button
                                onClick={() => onSetPaymentMethod('CARD')}
                                className={clsx(
                                    "flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest font-mono flex items-center justify-center gap-1.5 transition-all",
                                    paymentMethod === 'CARD' ? 'bg-blue-500 text-black' : 'bg-[#2a2d37] text-gray-500 hover:text-blue-400'
                                )}
                            >
                                <CreditCard size={12} /> CARD
                            </button>
                            <button
                                onClick={() => onSetPaymentMethod('WALLET')}
                                className={clsx(
                                    "flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest font-mono flex items-center justify-center gap-1.5 transition-all",
                                    paymentMethod === 'WALLET' ? 'bg-indigo-500 text-black' : 'bg-[#2a2d37] text-gray-500 hover:text-indigo-400'
                                )}
                            >
                                <Wallet size={12} /> WALLET
                            </button>
                        </div>

                        {/* Cash Input */}
                        <div className="flex items-center gap-2 mb-3">
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Cash received..."
                                value={cashReceived ? Number(cashReceived.replace(/\D/g, '')).toLocaleString('fr-FR') : ''}
                                onChange={(e) => {
                                    const numVal = e.target.value.replace(/\s+/g, '').replace(/,/g, '.');
                                    if (/^\d*\.?\d*$/.test(numVal)) onSetCashReceived(numVal);
                                }}
                                className="flex-1 px-3 py-2 bg-[#0f1117] border border-[#2a2d37] rounded-lg text-sm font-mono font-bold text-gray-200 outline-none focus:border-amber-500/50 placeholder:text-gray-700 text-right tabular-nums"
                            />
                        </div>

                        {cashReceived && Number(cashReceived.replace(/\D/g, '')) > totalAmount && props.onSetStoreChangeInWallet && (
                            <label className="flex items-center justify-center gap-2 cursor-pointer mb-3 text-[9px] font-black tracking-widest text-[#a8b8d0] bg-[#2a2d37] px-2 py-2 rounded-lg hover:bg-[#343844] transition-colors font-mono w-full">
                                <input
                                    type="checkbox"
                                    checked={props.storeChangeInWallet}
                                    onChange={(e) => props.onSetStoreChangeInWallet!(e.target.checked)}
                                    className="rounded border-[#4c5265] text-amber-500 focus:ring-amber-500 w-3 h-3 bg-[#0f1117]"
                                />
                                SAVE CHANGE TO WALLET ({currency}{(Number(cashReceived.replace(/\D/g, '')) - totalAmount).toLocaleString('fr-FR', { minimumFractionDigits: 0 })})
                            </label>
                        )}

                        {/* Charge Button */}
                        <button
                            onClick={onCharge}
                            disabled={cart.length === 0 || isProcessing}
                            className={clsx(
                                "w-full py-3 rounded-xl flex flex-col items-center justify-center transition-all",
                                cart.length > 0 && !isProcessing
                                    ? "bg-amber-500 text-black hover:bg-amber-400 active:scale-[0.98]"
                                    : "bg-[#2a2d37] text-gray-700 cursor-not-allowed"
                            )}
                        >
                            {isProcessing ? (
                                <span className="text-sm font-black font-mono tracking-widest">⏳ PROCESSING...</span>
                            ) : (
                                <>
                                    <span className="text-sm font-black uppercase tracking-widest font-mono leading-tight">⚡ CHARGE {currency}{totalAmount.toFixed(2)}</span>
                                    {cashReceived && Number(cashReceived.replace(/\D/g, '')) > totalAmount && (
                                        <span className="text-[10px] font-black font-mono tracking-widest bg-black/20 px-2 py-0.5 rounded mt-1">
                                            CHG: {currency}{(Number(cashReceived.replace(/\D/g, '')) - totalAmount).toLocaleString('fr-FR', { minimumFractionDigits: 0 })}
                                        </span>
                                    )}
                                </>
                            )}
                        </button>
                    </div>
                </div>
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
