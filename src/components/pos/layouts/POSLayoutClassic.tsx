'use client';

import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CompactClientHeader } from '@/components/pos/CompactClientHeader';
import { Numpad as POSNumpad, NumpadMode } from '@/components/pos/Numpad';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { POSToolbar } from '@/components/pos/POSToolbar';
import {
    Search, ShoppingCart, Plus, X, Minus, Trash2, User, ChevronDown, Layout,
    Maximize, Minimize, FileText, Settings, Wallet, Save, Book, File, ArrowLeft, RefreshCw, Wifi, WifiOff, MapPin, Calculator,
    History, GripHorizontal, MessageSquare, ShieldCheck, Star, Coins, Banknote, CreditCard, Smartphone, Landmark, AlertCircle
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';
import { MultiPaymentHub } from '@/components/pos/MultiPaymentHub';
import { ClientVaultModal } from '@/components/pos/modals/ClientVaultModal';


const formatNumber = (num: number | string) => {
    const val = Number(num) || 0;
    const parts = val.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return parts[1] === '00' ? parts[0] : parts.join('.');
};
/**
 * Layout A: "Classic" — Odoo-Inspired
 * Products left (65%), Order panel right (35%) with numpad.
 * Full functionality: fullscreen, all action buttons, sessions, client info.
 */
export function POSLayoutClassic(props: POSLayoutProps) {
    const {
        cart, clients, selectedClient, selectedClientId, categories,
        sessions, activeSessionId, currency, total, discount, discountType, totalAmount,
        totalPieces, uniqueItems, searchQuery, activeCategoryId, currentParentId,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        isOverrideOpen, isReceiptOpen, lastOrder, highlightedItemId, lastAddedItemId,
        isOnline, clientSearchQuery, deliveryZone, deliveryZones, registerConfig,
        clientFidelity, fidelityLoading,

        // Handlers
        onSetSearchQuery, onSetActiveCategoryId, onSetCurrentParentId, onSetActiveSessionId,
        onSetPaymentMethod, onSetCashReceived, onSetDiscount, onSetDiscountType,
        onSetOverrideOpen, onSetReceiptOpen, onAddToCart,
        onUpdateQuantity, onUpdatePrice, onUpdateLineDiscount, onUpdateLineNote,
        onClearCart, onCreateNewSession, onRemoveSession,
        onUpdateActiveSession, onToggleFullscreen, onCharge,
        onSync, onSetIsOnline, onSetClientSearchQuery, onSetDeliveryZone,
        onOpenLayoutSelector, onSetNotes, onSetPointsRedeemed, onSetPaymentLegs,
        onLockRegister, onCloseRegister, onOpenReturn, onSearchClients,
        getClientFidelityData, setIsVaultOpen, isVaultOpen,
        currentLayout
    } = props;

    const filteredClients = (clients || []).filter((c: any) =>
        !clientSearchQuery ||
        (c.name || '').toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
        (c.phone || '').includes(clientSearchQuery)
    );

    const paymentMethods = registerConfig?.payment_methods || (props as any).paymentMethods || [
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
    const [numpadMode, setNumpadMode] = useState<NumpadMode>('qty');
    const [selectedCartIdx, setSelectedCartIdx] = useState<number | null>(null);
    const [openNoteId, setOpenNoteId] = useState<number | null>(null);
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

    const handleOpenVault = async () => {
        if (!selectedClient) return;
        setIsVaultOpen(true);
        await getClientFidelityData(selectedClient.id);
    };

    return (
        <div className={clsx(
            "flex flex-col bg-[#020617] overflow-hidden select-none h-full font-sans transition-colors duration-700",
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
                onCloseRegister={onCloseRegister}
                onOpenReturn={onOpenReturn}
            />

            {/* ═══════ CLIENT INFO BAR ═══════ */}
            <CompactClientHeader
                client={selectedClient}
                currency={currency}
                uniqueItems={uniqueItems}
                totalPieces={totalPieces}
                onOpenVault={handleOpenVault}
            />

            {/* ═══════ SEARCH + CATEGORIES BAR ═══════ */}
            <div className="px-6 py-4 border-b border-white/5 bg-slate-950/40 backdrop-blur-xl space-y-4 shrink-0 shadow-2xl">
                <div className="flex gap-4 items-center">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="QUERY MATRIX: ID, NAME, OR BARCODE..."
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border border-white/5 rounded-[1.2rem] text-[13px] outline-none focus:border-emerald-500/50 focus:ring-8 focus:ring-emerald-500/5 transition-all font-black text-white placeholder:text-slate-800 uppercase tracking-widest"
                            value={searchQuery}
                            onChange={(e) => onSetSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button onClick={() => onSetSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setShowNumpad(!showNumpad)}
                        className={clsx(
                            "px-6 py-3.5 rounded-[1.2rem] border-2 font-black text-[11px] uppercase tracking-[0.2em] transition-all shrink-0 flex items-center gap-3 active:scale-95 italic",
                            showNumpad
                                ? "bg-amber-gradient border-amber-400 text-white shadow-[0_0_30px_rgba(245,158,11,0.2)]"
                                : "bg-slate-900 border-white/5 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-slate-800"
                        )}
                    >
                        <Calculator size={16} className="stroke-[2.5]" />
                        Neural Calc
                    </button>
                </div>

                <div className="flex gap-3 overflow-x-auto custom-scrollbar-dark pb-3 items-center scroll-smooth no-scrollbar">
                    {currentParentId === null ? (
                        <>
                            <button
                                onClick={() => {
                                    onSetActiveCategoryId(null);
                                    onSetCurrentParentId(null);
                                }}
                                className={clsx(
                                    "px-6 py-2.5 whitespace-nowrap rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 shrink-0 italic",
                                    activeCategoryId === null ? 'bg-emerald-gradient border-emerald-400 text-white shadow-[0_0_25px_rgba(16,185,129,0.3)] scale-105 z-10' : 'bg-slate-900 border-white/5 text-slate-500 hover:border-emerald-500/30 hover:text-emerald-400'
                                )}
                            >ALL CLUSTERS</button>
                            {categories.filter(c => !((c as any).parent || (c as any).parentId || (c as any).parent_id)).map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        onSetActiveCategoryId(cat.id);
                                        onSetCurrentParentId(cat.id);
                                    }}
                                    className={clsx(
                                        "px-6 py-2.5 whitespace-nowrap rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 shrink-0 italic",
                                        (activeCategoryId === cat.id || currentParentId === cat.id)
                                            ? 'bg-emerald-gradient border-emerald-400 text-white shadow-[0_0_25px_rgba(16,185,129,0.3)] scale-105 z-10'
                                            : 'bg-slate-900 border-white/5 text-slate-500 hover:border-emerald-500/30 hover:text-emerald-400'
                                    )}
                                >{cat.name}</button>
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
                                className="h-10 px-5 bg-slate-800 border-2 border-emerald-500/50 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shrink-0 flex items-center gap-3 shadow-lg hover:bg-emerald-gradient hover:text-white"
                            >
                                <ArrowLeft size={16} className="stroke-[3]" />
                                BACK: {categories.find(c => c.id === currentParentId)?.name}
                            </button>
                            <div className="w-[2px] h-6 bg-white/5 mx-2 shrink-0" />
                            {categories.filter(c => ((c as any).parent || (c as any).parentId || (c as any).parent_id) === currentParentId).map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        onSetActiveCategoryId(cat.id);
                                        const hasChildren = categories.some(c => ((c as any).parent || (c as any).parentId || (c as any).parent_id) === cat.id);
                                        if (hasChildren) onSetCurrentParentId(cat.id);
                                    }}
                                    className={clsx(
                                        "px-6 py-2.5 whitespace-nowrap rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 shrink-0 italic",
                                        activeCategoryId === cat.id
                                            ? 'bg-emerald-gradient border-emerald-400 text-white shadow-[0_0_25px_rgba(16,185,129,0.3)] scale-105 z-10'
                                            : 'bg-slate-900 border-white/5 text-slate-500 hover:border-emerald-500/30 hover:text-emerald-400'
                                    )}
                                >{cat.name}</button>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {/* ═══════ MAIN CONTENT ═══════ */}
            <div className="flex-1 flex overflow-hidden">
                {/* ─── LEFT: Products ─── */}
                <div className="flex-1 flex flex-col bg-[#020617] overflow-hidden relative">
                    <div className="absolute inset-0 bg-emerald-500/5 blur-[120px] pointer-events-none" />
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar-dark relative z-10">
                        <ProductGrid
                            searchQuery={searchQuery}
                            categoryId={activeCategoryId}
                            onAddToCart={onAddToCart}
                            currency={currency}
                        />
                    </div>
                </div>

                {/* ─── RIGHT: Order Panel ─── */}
                <aside className="w-[420px] bg-slate-950 border-l border-white/5 flex flex-col shrink-0 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-20">
                    {/* Order Header */}
                    <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-slate-950/80 backdrop-blur-2xl sticky top-0 z-[30]">
                        <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white italic">Operational Matrix</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 italic">{uniqueItems} Lines</span>
                            <span className="text-[10px] font-black text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-white/10 italic">{totalPieces} units</span>
                            {cart.length > 0 && (
                                <button onClick={() => onClearCart(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-900 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-white/5">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Client Info with Search and Zone */}
                    <div className="p-6 border-b border-white/5 bg-slate-900/40 backdrop-blur-md">
                        <div className="flex gap-3 mb-4">
                            <div className="relative flex-1 group">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-400 transition-colors" size={16} />
                                    <input
                                        type="text"
                                        placeholder="IDENTIFY CLIENT ENTITY..."
                                        className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-white/5 rounded-2xl text-[12px] font-black text-white outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-800 uppercase tracking-widest italic"
                                        value={clientSearchQuery}
                                        onChange={(e) => onSetClientSearchQuery(e.target.value)}
                                        onFocus={() => onSearchClients?.(clientSearchQuery)}
                                    />
                                </div>

                                {clientSearchQuery && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-[100] max-h-64 overflow-y-auto custom-scrollbar-dark backdrop-blur-3xl ring-1 ring-white/5">
                                        {filteredClients.map((c: any) => (
                                            <button
                                                key={c.id}
                                                onClick={() => {
                                                    onUpdateActiveSession({ clientId: c.id });
                                                    onSetClientSearchQuery('');
                                                }}
                                                className="w-full text-left px-5 py-3 hover:bg-emerald-500/10 border-b border-white/5 flex items-center justify-between group transition-colors"
                                            >
                                                <div>
                                                    <p className="text-[11px] font-black text-slate-200 group-hover:text-emerald-400 uppercase tracking-widest transition-colors italic">{c.name}</p>
                                                    <p className="text-[9px] text-slate-600 font-mono mt-0.5">{c.phone || 'NO_COMMS_LINK'}</p>
                                                </div>
                                                <span className="text-[9px] font-black text-emerald-500 opacity-0 group-hover:opacity-100 uppercase tracking-tighter">Connect Node</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => onUpdateActiveSession({ clientId: 1 })}
                                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-950 border border-white/5 text-slate-600 hover:border-emerald-500/50 hover:text-emerald-400 transition-all hover:bg-slate-900 shadow-inner"
                                title="Default Anonymous Node"
                            >
                                <User size={20} />
                            </button>
                        </div>

                        <div className="relative group/zone">
                            <span className="absolute left-4 -top-2 px-2 bg-slate-900 text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] z-10">Logistics Zone</span>
                            <div className="relative">
                                <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/zone:text-emerald-400 transition-colors" />
                                <select
                                    value={deliveryZone || ''}
                                    onChange={(e) => onSetDeliveryZone(e.target.value)}
                                    className="w-full pl-11 pr-10 py-3 bg-slate-950 border border-white/5 rounded-2xl text-[11px] font-black text-slate-300 outline-none appearance-none cursor-pointer focus:border-emerald-500/50 transition-all uppercase tracking-widest italic"
                                >
                                    {deliveryZones.map(z => (
                                        <option key={z.id} value={z.id} className="bg-slate-950 text-white font-black">{z.name} Matrix</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                    {/* Cart Items Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar-dark bg-slate-950/20 backdrop-blur-sm">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-800 gap-6 animate-in fade-in zoom-in duration-700">
                                <div className="w-32 h-32 rounded-full bg-slate-900 flex items-center justify-center border-2 border-dashed border-slate-800 relative group">
                                    <ShoppingCart size={48} strokeWidth={1} className="text-slate-700 group-hover:text-emerald-500/50 transition-colors" />
                                    <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-600">Primary Bay Empty</p>
                                    <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Awaiting Material Acquisition</p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 space-y-3">
                                {cart.map((item: any, idx: number) => {
                                    const stockQty = item.stock || 0;
                                    const isOverselling = item.quantity > stockQty && stockQty >= 0;
                                    const isLowStock = stockQty > 0 && stockQty <= 5 && !isOverselling;
                                    return (
                                        <div
                                            key={item.productId}
                                            className={clsx(
                                                "p-4 rounded-[1.5rem] border transition-all duration-300 relative overflow-hidden group/item",
                                                highlightedItemId === item.productId
                                                    ? "bg-emerald-gradient border-emerald-400 text-white shadow-[0_10px_30px_rgba(16,185,129,0.3)] scale-[1.02]"
                                                    : isOverselling
                                                        ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                                                        : lastAddedItemId === item.productId
                                                            ? "bg-slate-900 border-emerald-500/30 text-white"
                                                            : "bg-slate-900/40 border-white/5 text-slate-300 hover:bg-slate-900/60 hover:border-white/10"
                                            )}
                                        >
                                            <div className="flex items-center gap-4 relative z-10">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[13px] font-black uppercase tracking-wider truncate italic">{item.name}</p>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setOpenNoteId(openNoteId === item.productId ? null : item.productId); }}
                                                            className={clsx(
                                                                "shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                                                                item.note ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-500 hover:text-amber-400 group-hover/item:opacity-100 opacity-0"
                                                            )}
                                                        >
                                                            <MessageSquare size={12} fill={item.note ? "currentColor" : "none"} />
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1.5 font-mono text-[9px] font-black">
                                                        {item.barcode && <span className="px-1.5 py-0.5 bg-slate-950/50 rounded text-slate-600">ID://{item.barcode}</span>}
                                                        {isOverselling ? (
                                                            <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-400 rounded animate-pulse">CRITICAL: SHORTAGE</span>
                                                        ) : isLowStock ? (
                                                            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">WARNING: DEPLETING</span>
                                                        ) : (
                                                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500/60 rounded">SECURE: {stockQty} units</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 bg-slate-950/40 p-1.5 rounded-2xl border border-white/5">
                                                    <button onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item.productId, -1); }} className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-rose-500/20 hover:text-rose-500 flex items-center justify-center text-slate-600 transition-all active:scale-90 border border-white/5">
                                                        <Minus size={14} className="stroke-[3]" />
                                                    </button>
                                                    <span
                                                        onClick={(e) => { e.stopPropagation(); setSelectedCartIdx(idx); setNumpadMode('qty'); setShowNumpad(true); }}
                                                        className="w-8 text-center text-sm font-black tabular-nums cursor-pointer hover:text-emerald-400 transition-colors"
                                                    >
                                                        {item.quantity}
                                                    </span>
                                                    <button onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item.productId, 1); }} className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-emerald-500/20 hover:text-emerald-400 flex items-center justify-center text-slate-600 transition-all active:scale-90 border border-white/5">
                                                        <Plus size={14} className="stroke-[3]" />
                                                    </button>
                                                </div>

                                                <div className="text-right min-w-[100px]">
                                                    <p
                                                        onClick={(e) => { e.stopPropagation(); setSelectedCartIdx(idx); setNumpadMode('price'); setShowNumpad(true); }}
                                                        className="text-[15px] font-black text-white cursor-pointer hover:text-emerald-400 transition-colors italic tabular-nums"
                                                    >
                                                        {currency}{formatNumber(Number(item.price) * item.quantity)}
                                                    </p>
                                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-tighter mt-0.5">
                                                        {currency}{Number(item.price).toFixed(2)} UNIT
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Note Interface */}
                                            {openNoteId === item.productId && (
                                                <div className="mt-4 pt-4 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                                                    <textarea
                                                        autoFocus
                                                        defaultValue={item.note || ''}
                                                        placeholder="DATA LOG ENTRY..."
                                                        rows={2}
                                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black text-white outline-none focus:border-amber-500/50 resize-none placeholder:text-slate-800 uppercase tracking-widest italic"
                                                        onBlur={(e) => { onUpdateLineNote?.(item.productId, e.target.value); }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                onUpdateLineNote?.(item.productId, (e.target as HTMLTextAreaElement).value);
                                                                setOpenNoteId(null);
                                                            }
                                                            if (e.key === 'Escape') setOpenNoteId(null);
                                                        }}
                                                    />
                                                    <div className="flex justify-between items-center mt-2 px-1">
                                                        <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest italic">ENTER: COMMIT // ESC: ABORT</p>
                                                        <button onClick={() => setOpenNoteId(null)} className="text-[9px] font-black text-amber-500 uppercase tracking-widest">CLOSE_LOG</button>
                                                    </div>
                                                </div>
                                            )}

                                            {openNoteId !== item.productId && item.note && (
                                                <div className="mt-3 px-3 py-2 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-2 group/note relative group-hover/item:border-amber-500/40 transition-all">
                                                    <span className="text-amber-500 shrink-0 mt-0.5">📝</span>
                                                    <p className="text-[10px] font-black text-amber-500/80 italic leading-relaxed uppercase tracking-tighter line-clamp-1">{item.note}</p>
                                                    <button
                                                        onClick={() => onUpdateLineNote?.(item.productId, '')}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/note:opacity-100 text-amber-500/40 hover:text-rose-500 transition-all"
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer / Settlement Area */}
                    <div className="p-6 border-t border-white/5 bg-slate-950 shrink-0 space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-1 italic">Order Summary</span>
                                <div className="flex items-center gap-3">
                                    <span className="px-3 py-1 bg-slate-900 border border-white/5 rounded-lg text-[10px] font-black text-slate-400 italic uppercase">
                                        {totalPieces} Units
                                    </span>
                                    {discount > 0 && (
                                        <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] font-black text-amber-400 italic uppercase">
                                            -{currency}{formatNumber(discount)} Disc
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.3em] mb-1 italic block">Net Settlement</span>
                                <span className="text-4xl font-black text-white tabular-nums tracking-tighter italic">
                                    <span className="text-emerald-500 mr-1 opacity-50">{currency}</span>
                                    {formatNumber(totalAmount)}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="relative group/input">
                                <span className="absolute left-4 -top-2 px-2 bg-slate-950 text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] z-10 transition-colors group-focus-within/input:text-emerald-400">Captured Fund</span>
                                <input
                                    type="text"
                                    value={cashReceived ? cashReceived.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ''}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/\s+/g, '').replace(',', '.');
                                        if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                                            onSetCashReceived(raw);
                                        }
                                    }}
                                    placeholder={totalAmount.toFixed(2)}
                                    className="w-full px-4 py-3 bg-slate-950 border border-white/5 rounded-2xl text-[14px] font-black text-white outline-none focus:border-emerald-500/50 transition-all font-mono italic text-right placeholder:text-slate-800"
                                />
                            </div>
                            <div className="relative group/select">
                                <span className="absolute left-4 -top-2 px-2 bg-slate-950 text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] z-10 transition-colors group-focus-within/select:text-emerald-400">Payment Vector</span>
                                <div className="relative flex items-center">
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => onSetPaymentMethod(e.target.value)}
                                        className="w-full pl-4 pr-10 py-3 bg-slate-950 border border-white/5 rounded-2xl text-[11px] font-black text-slate-300 outline-none appearance-none cursor-pointer focus:border-emerald-500/50 transition-all uppercase tracking-widest italic"
                                    >
                                        {paymentMethods
                                            .filter((m: any) => {
                                                const key = typeof m === 'string' ? m : m.key;
                                                return (typeof m === 'object' && m.accountId) || ['MULTI', 'DELIVERY', 'CREDIT'].includes(key);
                                            })
                                            .map((m: any) => {
                                                const key = typeof m === 'string' ? m : m.key;
                                                const label = typeof m === 'string' ? m : (m.label || key);
                                                return <option key={key} value={key} className="bg-slate-950 text-white">{label} Protocol</option>;
                                            })
                                        }
                                    </select>
                                    <ChevronDown size={14} className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                                    <button
                                        onClick={() => setIsMultiPayMode(true)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-slate-900 border border-white/5 text-slate-500 rounded-xl hover:text-emerald-400 hover:border-emerald-500/50 transition-all"
                                        title="Split Protocol"
                                    >
                                        <Calculator size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => onCharge()}
                            disabled={cart.length === 0 || isProcessing}
                            className={clsx(
                                "group relative w-full h-20 rounded-[2rem] overflow-hidden transition-all duration-500 shadow-2xl",
                                cart.length > 0 && !isProcessing
                                    ? "bg-emerald-gradient hover:scale-[1.02] active:scale-[0.98] shadow-emerald-500/30 ring-1 ring-emerald-400/50"
                                    : "bg-slate-900 grayscale opacity-50 cursor-not-allowed border border-white/5 shadow-none"
                            )}
                        >
                            {/* Inner Carbon texture for tactical feel */}
                            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

                            <div className="relative z-10 flex items-center justify-between px-10">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center text-white border border-white/20 group-hover:rotate-[15deg] transition-all duration-500 shadow-inner">
                                        {isProcessing ? <RefreshCw size={24} className="animate-spin" /> : <ShieldCheck size={28} className="stroke-[2.5]" />}
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <span className="text-[10px] font-black text-emerald-100/60 uppercase tracking-[0.3em] leading-none mb-1.5 italic">Transaction Matrix</span>
                                        <span className="text-xl font-black text-white uppercase tracking-[0.1em] leading-none italic">
                                            {isProcessing ? "Processing..." : changeDue > 0 ? "Commit & Rebate" : "Finalize Protocol"}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <span className="text-[10px] font-black text-emerald-100 bg-emerald-500/40 px-2.5 py-1 rounded-lg uppercase tracking-tighter mb-1.5 italic ring-1 ring-emerald-400/30">
                                        {changeDue > 0 ? "Excess Liquid" : "Total Due"}
                                    </span>
                                    <span className="text-2xl font-black text-white tabular-nums tracking-tighter leading-none italic shadow-emerald-900/10 shadow-sm">
                                        {currency}{formatNumber(changeDue > 0 ? changeDue : totalAmount)}
                                    </span>
                                </div>
                            </div>

                            {/* Tactical Glow */}
                            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-700" />
                        </button>
                    </div>
                </aside>
            </div>

            {/* ═══════ OVERLAYS & MODALS ═══════ */}

            {/* Loyalty Vault Modal */}
            <ClientVaultModal
                isOpen={isVaultOpen}
                onClose={() => setIsVaultOpen(false)}
                clientName={selectedClient?.name || 'Walk-in'}
                currency={currency}
                fidelity={clientFidelity}
                loading={fidelityLoading}
            />

            {/* Floating Speed Calc / Numpad Overlay */}
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
                        "z-[1000] w-[320px] p-2 bg-slate-900/95 backdrop-blur-2xl rounded-[2rem] border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,1)] ring-1 ring-white/10 animate-in zoom-in-95 duration-200",
                        !isDragging && "transition-transform duration-200 ease-out"
                    )}
                >
                    <div
                        onMouseDown={startDragging}
                        className="flex items-center justify-between px-4 mb-3 cursor-grab active:cursor-grabbing hover:bg-white/5 rounded-2xl p-3 transition-colors group/handle border border-transparent hover:border-white/5"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-amber-500 rounded-full group-hover/handle:scale-y-125 transition-transform" />
                            <span className="text-[11px] font-black text-amber-500 uppercase tracking-[0.2em] italic">Neural Interface</span>
                        </div>
                        <button onClick={() => setShowNumpad(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-950 text-slate-600 hover:bg-rose-500 hover:text-white transition-all border border-white/5">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="p-2 pt-0">
                        <POSNumpad
                            mode={numpadMode}
                            onModeChange={setNumpadMode}
                            onValueConfirm={(val, mode) => {
                                const idx = selectedCartIdx ?? 0;
                                if (cart.length > idx) {
                                    const target = cart[idx];
                                    if (mode === 'qty') {
                                        const delta = val - target.quantity;
                                        onUpdateQuantity(target.productId, delta);
                                    } else if (mode === 'price' && onUpdatePrice) {
                                        onUpdatePrice(target.productId, val);
                                    } else if (mode === 'disc' && onUpdateLineDiscount) {
                                        onUpdateLineDiscount(target.productId, val);
                                    }
                                } else if (mode === 'disc' && onSetDiscount) {
                                    onSetDiscount(val);
                                } else {
                                    toast.error("DATA_LINK_FAILURE: SELECT TARGET FIRST");
                                }
                            }}
                        />
                    </div>
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
                    const legsNote = legs.map(l => `${l.method}:${l.amount.toFixed(2)}`).join(' | ');
                    if (onSetNotes) onSetNotes(legsNote);
                    if (onSetPaymentLegs) onSetPaymentLegs(legs);
                    const totalPaid = legs.reduce((sum, l) => sum + l.amount, 0);
                    onSetCashReceived(String(totalPaid));
                    if (legs.length > 0) onSetPaymentMethod(legs[0].method);
                    setIsMultiPayMode(false);
                    setTimeout(() => onCharge(), 300);
                }}
            />

            <ManagerOverride
                isOpen={isOverrideOpen}
                onClose={() => onSetOverrideOpen(false)}
                onSuccess={() => {
                    toast.success("OVERRIDE_AUTHORIZED");
                }}
                actionLabel="Protected Action"
            />
        </div>
    );
}
