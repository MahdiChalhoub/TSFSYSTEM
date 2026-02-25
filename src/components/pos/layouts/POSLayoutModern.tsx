'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import {
    Search, ShoppingCart, Plus, Minus, Trash2, X, Layout,
    ChevronDown, Maximize, Minimize, Eye, EyeOff, Package, Tag,
    CreditCard, Banknote, Wallet, MapPin, Star, Calculator, GripHorizontal, ArrowLeft, ArrowRight,
    History, RefreshCw, Wifi, WifiOff, Smartphone, Landmark
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import Link from 'next/link';
import { Numpad as POSNumpad, NumpadMode } from '@/components/pos/Numpad';
const formatNumber = (num: number | string) => {
    const val = Number(num) || 0;
    // Manual formatting for hydration stability across SSR/CSR
    const parts = val.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return parts[1] === '00' ? parts[0] : parts.join('.');
};
const DEFAULT_PAYMENT_METHODS = ['CASH', 'CARD', 'WALLET', 'WAVE', 'OM', 'MULTI', 'DELIVERY'];
export function POSLayoutModern(props: POSLayoutProps) {
    const {
        cart, clients, selectedClient, selectedClientId, categories,
        sessions, activeSessionId, currency, total, discount, discountType, totalAmount,
        totalPieces, uniqueItems, searchQuery, activeCategoryId, currentParentId, sidebarMode,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        isOverrideOpen, isReceiptOpen, lastOrder, highlightedItemId, lastAddedItemId,
        isOnline, clientSearchQuery, deliveryZone, deliveryZones,
        storeChangeInWallet, pointsRedeemed,
        onSetSearchQuery, onSetActiveCategoryId, onSetCurrentParentId, onSetActiveSessionId,
        onSetPaymentMethod, onSetCashReceived, onSetDiscount, onSetDiscountType, onAddToCart,
        onUpdateQuantity, onUpdatePrice,
        onClearCart, onCreateNewSession, onRemoveSession, onUpdateActiveSession,
        onToggleFullscreen, onCycleSidebarMode, onCharge,
        onSync, onSetIsOnline, onSetClientSearchQuery, onSetDeliveryZone,
        onSetOverrideOpen, onSetReceiptOpen, onOpenLayoutSelector,
        onSetStoreChangeInWallet, onSetPointsRedeemed
    } = props;
    const paymentMethods = (props as any).paymentMethods || DEFAULT_PAYMENT_METHODS;
    const receivedNum = Number(cashReceived) || 0;
    const changeDue = receivedNum > totalAmount ? receivedNum - totalAmount : 0;
    const deficit = receivedNum > 0 && receivedNum < totalAmount ? totalAmount - receivedNum : 0;
    const [leftExpanded, setLeftExpanded] = useState(false);
    const [showNumpad, setShowNumpad] = useState(false);
    const [numpadMode, setNumpadMode] = useState<NumpadMode>('qty');
    const [selectedCartIdx, setSelectedCartIdx] = useState<number | null>(null);
    const [pendingAction, setPendingAction] = useState<{ label: string, execute: () => void } | null>(null);
    // ── Multi-Payment State ──
    const [isMultiPayMode, setIsMultiPayMode] = useState(false);
    const [paymentLegs, setPaymentLegs] = useState<Array<{ method: string, amount: number }>>([]);
    const [multiPaySelectedMethod, setMultiPaySelectedMethod] = useState<string | null>(null);
    const [mpBuffer, setMpBuffer] = useState('');
    const multiPayTotal = paymentLegs.reduce((sum, leg) => sum + leg.amount, 0);
    const multiPayRemaining = totalAmount - multiPayTotal;
    const getMethodIcon = (k: string) => {
        if (k.includes('CARD')) return CreditCard;
        if (k.includes('WALLET')) return Wallet;
        if (k.includes('WAVE') || k.includes('OM')) return Smartphone;
        if (k.includes('DELIVERY')) return MapPin;
        if (k.includes('BANK')) return Landmark;
        if (k.includes('REWARD') || k.includes('LOYALTY')) return Star;
        return Banknote;
    };
    const handleProtectedQuantity = useCallback((productId: number, delta: number) => {
        const item = cart.find(i => i.productId === productId);
        const currentQty = item?.quantity || 0;
        // Only require override for full deletion or if clearing multiple items
        if (delta < 0 && (currentQty + delta <= 0)) {
            setPendingAction({
                label: `Remove ${item?.name || 'Item'}`,
                execute: () => onUpdateQuantity(productId, delta)
            });
            onSetOverrideOpen(true);
        } else {
            onUpdateQuantity(productId, delta);
        }
    }, [cart, onUpdateQuantity, onSetOverrideOpen]);
    const handleProtectedDiscount = useCallback((val: number) => {
        setPendingAction({
            label: `Apply ${val}% Discount`,
            execute: () => onSetDiscount(val)
        });
        onSetOverrideOpen(true);
    }, [onSetDiscount, onSetOverrideOpen]);
    const handleProtectedPrice = useCallback((productId: number, newPrice: number) => {
        const item = cart.find(i => i.productId === productId);
        const currentPrice = Number(item?.price || 0);
        if (newPrice < currentPrice) {
            setPendingAction({
                label: `Decrease Price to ${currency}${newPrice.toFixed(2)}`,
                execute: () => onUpdatePrice(productId, newPrice)
            });
            onSetOverrideOpen(true);
        } else {
            onUpdatePrice(productId, newPrice);
        }
    }, [cart, currency, onUpdatePrice, onSetOverrideOpen]);
    // Draggable Floating Logic
    const [numpadPos, setNumpadPos] = useState({ x: 20, y: 150 });
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
            // Use requestAnimationFrame for smoother movement
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
    const filteredCategories = categories.filter(cat => {
        const parentId = (cat as any).parent || (cat as any).parentId || (cat as any).parent_id || null;
        return parentId === currentParentId;
    });
    const currentParentName = currentParentId ? categories.find(c => c.id === currentParentId)?.name : null;
    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
        c.phone.includes(clientSearchQuery)
    );
    return (
        <div className={clsx(
            "flex flex-col overflow-hidden select-none h-full",
            isFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen bg-[#f4f6f8]" : "absolute inset-0 bg-[#f4f6f8]"
        )}>
            {/* ═══════════ HEADER ═══════════ */}
            <header className="h-[48px] bg-white border-b border-gray-200/80 flex items-center justify-between px-4 shrink-0 z-50">
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
                    <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
                        <button
                            onClick={() => onSetIsOnline(!isOnline)}
                            className={clsx(
                                "h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-all outline-none",
                                isOnline ? "bg-white text-emerald-600 shadow-sm" : "text-rose-500"
                            )}
                        >
                            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                        </button>
                        <button
                            onClick={onSync}
                            className="h-7 px-3 rounded-md text-[10px] font-bold text-gray-500 hover:bg-white hover:text-indigo-600 transition-all flex items-center gap-1.5"
                        >
                            <RefreshCw size={12} className={isProcessing ? "animate-spin" : ""} />
                            SYNC
                        </button>
                    </div>
                    <span className="bg-gray-100 px-2 py-0.5 rounded font-semibold">{formatNumber(uniqueItems)} items</span>
                    <span className="bg-gray-100 px-2 py-0.5 rounded font-semibold">{formatNumber(totalPieces)} pcs</span>
                    <button onClick={onToggleFullscreen} className="h-7 px-2 bg-gray-100 text-gray-600 rounded-md text-[11px] font-semibold hover:bg-gray-200 transition-all flex items-center gap-1">
                        {isFullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
                    </button>
                    <button onClick={onOpenLayoutSelector} className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-md text-gray-500 hover:bg-gray-200 transition-all">
                        <Layout size={13} />
                    </button>
                    <Link
                        href="/sales/history"
                        className="h-7 px-2.5 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1.5 shadow-sm"
                    >
                        <History size={11} />
                        History
                    </Link>
                </div>
            </header>
            {/* ═══════════ MAIN SPLIT ═══════════ */}
            <div className="flex-1 flex overflow-hidden">
                {/* ════ LEFT COLUMN (58%) ════ */}
                <aside className="w-[58%] flex flex-col bg-white border-r border-gray-200/80 shrink-0 overflow-hidden">
                    {/* Client Selector & Search */}
                    <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50 shrink-0">
                        <div className="flex gap-2">
                            <div className="flex-1 relative group">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={12} />
                                <input
                                    type="text"
                                    placeholder="Find customer..."
                                    value={clientSearchQuery}
                                    onChange={(e) => onSetClientSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-bold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all"
                                />
                                {clientSearchQuery && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl z-[100] max-h-48 overflow-y-auto custom-scrollbar">
                                        {filteredClients.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => {
                                                    onUpdateActiveSession({ clientId: c.id });
                                                    onSetClientSearchQuery('');
                                                }}
                                                className="w-full text-left px-4 py-2 hover:bg-emerald-50 border-b border-gray-50 flex items-center justify-between group"
                                            >
                                                <div>
                                                    <p className="text-[11px] font-black text-gray-900 group-hover:text-emerald-700">{c.name}</p>
                                                    <p className="text-[9px] text-gray-400 font-mono">{c.phone}</p>
                                                </div>
                                                <span className="text-[9px] font-bold text-emerald-600 opacity-0 group-hover:opacity-100">Select</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="relative group shrink-0">
                                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={12} />
                                <select
                                    value={deliveryZone}
                                    onChange={(e) => onSetDeliveryZone(e.target.value)}
                                    className="pl-8 pr-8 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-black outline-none appearance-none cursor-pointer focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all uppercase tracking-wider"
                                >
                                    {deliveryZones.map(z => (
                                        <option key={z.id} value={z.name}>{z.name}</option>
                                    ))}
                                    {deliveryZones.length === 0 && (
                                        <option value="A">Zone A</option>
                                    )}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={10} />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-indigo-100 shrink-0">
                                {selectedClient?.name?.charAt(0) || 'C'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-gray-900 truncate">{selectedClient?.name || 'Walk-in'}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-gray-400 font-bold">{selectedClient?.phone || 'No phone'}</span>
                                    <span className="bg-emerald-50 text-emerald-700 px-1.5 py-px rounded text-[10px] font-black">BAL: {currency}{formatNumber(selectedClient?.balance || 0)}</span>
                                    <span className="bg-amber-50 text-amber-700 px-1.5 py-px rounded text-[10px] font-black flex items-center gap-0.5"><Star size={8} />{selectedClient?.loyalty || 0} PTS</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Search + Calculator Button + Category Pills */}
                    <div className="px-3 py-2 border-b border-gray-100 space-y-1.5 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search products, scan barcode..."
                                    className="w-full pl-8 pr-10 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition-all font-medium"
                                    value={searchQuery}
                                    onChange={(e) => onSetSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => onSetSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-rose-500 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => setShowNumpad(!showNumpad)}
                                title={showNumpad ? "Hide Calculator" : "Show Calculator"}
                                className={clsx(
                                    "p-1.5 rounded-lg border transition-all shrink-0 active:scale-95 shadow-sm",
                                    showNumpad
                                        ? "bg-amber-100 border-amber-300 text-amber-700 ring-2 ring-amber-50"
                                        : "bg-white border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-600"
                                )}
                            >
                                <Calculator size={18} />
                            </button>
                        </div>
                        <div className="flex gap-2 overflow-x-auto custom-scrollbar-h pb-1 pt-1 items-center">
                            {currentParentId === null ? (
                                <>
                                    <button
                                        onClick={() => {
                                            onSetActiveCategoryId(null);
                                            onSetCurrentParentId(null);
                                            setLeftExpanded(true);
                                        }}
                                        className={clsx(
                                            "px-4 py-2 whitespace-nowrap rounded-xl text-[12px] font-black uppercase tracking-widest transition-all border shrink-0",
                                            (activeCategoryId === null && currentParentId === null) ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-gray-100 text-gray-500 hover:border-indigo-300 hover:text-indigo-600'
                                        )}
                                    >ALL</button>
                                    {categories.filter(c => !((c as any).parent || (c as any).parentId || (c as any).parent_id)).map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => {
                                                onSetActiveCategoryId(cat.id);
                                                onSetCurrentParentId(cat.id);
                                                setLeftExpanded(true);
                                            }}
                                            className={clsx(
                                                "px-4 py-2 whitespace-nowrap rounded-xl text-[12px] font-black uppercase tracking-widest transition-all border shrink-0",
                                                (activeCategoryId === cat.id || currentParentId === cat.id)
                                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200'
                                                    : 'bg-white border-gray-100 text-gray-500 hover:border-emerald-300 hover:text-emerald-600'
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
                                            onSetActiveCategoryId(grandParentId);
                                            setLeftExpanded(true);
                                        }}
                                        className="h-9 px-4 bg-indigo-600 border border-indigo-600 text-white rounded-xl text-[12px] font-black uppercase tracking-widest transition-all shrink-0 flex items-center gap-2 shadow-lg shadow-indigo-100"
                                    >
                                        <ArrowLeft size={14} />
                                        {currentParentName}
                                    </button>
                                    <div className="w-px h-6 bg-gray-200 mx-1 shrink-0" />
                                    {categories.filter(c => ((c as any).parent || (c as any).parentId || (c as any).parent_id) === currentParentId).map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => {
                                                onSetActiveCategoryId(cat.id);
                                                setLeftExpanded(true);
                                            }}
                                            className={clsx(
                                                "px-4 py-2 whitespace-nowrap rounded-xl text-[12px] font-black uppercase tracking-widest transition-all border shrink-0",
                                                activeCategoryId === cat.id
                                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200'
                                                    : 'bg-white border-gray-100 text-gray-500 hover:border-emerald-300 hover:text-emerald-600'
                                            )}
                                        >{cat.name}</button>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                    {/* Toggle View Mode */}
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
                    {/* Main Area (Products or Categories) */}
                    <div className="flex-1 relative bg-gray-50/10 overflow-hidden">
                        <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-3">
                            {leftExpanded ? (
                                <ProductGrid searchQuery={searchQuery} categoryId={activeCategoryId || currentParentId} onAddToCart={onAddToCart} currency={currency} />
                            ) : (
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    {/* Back Button / Navigation Context */}
                                    {currentParentId !== null ? (
                                        <button
                                            onClick={() => {
                                                const parent = categories.find(c => c.id === currentParentId);
                                                const grandParentId = (parent as any)?.parent || (parent as any)?.parentId || (parent as any)?.parent_id || null;
                                                onSetCurrentParentId(grandParentId);
                                                onSetActiveCategoryId(grandParentId);
                                            }}
                                            className="p-8 rounded-2xl bg-[#f0f4ff] border border-indigo-100 text-indigo-600 text-center hover:bg-indigo-100 transition-all flex flex-col items-center justify-center font-black uppercase text-[12px] tracking-widest gap-2 shadow-sm"
                                        >
                                            <ArrowLeft size={24} />
                                            BACK
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => { onSetActiveCategoryId(null); setLeftExpanded(true); }}
                                            className="p-4 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-center group hover:shadow-xl transition-all border-none"
                                        >
                                            <Package size={20} className="mx-auto mb-1.5" />
                                            <span className="text-[12px] font-black uppercase tracking-wider">All Products</span>
                                        </button>
                                    )}
                                    {filteredCategories.map(cat => {
                                        const hasChildren = categories.some(c => ((c as any).parent || (c as any).parentId || (c as any).parent_id) === cat.id);
                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => {
                                                    onSetActiveCategoryId(cat.id);
                                                    if (hasChildren) {
                                                        onSetCurrentParentId(cat.id);
                                                    }
                                                    setLeftExpanded(true);
                                                }}
                                                className={clsx(
                                                    "p-6 rounded-2xl border text-center group hover:shadow-2xl transition-all bg-white relative flex flex-col items-center justify-center gap-3",
                                                    (activeCategoryId === cat.id || currentParentId === cat.id)
                                                        ? "border-emerald-400 ring-4 ring-emerald-50 shadow-xl"
                                                        : "border-gray-100 hover:border-emerald-200"
                                                )}
                                            >
                                                <div className={clsx(
                                                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
                                                    (activeCategoryId === cat.id || currentParentId === cat.id) ? 'bg-emerald-600 text-white rotate-12' : 'bg-gray-50 text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-500'
                                                )}>
                                                    <Tag size={20} />
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <span className={clsx(
                                                        "text-[13px] font-black uppercase tracking-wider transition-colors line-clamp-2",
                                                        (activeCategoryId === cat.id || currentParentId === cat.id) ? 'text-emerald-700' : 'text-gray-900'
                                                    )}>{cat.name}</span>
                                                    {hasChildren && <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Browse Sub-items</span>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        {/* Speed Calc Floating Overlay */}
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
                                    "z-[50] w-[280px] p-2 bg-white/95 backdrop-blur-md rounded-2xl border border-amber-200 shadow-2xl shadow-amber-200/40 animate-in zoom-in-95 ring-4 ring-amber-50",
                                    !isDragging && "transition-transform duration-200 ease-out"
                                )}
                            >
                                <div
                                    onMouseDown={startDragging}
                                    className="flex items-center justify-between px-2 mb-2 cursor-grab active:cursor-grabbing hover:bg-amber-50 rounded-lg p-1 transition-colors group/handle"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <GripHorizontal size={14} className="text-amber-400 group-hover/handle:text-amber-600 transition-colors" />
                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                                            {isMultiPayMode ? 'Multi Pay' : selectedCartIdx !== null ? `Editing Item #${selectedCartIdx + 1}` : 'Speed Calc'}
                                        </span>
                                    </div>
                                    <button onClick={() => setShowNumpad(false)} className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-100 text-amber-600 hover:bg-amber-600 hover:text-white transition-all">
                                        <X size={12} />
                                    </button>
                                </div>
                                {isMultiPayMode ? (
                                    /* ── Multi-Pay Numpad ── */
                                    <div className="flex flex-col gap-2">
                                        {/* Display */}
                                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                                            <span className={clsx(
                                                "text-[9px] font-black uppercase tracking-widest",
                                                multiPaySelectedMethod ? "text-emerald-600" : "text-gray-300"
                                            )}>
                                                {multiPaySelectedMethod || 'Select ↓'}
                                            </span>
                                            <span className="flex-1 text-right text-xl font-black tabular-nums tracking-tighter text-gray-900">
                                                {mpBuffer || '0'}
                                            </span>
                                        </div>

                                        {/* Payment Method Selectors (replaces QTY/DISC/PRICE) */}
                                        <div className="flex gap-1 flex-wrap">
                                            {paymentMethods.filter((m: any) => {
                                                const k = typeof m === 'string' ? m : m.key;
                                                return !k.includes('MULTI');
                                            }).map((m: any) => {
                                                const k = typeof m === 'string' ? m : m.key;
                                                const lbl = typeof m === 'string' ? m : (m.label || m.key);
                                                const MIcon = getMethodIcon(k);
                                                const isSelected = multiPaySelectedMethod === k;
                                                return (
                                                    <button
                                                        key={k}
                                                        onClick={() => setMultiPaySelectedMethod(k)}
                                                        className={clsx(
                                                            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all border",
                                                            isSelected
                                                                ? "bg-emerald-500 border-emerald-500 text-white shadow-md"
                                                                : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600"
                                                        )}
                                                    >
                                                        <MIcon size={11} />
                                                        {lbl}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Number Pad */}
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0'].map(d => (
                                                <button
                                                    key={d}
                                                    onClick={() => setMpBuffer(prev => {
                                                        if (d === '.' && prev.includes('.')) return prev;
                                                        return prev + d;
                                                    })}
                                                    className="h-12 bg-white border border-gray-100 rounded-xl font-black text-lg text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                                                >
                                                    {d}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => setMpBuffer(prev => prev.slice(0, -1))}
                                                className="h-12 bg-white border border-gray-100 rounded-xl font-black text-gray-400 hover:bg-rose-50 hover:text-rose-500 active:scale-95 transition-all shadow-sm flex items-center justify-center"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>

                                        {/* Confirm */}
                                        <button
                                            onClick={() => {
                                                if (!multiPaySelectedMethod) { toast.error('Select a payment method first'); return; }
                                                const val = parseFloat(mpBuffer);
                                                if (isNaN(val) || val <= 0) { toast.error('Enter an amount'); return; }
                                                const amount = Math.min(val, Math.max(0, multiPayRemaining));
                                                if (amount > 0) {
                                                    setPaymentLegs(prev => [...prev, { method: multiPaySelectedMethod, amount }]);
                                                }
                                                setMpBuffer('');
                                            }}
                                            disabled={!multiPaySelectedMethod || !mpBuffer}
                                            className={clsx(
                                                "w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                multiPaySelectedMethod && mpBuffer
                                                    ? "bg-emerald-600 text-white shadow-lg hover:opacity-90 active:scale-[0.98]"
                                                    : "bg-gray-100 text-gray-300 cursor-not-allowed"
                                            )}
                                        >
                                            + Add {multiPaySelectedMethod || 'Payment'}
                                        </button>
                                    </div>
                                ) : (
                                    /* ── Normal Cart Numpad ── */
                                    <POSNumpad
                                        mode={numpadMode}
                                        onModeChange={setNumpadMode}
                                        onValueConfirm={(val, mode) => {
                                            const idx = selectedCartIdx ?? 0;
                                            if (cart.length > idx) {
                                                const target = cart[idx];
                                                if (mode === 'qty') {
                                                    const delta = val - target.quantity;
                                                    handleProtectedQuantity(target.productId, delta);
                                                } else if (mode === 'price') {
                                                    handleProtectedPrice(target.productId, val);
                                                } else if (mode === 'disc') {
                                                    handleProtectedDiscount(val);
                                                }
                                                setShowNumpad(false);
                                            } else if (mode === 'disc') {
                                                handleProtectedDiscount(val);
                                                setShowNumpad(false);
                                            } else {
                                                toast.error("Add an item first");
                                            }
                                        }}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </aside>

                {/* ════ VERTICAL PAYMENT COLUMN (72px) ════ */}
                <div className="w-[72px] bg-white border-r border-gray-200/80 flex flex-col items-center py-4 gap-4 shrink-0 overflow-y-auto no-scrollbar shadow-[inset_-1px_0_0_0_rgba(0,0,0,0.05)]">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mb-1">Pay</span>
                    {paymentMethods.map((m: any) => {
                        const key = typeof m === 'string' ? m : m.key;
                        const label = typeof m === 'string' ? m : (m.label || m.key);

                        // Icon mapping
                        let Icon = Banknote;
                        if (key.includes('CARD')) Icon = CreditCard;
                        if (key.includes('WALLET')) Icon = Wallet;
                        if (key.includes('WAVE') || key.includes('OM')) Icon = Smartphone;
                        if (key.includes('MULTI')) Icon = Calculator;
                        if (key.includes('DELIVERY')) Icon = MapPin;
                        if (key.includes('BANK')) Icon = Landmark;

                        const isActive = paymentMethod === key;

                        return (
                            <button
                                key={key}
                                onClick={() => {
                                    if (key.includes('MULTI')) {
                                        setIsMultiPayMode(prev => !prev);
                                        if (!isMultiPayMode) {
                                            setPaymentLegs([]);
                                            setShowNumpad(true);
                                            setMpBuffer('');
                                        }
                                    }
                                    onSetPaymentMethod(key);
                                }}
                                className={clsx(
                                    "group flex flex-col items-center justify-center p-2 rounded-xl transition-all w-14 h-14 border-2 relative",
                                    isActive
                                        ? "bg-emerald-50 border-emerald-500 text-emerald-600 shadow-lg shadow-emerald-50 scale-105"
                                        : "bg-white border-transparent text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                                )}
                            >
                                <Icon size={20} className={clsx("transition-transform", isActive ? "scale-110" : "group-hover:scale-110")} />
                                <span className="text-[8px] font-black mt-1 uppercase truncate w-full text-center tracking-tighter">{label}</span>
                                {isActive && (
                                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-full" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ════ RIGHT COLUMN: CART (full height) ════ */}
                <main className="flex-1 flex flex-col bg-[#fafbfc] overflow-hidden">
                    {isMultiPayMode ? (
                        /* Split Payment Panel with Embedded Numpad */
                        <div className="flex flex-col h-full">
                            {/* ── Header ── */}
                            <div className="px-3 py-2 border-b border-gray-200/80 bg-white flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { setIsMultiPayMode(false); setPaymentLegs([]); }}
                                        className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                    >
                                        <ArrowLeft size={14} className="text-gray-600" />
                                    </button>
                                    <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">Split Payment</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={clsx(
                                        "text-[10px] font-black px-2 py-0.5 rounded-full",
                                        multiPayRemaining <= 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                    )}>
                                        {multiPayRemaining <= 0 ? '✓ Covered' : `${currency}${formatNumber(multiPayRemaining)} left`}
                                    </span>
                                </div>
                            </div>

                            {/* ── Total & Progress ── */}
                            <div className="px-3 py-2 bg-white border-b border-gray-100">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total</span>
                                    <span className="text-base font-black text-gray-900 tabular-nums">{currency}{formatNumber(totalAmount)}</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={clsx(
                                            "h-full rounded-full transition-all duration-500",
                                            multiPayRemaining <= 0 ? "bg-emerald-500" : "bg-gradient-to-r from-amber-400 to-amber-500"
                                        )}
                                        style={{ width: `${Math.min(100, (multiPayTotal / totalAmount) * 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* ── Payment Legs ── */}
                            <div className="px-3 py-1.5 overflow-y-auto max-h-[120px] space-y-1 custom-scrollbar">
                                {paymentLegs.map((leg, idx) => {
                                    const LIcon = getMethodIcon(leg.method);
                                    return (
                                        <div key={idx} className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border border-gray-100 group">
                                            <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                <LIcon size={12} />
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-700 uppercase flex-1">{leg.method}</span>
                                            <span className="text-xs font-black text-gray-900 tabular-nums">{currency}{formatNumber(leg.amount)}</span>
                                            <button
                                                onClick={() => setPaymentLegs(prev => prev.filter((_, i) => i !== idx))}
                                                className="w-5 h-5 rounded bg-gray-50 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center text-gray-300 transition-all"
                                            >
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* ── Payment Method Selector (replaces QTY/DISC/PRICE) ── */}
                            <div className="px-3 py-1.5 border-t border-gray-100 bg-white shrink-0">
                                <div className="flex gap-1 flex-wrap">
                                    {paymentMethods.filter((m: any) => {
                                        const k = typeof m === 'string' ? m : m.key;
                                        return !k.includes('MULTI');
                                    }).map((m: any) => {
                                        const k = typeof m === 'string' ? m : m.key;
                                        const lbl = typeof m === 'string' ? m : (m.label || m.key);
                                        const MIcon = getMethodIcon(k);
                                        const isSelected = multiPaySelectedMethod === k;
                                        return (
                                            <button
                                                key={k}
                                                onClick={() => setMultiPaySelectedMethod(k)}
                                                className={clsx(
                                                    "flex items-center gap-1 px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all border",
                                                    isSelected
                                                        ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-100 scale-105"
                                                        : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
                                                )}
                                            >
                                                <MIcon size={12} />
                                                {lbl}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>


                            {/* ── Special Actions (Reward / Wallet) ── */}
                            <div className="px-3 py-2 border-t border-gray-100 bg-white shrink-0 flex gap-1.5">
                                {selectedClient && selectedClientId > 1 && (selectedClient as any).loyalty > 0 && (
                                    <button
                                        onClick={() => {
                                            const pts = (selectedClient as any).loyalty;
                                            const ptsValue = pts * 0.01; // 1 point = $0.01 — adjust as needed
                                            const amount = Math.min(ptsValue, Math.max(0, multiPayRemaining));
                                            if (amount > 0) {
                                                setPaymentLegs(prev => [...prev, { method: 'REWARD', amount }]);
                                                if (onSetPointsRedeemed) onSetPointsRedeemed(pts);
                                                toast.success(`${pts} reward points applied`);
                                            }
                                        }}
                                        className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold hover:bg-amber-100 transition-all active:scale-95"
                                    >
                                        <Star size={12} />
                                        Use Rewards
                                    </button>
                                )}
                                {selectedClient && selectedClientId > 1 && (selectedClient as any).balance > 0 && (
                                    <button
                                        onClick={() => {
                                            const bal = (selectedClient as any).balance;
                                            const amount = Math.min(bal, Math.max(0, multiPayRemaining));
                                            if (amount > 0) {
                                                setPaymentLegs(prev => [...prev, { method: 'WALLET', amount }]);
                                                toast.success(`${currency}${amount.toFixed(2)} from wallet`);
                                            }
                                        }}
                                        className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-[9px] font-bold hover:bg-blue-100 transition-all active:scale-95"
                                    >
                                        <Wallet size={12} />
                                        Use Wallet
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (multiPayRemaining <= 0 && multiPayTotal > totalAmount) {
                                            const extra = multiPayTotal - totalAmount;
                                            if (onSetStoreChangeInWallet) onSetStoreChangeInWallet(true);
                                            toast.success(`${currency}${extra.toFixed(2)} will be added to wallet`);
                                        } else {
                                            toast.info('No extra amount to store');
                                        }
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-[9px] font-bold hover:bg-indigo-100 transition-all active:scale-95"
                                >
                                    <Wallet size={12} />
                                    → Wallet
                                </button>
                            </div>

                            {/* ── Charge Button ── */}
                            <div className="px-3 py-2 border-t border-gray-200 bg-white shrink-0">
                                <button
                                    onClick={() => {
                                        const legsNote = paymentLegs.map(l => `${l.method}:${l.amount.toFixed(2)}`).join(' | ');
                                        onSetCashReceived(String(multiPayTotal));
                                        if (paymentLegs.length > 0) onSetPaymentMethod(paymentLegs[0].method);
                                        toast.info(`Multi-payment: ${legsNote}`);
                                        setIsMultiPayMode(false);
                                        setTimeout(() => onCharge(), 100);
                                    }}
                                    disabled={multiPayRemaining > 0.01 || paymentLegs.length === 0 || isProcessing}
                                    className={clsx(
                                        "w-full py-2.5 rounded-xl flex flex-col items-center justify-center transition-all relative overflow-hidden",
                                        multiPayRemaining <= 0.01 && paymentLegs.length > 0 && !isProcessing
                                            ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-200/50 hover:scale-[1.02] active:scale-[0.98]"
                                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    )}
                                >
                                    {multiPayRemaining <= 0.01 && paymentLegs.length > 0 && (
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                                    )}
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] relative z-10">Charge</span>
                                    <span className="text-lg font-black leading-none relative z-10 tabular-nums">{currency}{formatNumber(totalAmount)}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* ════ NORMAL CART VIEW ════ */
                        <>
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
                                                onClick={() => { setSelectedCartIdx(idx); setNumpadMode('qty'); setShowNumpad(true); }}
                                                className={clsx(
                                                    "px-2.5 py-1.5 group transition-colors duration-300 flex items-center gap-1.5 cursor-pointer",
                                                    selectedCartIdx === idx && highlightedItemId === item.productId
                                                        ? "bg-teal-100 ring-1 ring-teal-300"
                                                        : selectedCartIdx === idx
                                                            ? "bg-amber-50 ring-1 ring-amber-200"
                                                            : highlightedItemId === item.productId
                                                                ? "bg-emerald-100 ring-1 ring-emerald-200"
                                                                : "hover:bg-white"
                                                )}
                                            >
                                                <span className="text-[10px] text-gray-300 font-mono w-4 shrink-0 text-center">{idx + 1}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[14px] font-black text-gray-900 truncate leading-tight group-hover:text-emerald-600">{item.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {item.barcode && <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">#{item.barcode}</span>}
                                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">Stock: {item.stock || 0}</span>
                                                    </div>
                                                </div>
                                                <span
                                                    onClick={(e) => { e.stopPropagation(); setSelectedCartIdx(idx); setNumpadMode('price'); setShowNumpad(true); }}
                                                    className="text-[12px] font-black text-gray-400 shrink-0 hover:text-emerald-600 transition-colors"
                                                >
                                                    {currency}{Number(item.price).toFixed(2)}
                                                </span>
                                                <div className="flex items-center gap-px shrink-0">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleProtectedQuantity(item.productId, -1); }}
                                                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center text-gray-400 transition-all border border-transparent"
                                                    >
                                                        <Minus size={12} />
                                                    </button>
                                                    <span
                                                        onClick={(e) => { e.stopPropagation(); setSelectedCartIdx(idx); setNumpadMode('qty'); setShowNumpad(true); }}
                                                        className="w-7 text-center text-[13px] font-black tabular-nums text-gray-900 hover:text-emerald-600 transition-colors"
                                                    >
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item.productId, 1); }}
                                                        className="w-6 h-6 rounded-lg bg-emerald-50 hover:bg-emerald-500 hover:text-white text-emerald-600 flex items-center justify-center transition-all border border-emerald-100"
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                                <p className="text-[13px] font-black text-emerald-700 tabular-nums shrink-0 w-16 text-right">
                                                    {currency}{(Number(item.price) * item.quantity).toFixed(2)}
                                                </p>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleProtectedQuantity(item.productId, -item.quantity); }}
                                                    className="ml-2 w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shrink-0 flex items-center justify-center border border-rose-100"
                                                    title="Delete product from cart"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="border-t-2 border-emerald-500/20 bg-gradient-to-b from-white to-gray-50/80 px-3 py-3 shrink-0 space-y-2.5">
                                {/* ── Summary Row ── */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-gray-50 rounded-xl p-2 text-center">
                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Subtotal</span>
                                        <span className="text-sm font-black text-gray-800 tabular-nums">{currency}{formatNumber(total)}</span>
                                    </div>
                                    <div
                                        onClick={() => { setNumpadMode('disc'); setShowNumpad(true); }}
                                        className="bg-amber-50/60 rounded-xl p-2 text-center cursor-pointer hover:bg-amber-50 transition-colors group"
                                    >
                                        <div className="flex items-center justify-center gap-1">
                                            <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Discount</span>
                                            <div className="flex items-center bg-white/80 rounded px-1 py-px">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onSetDiscountType('fixed'); }}
                                                    className={clsx("px-1 text-[8px] font-bold rounded", discountType === 'fixed' ? "text-amber-700 bg-amber-100" : "text-gray-300")}
                                                >{currency}</button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onSetDiscountType('percentage'); }}
                                                    className={clsx("px-1 text-[8px] font-bold rounded", discountType === 'percentage' ? "text-amber-700 bg-amber-100" : "text-gray-300")}
                                                >%</button>
                                            </div>
                                        </div>
                                        <span className={clsx(
                                            "text-sm font-black tabular-nums",
                                            discount > 0 ? "text-amber-600" : "text-gray-300"
                                        )}>{discount > 0 ? `-${formatNumber(discountType === 'percentage' ? total * discount / 100 : discount)}` : '0'}</span>
                                    </div>
                                    <div className="bg-emerald-50 rounded-xl p-2 text-center">
                                        <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest block">Total</span>
                                        <span className="text-lg font-black text-gray-900 tabular-nums leading-tight">{currency}{formatNumber(totalAmount)}</span>
                                    </div>
                                </div>
                                {/* ── Wallet & Loyalty Quick-Pay ── */}
                                {selectedClient && selectedClientId > 1 && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {(selectedClient as any).balance > 0 && (
                                            <button
                                                onClick={() => {
                                                    onSetPaymentMethod('WALLET');
                                                    const bal = (selectedClient as any).balance;
                                                    onSetCashReceived(String(Math.min(bal, totalAmount)));
                                                    toast.success(`Wallet: ${currency}${bal.toFixed(2)} applied`);
                                                }}
                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold hover:bg-blue-100 transition-all"
                                            >
                                                <Wallet size={12} />
                                                <span>Balance: {currency}{((selectedClient as any).balance || 0).toFixed(2)}</span>
                                                <span className="bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded text-[9px] font-black">USE</span>
                                            </button>
                                        )}
                                        {(selectedClient as any).loyalty > 0 && (
                                            <button
                                                onClick={() => {
                                                    const pts = (selectedClient as any).loyalty;
                                                    if (onSetPointsRedeemed) onSetPointsRedeemed(pts);
                                                    toast.success(`${pts} loyalty points will be redeemed`);
                                                }}
                                                className={clsx(
                                                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all",
                                                    pointsRedeemed > 0
                                                        ? "bg-amber-100 border-amber-300 text-amber-800"
                                                        : "bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100"
                                                )}
                                            >
                                                <Star size={12} />
                                                <span>{(selectedClient as any).loyalty} pts</span>
                                                <span className="bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded text-[9px] font-black">
                                                    {pointsRedeemed > 0 ? '✓' : 'REDEEM'}
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                )}
                                {/* ── Received + Charge ── */}
                                <div className="flex items-stretch gap-2">
                                    <div className="flex-1 relative">
                                        <span className="absolute left-2.5 top-1.5 text-[7px] font-black text-gray-400 uppercase tracking-widest">Received</span>
                                        <input
                                            type="text"
                                            value={cashReceived ? cashReceived.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ''}
                                            onChange={(e) => {
                                                const raw = e.target.value.replace(/\s+/g, '').replace(',', '.');
                                                if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                                                    onSetCashReceived(raw);
                                                }
                                            }}
                                            placeholder={formatNumber(totalAmount)}
                                            className="w-full pt-5 pb-2 px-2.5 text-right bg-white border-2 border-gray-100 rounded-xl text-base font-black outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all font-mono tabular-nums"
                                        />
                                    </div>
                                    <button
                                        onClick={onCharge}
                                        disabled={cart.length === 0 || isProcessing}
                                        className={clsx(
                                            "flex-1 rounded-xl flex flex-col items-center justify-center transition-all relative overflow-hidden",
                                            cart.length > 0 && !isProcessing
                                                ? deficit > 0
                                                    ? "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-xl shadow-rose-200/50 hover:shadow-2xl hover:shadow-rose-300/60 hover:scale-[1.02] active:scale-[0.98]"
                                                    : changeDue > 0
                                                        ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl shadow-blue-200/50 hover:shadow-2xl hover:shadow-blue-300/60 hover:scale-[1.02] active:scale-[0.98]"
                                                        : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-200/50 hover:shadow-2xl hover:shadow-emerald-300/60 hover:scale-[1.02] active:scale-[0.98]"
                                                : "bg-gray-200 text-gray-400"
                                        )}
                                    >
                                        {cart.length > 0 && !isProcessing && (
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                                        )}
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] relative z-10">{deficit > 0 ? "Remaining" : changeDue > 0 ? "Change" : "Charge"}</span>
                                        <span className="text-xl font-black leading-none relative z-10 tabular-nums">{currency}{formatNumber(deficit > 0 ? deficit : changeDue > 0 ? changeDue : totalAmount)}</span>
                                    </button>
                                </div>
                                {/* ── Change Options (wallet / rounding) ── */}
                                {changeDue > 0 && selectedClientId > 1 && onSetStoreChangeInWallet && (
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => onSetStoreChangeInWallet(!storeChangeInWallet)}
                                            className={clsx(
                                                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold border-2 transition-all",
                                                storeChangeInWallet
                                                    ? "bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-100"
                                                    : "bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:bg-blue-50"
                                            )}
                                        >
                                            <Wallet size={14} />
                                            {storeChangeInWallet ? '✓ Add to Wallet' : 'Add to Wallet'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </main>
            </div>
            {/* ═══════════ MODALS ═══════════ */}
            <ManagerOverride
                isOpen={isOverrideOpen}
                onClose={() => onSetOverrideOpen(false)}
                onSuccess={() => {
                    if (pendingAction) {
                        pendingAction.execute();
                        setPendingAction(null);
                    }
                }}
                actionLabel={pendingAction?.label || "Protected Action"}
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
