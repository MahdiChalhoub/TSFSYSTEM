'use client';

import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CompactClientHeader } from '@/components/pos/CompactClientHeader';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { POSToolbar } from '@/components/pos/POSToolbar';
import {
    Search, ShoppingCart, Plus, X, Minus, Trash2, User, ChevronDown,
    Layout, Maximize, Minimize, FileText, Settings, Wallet, Save,
    Book, File, ArrowLeft, CreditCard, Banknote, Zap, Calculator,
    History, GripHorizontal, Wifi, WifiOff, MapPin, RefreshCw
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';
import { Numpad as POSNumpad } from '@/components/pos/Numpad';
import { MultiPaymentHub } from '@/components/pos/MultiPaymentHub';


const formatNumber = (num: number | string) => {
    const val = Number(num) || 0;
    const parts = val.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return parts[1] === '00' ? parts[0] : parts.join('.');
};

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
        totalPieces, uniqueItems, searchQuery, activeCategoryId, currentParentId,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        isOverrideOpen, isReceiptOpen, lastOrder, highlightedItemId, lastAddedItemId,
        isOnline, clientSearchQuery, deliveryZone, deliveryZones,
        onSetSearchQuery, onSetActiveCategoryId, onSetCurrentParentId, onSetActiveSessionId,
        onSetPaymentMethod, onSetCashReceived, onSetDiscount, onAddToCart, onUpdateQuantity,
        onClearCart, onCreateNewSession, onRemoveSession, onUpdateActiveSession,
        onToggleFullscreen, onCharge, onSync, onSetIsOnline,
        onSetClientSearchQuery, onSetDeliveryZone, onOpenLayoutSelector,
        onSetOverrideOpen, onSetReceiptOpen,
        onSetNotes,
        currentLayout, onSearchClients
    } = props;
    const registerConfig = (props as any).registerConfig;
    const onLockRegister = (props as any).onLockRegister || (() => { });
    const paymentMethods = (props as any).paymentMethods || [
        { key: 'CASH', label: 'CASH' },
        { key: 'CARD', label: 'CARD' },
        { key: 'WALLET', label: 'WALLET' },
        { key: 'OM', label: 'OM' },
        { key: 'WAVE', label: 'WAVE' },
        { key: 'MULTI', label: 'MULTI' }
    ];
    const [isMultiPayMode, setIsMultiPayMode] = useState(false);

    const receivedNum = Number(cashReceived) || 0;
    const changeDue = receivedNum > totalAmount ? receivedNum - totalAmount : 0;

    // Draggable Floating Logic
    const [showNumpad, setShowNumpad] = useState(false);
    const [numpadPos, setNumpadPos] = useState({ x: 400, y: 150 });

    // Safety check for window to avoid hydration errors
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setNumpadPos({ x: window.innerWidth - 350, y: 150 });
        }
    }, []);
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const startDragging = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - numpadPos.x,
            y: e.clientY - numpadPos.y
        };
    };

    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            if (!isDragging) return;
            requestAnimationFrame(() => {
                setNumpadPos({
                    x: e.clientX - dragOffset.current.x,
                    y: e.clientY - dragOffset.current.y
                });
            });
        };
        const stopDragging = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', stopDragging);
        }
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', stopDragging);
        };
    }, [isDragging]);

    const filteredClients = clients;

    return (
        <div className={clsx(
            "flex flex-col bg-[#0f1117] overflow-hidden select-none h-full text-gray-100",
            isFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen" : "absolute inset-0"
        )}>
            {/* ═══════ SHARED TOOLBAR ═══════ */}
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
                onSelectClient={(id: number) => { onUpdateActiveSession({ clientId: id }); }}
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
            />

            {/* ═══════ CLIENT INFO (Dark) ═══════ */}
            <div className="h-10 bg-[#15171f] border-b border-[#2a2d37] px-4 flex items-center gap-3 shrink-0">
                <div className="flex-1 relative group max-w-xs">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" size={10} />
                    <input
                        type="text"
                        placeholder="Find customer..."
                        value={clientSearchQuery}
                        onChange={(e) => {
                            const v = e.target.value;
                            onSetClientSearchQuery(v);
                            if (onSearchClients) onSearchClients(v);
                        }}
                        className="w-full pl-6 pr-3 py-1 bg-transparent border border-[#2a2d37] rounded text-[9px] font-black text-gray-300 outline-none focus:border-amber-500/50 transition-all placeholder:text-gray-700"
                    />
                    {clientSearchQuery && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1d27] border border-[#2a2d37] rounded shadow-2xl z-[100] max-h-32 overflow-y-auto custom-scrollbar">
                            {filteredClients.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => {
                                        onUpdateActiveSession({ clientId: c.id });
                                        onSetClientSearchQuery('');
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-amber-500/10 border-b border-[#2a2d37]/50 flex items-center justify-between group"
                                >
                                    <div>
                                        <p className="text-[9px] font-black text-gray-300 group-hover:text-amber-400">{c.name}</p>
                                        <p className="text-[8px] text-gray-600 font-mono">{c.phone}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="w-24 relative group shrink-0">
                    <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" size={10} />
                    <select
                        value={deliveryZone}
                        onChange={(e) => onSetDeliveryZone(e.target.value)}
                        className="w-full pl-6 pr-4 py-1 bg-transparent text-[9px] font-black text-gray-400 appearance-none outline-none cursor-pointer uppercase tracking-widest border border-[#2a2d37] rounded"
                    >
                        {deliveryZones.map(z => (
                            <option key={z.id} value={z.name} className="bg-[#1a1d27]">{z.name}</option>
                        ))}
                        {deliveryZones.length === 0 && (
                            <option value="A" className="bg-[#1a1d27]">Zone A</option>
                        )}
                    </select>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-gray-200 uppercase tracking-widest truncate max-w-[100px]">{selectedClient?.name}</span>
                    <span className="text-[8px] font-mono text-gray-600">|</span>
                    <span className="text-[8px] font-mono text-amber-500/60 font-black">BAL: {currency}{formatNumber(selectedClient?.balance || 0)}</span>
                    <span className="text-[8px] font-mono text-gray-600">|</span>
                    <span className="text-[8px] font-mono text-gray-500 font-bold">{formatNumber(totalPieces)} PCS</span>
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
                <div className="flex gap-1 overflow-x-auto no-scrollbar shrink-0 items-center">
                    {currentParentId === null ? (
                        <>
                            <button
                                onClick={() => {
                                    onSetActiveCategoryId(null);
                                    onSetCurrentParentId(null);
                                }}
                                className={clsx(
                                    "px-3 py-1.5 whitespace-nowrap rounded text-[11px] font-black uppercase tracking-widest transition-all font-mono border",
                                    activeCategoryId === null ? 'bg-amber-500 text-black border-amber-500' : 'bg-[#2a2d37] text-gray-400 border-[#2a2d37] hover:text-amber-400'
                                )}
                            >
                                ALL
                            </button>
                            {categories.filter(c => !((c as any).parent || (c as any).parentId || (c as any).parent_id)).map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        onSetActiveCategoryId(cat.id);
                                        onSetCurrentParentId(cat.id);
                                    }}
                                    className={clsx(
                                        "px-3 py-1.5 whitespace-nowrap rounded text-[11px] font-black uppercase tracking-widest transition-all font-mono border",
                                        (activeCategoryId === cat.id || currentParentId === cat.id) ? 'bg-amber-500 text-black border-amber-500' : 'bg-[#2a2d37] text-gray-400 border-[#2a2d37] hover:text-amber-400'
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    const parent = categories.find(c => c.id === currentParentId);
                                    const grandParentId = (parent as any)?.parent || (parent as any)?.parentId || (parent as any)?.parent_id || null;
                                    onSetCurrentParentId(grandParentId);
                                    if (grandParentId === null) onSetActiveCategoryId(null);
                                }}
                                className="h-7 px-3 bg-amber-500 text-black rounded text-[9px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all flex items-center gap-1 font-mono shrink-0"
                            >
                                <ArrowLeft size={12} />
                                {categories.find(c => c.id === currentParentId)?.name}
                            </button>
                            <div className="w-[1px] h-4 bg-[#2a2d37] mx-1 shrink-0" />
                            {categories.filter(c => ((c as any).parent || (c as any).parentId || (c as any).parent_id) === currentParentId).map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        onSetActiveCategoryId(cat.id);
                                        const hasChildren = categories.some(c => ((c as any).parent || (c as any).parentId || (c as any).parent_id) === cat.id);
                                        if (hasChildren) onSetCurrentParentId(cat.id);
                                    }}
                                    className={clsx(
                                        "px-3 py-1.5 whitespace-nowrap rounded text-[11px] font-black uppercase tracking-widest transition-all font-mono border",
                                        activeCategoryId === cat.id ? 'bg-amber-500 text-black border-amber-500' : 'bg-[#2a2d37] text-gray-400 border-[#2a2d37] hover:text-amber-400'
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </>
                    )}
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
                                <button onClick={() => onClearCart(false)} className="text-[7px] font-black text-gray-600 hover:text-rose-400 uppercase tracking-widest font-mono transition-colors">
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
                                        <tr
                                            key={item.productId}
                                            className={clsx(
                                                "group transition-colors duration-300",
                                                highlightedItemId === item.productId ? "bg-amber-500/50"
                                                    : lastAddedItemId === item.productId ? "bg-amber-500/20"
                                                        : "hover:bg-amber-500/5"
                                            )}
                                        >
                                            <td className="px-3 py-2">
                                                <span className="font-black text-gray-100 text-[13px]">{item.name}</span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {item.barcode && <span className="text-[10px] font-bold text-gray-600 font-mono">#{item.barcode}</span>}
                                                    <span className="text-[10px] font-bold text-amber-500/80 bg-amber-500/5 px-1 rounded border border-amber-500/10">STK: {item.stock || 0}</span>
                                                </div>
                                                {/* Line Note Input */}
                                                {(highlightedItemId === item.productId || lastAddedItemId === item.productId || item.note) && (
                                                    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="text"
                                                            placeholder="Note..."
                                                            defaultValue={item.note || ''}
                                                            className="w-full text-[10px] bg-[#1a1d27] border border-[#2a2d37] rounded px-1.5 py-1 outline-none text-gray-300 placeholder:text-gray-600 focus:border-amber-500/50 transition-all font-mono"
                                                            onBlur={(e) => { (props as any).onUpdateLineNote?.(item.productId, e.target.value); }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    (props as any).onUpdateLineNote?.(item.productId, (e.target as HTMLInputElement).value);
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-2 py-2 text-center tabular-nums text-gray-500 text-[12px] font-mono">{Number(item.price).toFixed(2)}</td>
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
                                            <td className="px-1 py-2 text-center text-[10px] text-gray-600 font-mono">VAT {(item.taxRate || 0)}%</td>
                                            <td className="px-3 py-2 text-right font-black tabular-nums text-amber-400 text-[13px] font-mono">{(Number(item.price) * item.quantity).toFixed(2)}</td>
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
                                <span className="text-gray-600 uppercase tracking-widest font-black">Sub: <span className="text-gray-400 font-black">{currency}{formatNumber(total)}</span></span>
                                {discount > 0 && (
                                    <span className="text-amber-600 flex items-center gap-1 font-black">
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
                                        <span className="font-black ml-1">-{props.discountType === 'fixed' ? currency : ''}{formatNumber(discount)}{props.discountType === 'percentage' ? '%' : ''}</span>
                                    </span>
                                )}
                            </div>
                            <div className="text-right">
                                <span className="text-xl font-black tabular-nums text-amber-500 font-mono tracking-tighter">{currency}{formatNumber(totalAmount)}</span>
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

                        {/* Payment Method — dynamic from register config */}
                        <div className="flex gap-1.5 mb-3 flex-wrap">
                            {paymentMethods.map((m: any) => {
                                const key = typeof m === 'string' ? m : m.key;
                                const label = typeof m === 'string' ? m : (m.label || key);
                                const alwaysAllowed = ['MULTI', 'DELIVERY', 'CREDIT'].includes(key);
                                const isLinked = alwaysAllowed || (typeof m === 'object' && m.accountId);
                                const isActive = paymentMethod === key;

                                // Icon mapping
                                let Icon: any = Banknote;
                                if (key.includes('CARD')) Icon = CreditCard;
                                if (key.includes('WALLET')) Icon = Wallet;
                                if (key.includes('MULTI') || key.includes('CALC')) Icon = Calculator;

                                // Color mapping per method
                                const activeColor = key.includes('CARD') ? 'bg-blue-500 text-black'
                                    : key.includes('WALLET') ? 'bg-indigo-500 text-black'
                                        : key.includes('CREDIT') ? 'bg-amber-500 text-black'
                                            : 'bg-emerald-500 text-black';

                                if (key === 'MULTI') {
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setIsMultiPayMode(true)}
                                            className="flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest font-mono flex items-center justify-center gap-1.5 transition-all bg-[#2a2d37] text-gray-400 hover:bg-amber-500/20 hover:text-amber-400"
                                        >
                                            <Icon size={12} /> {label}
                                        </button>
                                    );
                                }

                                return (
                                    <button
                                        key={key}
                                        disabled={!isLinked}
                                        title={!isLinked ? `⚠️ ${label}: not linked to a ledger account` : label}
                                        onClick={() => isLinked && onSetPaymentMethod(key)}
                                        className={clsx(
                                            'flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest font-mono flex items-center justify-center gap-1.5 transition-all',
                                            !isLinked
                                                ? 'bg-[#2a2d37] text-gray-600 opacity-40 cursor-not-allowed'
                                                : isActive
                                                    ? activeColor
                                                    : 'bg-[#2a2d37] text-gray-500 hover:text-emerald-400'
                                        )}
                                    >
                                        <Icon size={12} /> {label}
                                    </button>
                                );
                            })}
                        </div>


                        {/* Cash Input */}
                        <div className="flex items-center gap-2 mb-3">
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Cash received..."
                                value={cashReceived ? cashReceived.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ''}
                                onChange={(e) => {
                                    const raw = e.target.value.replace(/\s+/g, '').replace(',', '.');
                                    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                                        onSetCashReceived(raw);
                                    }
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
                                "w-full py-4 rounded-xl flex flex-col items-center justify-center transition-all shadow-2xl",
                                cart.length > 0 && !isProcessing
                                    ? "bg-amber-500 text-black hover:bg-amber-400 active:scale-[0.98] shadow-amber-500/20"
                                    : "bg-[#2a2d37] text-gray-700 cursor-not-allowed"
                            )}
                        >
                            {isProcessing ? (
                                <span className="text-sm font-black font-mono tracking-widest">⏳ PROCESSING...</span>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <span className="text-sm font-black uppercase tracking-widest font-mono">
                                        {changeDue > 0 ? "⚡ RETURN CHANGE" : `⚡ CHARGE ${currency}${formatNumber(totalAmount)}`}
                                    </span>
                                    {changeDue > 0 && (
                                        <span className="text-2xl font-black font-mono mt-1 animate-pulse">
                                            {currency}{formatNumber(changeDue)}
                                        </span>
                                    )}
                                </div>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Floating Speed Calc Overlay */}
            {showNumpad && (
                <div
                    style={{
                        position: 'fixed',
                        left: 0,
                        top: 0,
                        transform: `translate3d(${numpadPos.x}px, ${numpadPos.y}px, 0)`,
                        cursor: isDragging ? 'grabbing' : 'default',
                        willChange: 'transform'
                    }}
                    className={clsx(
                        "z-[50] w-[280px] p-2 bg-[#1a1d27]/95 backdrop-blur-md rounded-2xl border border-amber-500/30 shadow-2xl shadow-black/60 animate-in zoom-in-95 ring-4 ring-amber-500/10",
                        !isDragging && "transition-transform duration-200 ease-out"
                    )}
                >
                    <div
                        onMouseDown={startDragging}
                        className="flex items-center justify-between px-2 mb-2 cursor-grab active:cursor-grabbing hover:bg-white/5 rounded-lg p-1 transition-colors group/handle"
                    >
                        <div className="flex items-center gap-1.5">
                            <GripHorizontal size={14} className="text-amber-500/60 group-hover/handle:text-amber-500 transition-colors" />
                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest font-mono">Speed Calc</span>
                        </div>
                        <button onClick={() => setShowNumpad(false)} className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-black transition-all">
                            <X size={12} />
                        </button>
                    </div>
                    <POSNumpad
                        onValueConfirm={(val, mode) => {
                            if (cart.length > 0) {
                                const target = cart[0];
                                if (mode === 'qty') {
                                    const delta = val - target.quantity;
                                    onUpdateQuantity(target.productId, delta);
                                } else if (mode === 'price' && (props as any).onUpdatePrice) {
                                    (props as any).onUpdatePrice(target.productId, val);
                                } else if (mode === 'disc' && props.onUpdateLineDiscount) {
                                    props.onUpdateLineDiscount(target.productId, val);
                                }
                            } else {
                                toast.error("Add an item first");
                            }
                        }}
                    />
                </div>
            )}


            <ReceiptModal
                isOpen={isReceiptOpen}
                onClose={() => onSetReceiptOpen(false)}
                orderId={lastOrder?.id || null}
                refCode={lastOrder?.ref || null}
            />
            <MultiPaymentHub
                isOpen={isMultiPayMode}
                onClose={() => setIsMultiPayMode(false)}
                totalAmount={totalAmount}
                currency={currency}
                paymentMethods={paymentMethods}
                client={selectedClient}
                isProcessing={isProcessing}
                allowedAccounts={registerConfig?.allowedAccounts || []}
                onConfirm={(legs: { method: string; amount: number }[]) => {
                    const legsNote = legs.map((l: { method: string; amount: number }) => `${l.method}:${l.amount.toFixed(2)}`).join(' | ');
                    if (onSetNotes) onSetNotes(legsNote);
                    if (props.onSetPaymentLegs) props.onSetPaymentLegs(legs);
                    const totalPaid = legs.reduce((sum: number, l: { amount: number }) => sum + l.amount, 0);
                    onSetCashReceived(String(totalPaid));
                    if (legs.length > 0) onSetPaymentMethod(legs[0].method);
                    setIsMultiPayMode(false);
                    setTimeout(() => onCharge(), 300);
                }}
            />
        </div>

    );
}
