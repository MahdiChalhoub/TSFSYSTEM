'use client';

import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CompactClientHeader } from '@/components/pos/CompactClientHeader';
import { Numpad as POSNumpad, NumpadMode } from '@/components/pos/Numpad';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import {
    Search, ShoppingCart, Plus, X, Minus, Trash2, User, ChevronDown, Layout,
    Maximize, Minimize, FileText, Settings, Wallet, Save, Book, File, ArrowLeft, RefreshCw, Wifi, WifiOff, MapPin, Calculator,
    History, GripHorizontal
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';

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
        isOnline, clientSearchQuery, deliveryZone, deliveryZones,
        onSetSearchQuery, onSetActiveCategoryId, onSetCurrentParentId, onSetActiveSessionId,
        onSetPaymentMethod, onSetCashReceived, onSetDiscount, onSetDiscountType,
        onSetOverrideOpen, onSetReceiptOpen, onAddToCart,
        onUpdateQuantity, onClearCart, onCreateNewSession, onRemoveSession,
        onUpdateActiveSession, onToggleFullscreen, onCycleSidebarMode, onCharge,
        onSync, onSetIsOnline, onSetClientSearchQuery, onSetDeliveryZone,
        onOpenLayoutSelector
    } = props;
    const receivedNum = Number(cashReceived) || 0;
    const changeDue = receivedNum > totalAmount ? receivedNum - totalAmount : 0;

    // Draggable Floating Logic
    const [showNumpad, setShowNumpad] = useState(false);
    const [numpadMode, setNumpadMode] = useState<NumpadMode>('qty');
    const [selectedCartIdx, setSelectedCartIdx] = useState<number | null>(null);
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

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
        c.phone.includes(clientSearchQuery)
    );

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
                    <Link
                        href="/sales/history"
                        className="w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                        title="View Order History Registry"
                    >
                        <History size={15} />
                    </Link>
                    <div className="flex bg-gray-50 border border-gray-100 p-0.5 rounded-lg gap-0.5">
                        <button
                            onClick={() => onSetIsOnline(!isOnline)}
                            className={clsx(
                                "h-7 px-2.5 rounded-md text-[9px] font-black flex items-center gap-1 transition-all",
                                isOnline ? "bg-white text-emerald-600 shadow-sm border border-gray-100" : "text-rose-500"
                            )}
                        >
                            {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                        </button>
                        <button
                            onClick={onSync}
                            className="h-7 px-2.5 rounded-md text-[9px] font-black text-gray-500 hover:bg-white hover:text-indigo-600 transition-all flex items-center gap-1"
                        >
                            <RefreshCw size={10} className={isProcessing ? "animate-spin" : ""} />
                            SYNC
                        </button>
                    </div>

                    {[Settings, Wallet, Save, Book, File].map((Icon, i) => (
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
            {/* Search & Categories Bar */}
            <div className="px-5 py-3 border-b border-gray-200 bg-white space-y-3">
                <div className="flex gap-3">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                            value={searchQuery}
                            onChange={(e) => onSetSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowNumpad(!showNumpad)}
                        className={clsx(
                            "px-4 py-2.5 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all shrink-0 flex items-center gap-2",
                            showNumpad ? "bg-amber-100 border-amber-300 text-amber-700" : "bg-white border-gray-200 text-gray-400 hover:bg-gray-50"
                        )}
                    >
                        <Calculator size={14} />
                        Speed Calc
                    </button>
                </div>

                <div className="flex gap-2 overflow-x-auto custom-scrollbar-h pb-2 items-center">
                    {currentParentId === null ? (
                        <>
                            <button
                                onClick={() => {
                                    onSetActiveCategoryId(null);
                                    onSetCurrentParentId(null);
                                }}
                                className={clsx(
                                    "px-5 py-2 whitespace-nowrap rounded-xl text-xs font-black uppercase tracking-widest transition-all border shrink-0",
                                    activeCategoryId === null ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                                )}
                            >ALL</button>
                            {categories.filter(c => !((c as any).parent || (c as any).parentId || (c as any).parent_id)).map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        onSetActiveCategoryId(cat.id);
                                        onSetCurrentParentId(cat.id);
                                    }}
                                    className={clsx(
                                        "px-5 py-2 whitespace-nowrap rounded-xl text-xs font-black uppercase tracking-widest transition-all border shrink-0",
                                        (activeCategoryId === cat.id || currentParentId === cat.id)
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
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
                                className="h-9 px-4 bg-indigo-600 border border-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shrink-0 flex items-center gap-2 shadow-lg shadow-indigo-100"
                            >
                                <ArrowLeft size={14} />
                                {categories.find(c => c.id === currentParentId)?.name}
                            </button>
                            <div className="w-px h-6 bg-gray-200 mx-1 shrink-0" />
                            {categories.filter(c => ((c as any).parent || (c as any).parentId || (c as any).parent_id) === currentParentId).map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        onSetActiveCategoryId(cat.id);
                                        const hasChildren = categories.some(c => ((c as any).parent || (c as any).parentId || (c as any).parent_id) === cat.id);
                                        if (hasChildren) onSetCurrentParentId(cat.id);
                                    }}
                                    className={clsx(
                                        "px-5 py-2 whitespace-nowrap rounded-xl text-xs font-black uppercase tracking-widest transition-all border shrink-0",
                                        activeCategoryId === cat.id
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
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

                    {/* Client Info with Search and Zone */}
                    <div className="p-4 border-b border-gray-100 bg-white">
                        <div className="flex gap-2 mb-3">
                            <div className="flex-1 relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
                                <input
                                    type="text"
                                    placeholder="Find customer..."
                                    value={clientSearchQuery}
                                    onChange={(e) => onSetClientSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold outline-none focus:bg-white focus:border-indigo-400 transition-all"
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
                                                className="w-full text-left px-4 py-2 hover:bg-indigo-50 border-b border-gray-50 flex items-center justify-between group"
                                            >
                                                <div>
                                                    <p className="text-[11px] font-black text-gray-900 group-hover:text-indigo-700">{c.name}</p>
                                                    <p className="text-[9px] text-gray-400 font-mono">{c.phone}</p>
                                                </div>
                                                <span className="text-[9px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100">Select</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="relative group shrink-0 w-24">
                                <select
                                    value={deliveryZone}
                                    onChange={(e) => onSetDeliveryZone(e.target.value)}
                                    className="w-full pl-3 pr-8 py-2 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-black outline-none appearance-none cursor-pointer focus:bg-white focus:border-indigo-400 transition-all uppercase tracking-wider"
                                >
                                    {deliveryZones.map(z => (
                                        <option key={z.id} value={z.name}>{z.name}</option>
                                    ))}
                                    {deliveryZones.length === 0 && (
                                        <option value="A">Zone A</option>
                                    )}
                                </select>
                                <MapPin className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={12} />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-indigo-100">
                                    {selectedClient?.name?.charAt(0) || 'C'}
                                </div>
                                <div>
                                    <p className="text-xs font-black text-gray-900">{selectedClient?.name || 'Walk-in'}</p>
                                    <p className="text-[10px] text-gray-400 font-bold">{selectedClient?.phone || 'No phone'}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                                    BAL: {currency}{formatNumber(selectedClient?.balance || 0)}
                                </p>
                            </div>
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
                                {cart.map((item: any, idx: number) => (
                                    <div
                                        key={item.productId}
                                        className={clsx(
                                            "px-5 py-3 flex items-center gap-3 group transition-colors duration-300",
                                            highlightedItemId === item.productId ? "bg-indigo-400 text-white"
                                                : lastAddedItemId === item.productId ? "bg-indigo-500/20"
                                                    : "hover:bg-gray-50/50"
                                        )}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-base font-black text-gray-900 truncate">{item.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {item.barcode && <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">#{item.barcode}</span>}
                                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded">Stock: {item.stock || 0}</span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 font-bold mt-1 uppercase tracking-tight">
                                                {currency}{Number(item.price).toFixed(2)} / unit
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item.productId, -1); }} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center text-gray-400 transition-all active:scale-90">
                                                <Minus size={12} />
                                            </button>
                                            <span
                                                onClick={(e) => { e.stopPropagation(); setSelectedCartIdx(idx); setNumpadMode('qty'); setShowNumpad(true); }}
                                                className="w-8 text-center text-sm font-black tabular-nums text-gray-900 cursor-pointer hover:text-indigo-600"
                                            >
                                                {item.quantity}
                                            </span>
                                            <button onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item.productId, 1); }} className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-all active:scale-90">
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                        <span
                                            onClick={(e) => { e.stopPropagation(); setSelectedCartIdx(idx); setNumpadMode('price'); setShowNumpad(true); }}
                                            className="w-24 text-right text-base font-black tabular-nums text-gray-900 cursor-pointer hover:text-indigo-600"
                                        >
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
                                    } else if (mode === 'price' && props.onUpdatePrice) {
                                        props.onUpdatePrice(target.productId, val);
                                    } else if (mode === 'disc' && onSetDiscount) {
                                        onSetDiscount(val);
                                    }
                                } else if (mode === 'disc' && onSetDiscount) {
                                    onSetDiscount(val);
                                }
                            }}
                        />
                    </div>

                    {/* Totals & Payment */}
                    <div className="px-5 py-4 border-t border-gray-200 bg-white shrink-0">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs mb-2">
                                <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Total Items</span>
                                <span className="text-gray-900 font-black">{formatNumber(totalPieces)} PCS</span>
                            </div>
                            <div className="flex items-center justify-between text-lg">
                                <span className="font-black text-gray-900">TOTAL</span>
                                <span className="font-black text-indigo-600 text-2xl">{currency}{formatNumber(totalAmount)}</span>
                            </div>

                            <div className="pt-2 border-t border-gray-100 flex gap-2">
                                <div className="flex-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Received</label>
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
                                        className="w-full px-2 py-2 text-right bg-gray-50 border border-gray-100 rounded-lg text-sm font-bold outline-none focus:border-indigo-500 transition-all font-mono"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Method</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => onSetPaymentMethod(e.target.value)}
                                        className="w-full px-2 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold outline-none appearance-none"
                                    >
                                        <option value="CASH">CASH</option>
                                        <option value="CARD">CARD</option>
                                        <option value="WALLET">WALLET</option>
                                        <option value="OM">OM</option>
                                        <option value="WAVE">WAVE</option>
                                    </select>
                                </div>
                            </div>
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
                                "w-full mt-4 py-4 rounded-2xl flex flex-col items-center gap-0.5 shadow-xl transition-all",
                                cart.length > 0 && !isProcessing
                                    ? "bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98]"
                                    : "bg-gray-100 text-gray-300 cursor-not-allowed shadow-none"
                            )}
                        >
                            {isProcessing ? (
                                <span className="text-sm font-black uppercase tracking-widest">Processing...</span>
                            ) : (
                                <>
                                    <span className="text-sm font-black uppercase tracking-widest">
                                        {changeDue > 0 ? "Return Change" : "Charge"}
                                    </span>
                                    {changeDue > 0 ? (
                                        <span className="text-xl font-black">{currency}{changeDue.toFixed(2)}</span>
                                    ) : (
                                        <span className="text-[11px] opacity-70 font-bold uppercase tracking-widest">{currency}{totalAmount.toFixed(2)}</span>
                                    )}
                                </>
                            )}
                        </button>
                    </div>
                </aside>
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
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Speed Calc</span>
                        </div>
                        <button onClick={() => setShowNumpad(false)} className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-100 text-amber-600 hover:bg-amber-600 hover:text-white transition-all">
                            <X size={12} />
                        </button>
                    </div>
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
                                } else if (mode === 'price' && (props as any).onUpdatePrice) {
                                    (props as any).onUpdatePrice(target.productId, val);
                                } else if (mode === 'disc' && onSetDiscount) {
                                    onSetDiscount(val);
                                }
                            } else if (mode === 'disc' && onSetDiscount) {
                                onSetDiscount(val);
                            } else {
                                toast.error("Add an item first");
                            }
                        }}
                    />
                </div>
            )}

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
