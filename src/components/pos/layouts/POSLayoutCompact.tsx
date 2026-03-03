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
 History, GripHorizontal, Wifi, WifiOff, MapPin, RefreshCw,
 ShieldCheck, Star, Coins, Landmark, Smartphone, AlertCircle
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';
import { Numpad as POSNumpad } from '@/components/pos/Numpad';
import { MultiPaymentHub } from '@/components/pos/MultiPaymentHub';
import { ClientVaultModal } from '@/components/pos/modals/ClientVaultModal';


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

 const handleOpenVault = async () => {
 if (!selectedClient) return;
 if (setIsVaultOpen) setIsVaultOpen(true);
 if (getClientFidelityData) await getClientFidelityData(selectedClient.id);
 };

 return (
 <div className={clsx(
 "flex flex-col bg-app-bg overflow-hidden select-none h-full text-app-text font-sans transition-colors duration-700 relative",
 isFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen" : "absolute inset-0"
 )}>
 {/* Ambient Background Glows */}
 <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] pointer-events-none" />
 <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] pointer-events-none" />

 {/* ═══════ SHARED TOOLBAR ═══════ */}
 <POSToolbar
 sessions={sessions}
 activeSessionId={activeSessionId}
 onSetActiveSessionId={onSetActiveSessionId}
 onCreateNewSession={onCreateNewSession}
 onRemoveSession={onRemoveSession}
 registerConfig={registerConfig as any}
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
 onLockRegister={onLockRegister || (() => { })}
 onCloseRegister={onCloseRegister || (() => { })}
 onOpenReturn={onOpenReturn || (() => { })}
 />

 {/* ═══════ CLIENT INFO (Premium Dark) ═══════ */}
 <div className="h-14 bg-app-text/80 backdrop-blur-xl border-b border-app-border px-6 flex items-center justify-between shrink-0 relative z-10 transition-all">
 <div className="flex items-center gap-6 divide-x divide-white/5">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-xl bg-app-surface shadow-inner border border-app-border flex items-center justify-center text-emerald-500 relative group">
 <div className="absolute inset-0 bg-emerald-500/10 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
 <span className="text-[11px] font-black uppercase italic relative z-10">{selectedClient?.name?.substring(0, 2) || '??'}</span>
 </div>
 <div className="flex flex-col">
 <span className="text-[12px] font-black text-app-text uppercase tracking-wider italic flex items-center gap-2">
 {selectedClient?.name || 'Walk-in Customer'}
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
 </span>
 <span className="text-[9px] font-black text-app-text-faint tracking-[0.2em] font-mono leading-none mt-1">{selectedClient?.phone || 'No phone'}</span>
 </div>
 </div>

 <button
 onClick={handleOpenVault}
 className="pl-6 flex flex-col items-start hover:bg-emerald-500/5 px-4 py-1.5 rounded-xl transition-all group border border-transparent hover:border-emerald-500/20"
 >
 <span className="text-[8px] font-black text-app-text-muted uppercase tracking-[0.3em] leading-none mb-1.5 group-hover:text-emerald-400 transition-colors">Balance Due</span>
 <span className={clsx("text-[13px] font-black tabular-nums italic transition-colors", (selectedClient?.balance || 0) > 0 ? "text-rose-500" : "text-emerald-500")}>
 {currency}{formatNumber(selectedClient?.balance || 0)}
 </span>
 </button>

 <div className="pl-6 flex flex-col items-start px-4">
 <span className="text-[8px] font-black text-app-text-muted uppercase tracking-[0.3em] leading-none mb-1.5 italic">Order Density</span>
 <div className="flex items-baseline gap-1.5">
 <span className="text-[13px] font-black text-app-text tabular-nums italic">{formatNumber(totalPieces)}</span>
 <span className="text-[8px] text-app-text-faint font-black uppercase tracking-widest italic opacity-60">Items</span>
 </div>
 </div>
 </div>

 <div className="flex items-center gap-4">
 <div className="flex items-center gap-3 px-4 py-2 bg-app-text/60 border border-app-border rounded-2xl group focus-within:border-emerald-500/50 transition-all shadow-inner">
 <Search className="text-app-text-muted group-focus-within:text-emerald-400 transition-colors" size={14} />
 <input
 type="text"
 placeholder="Search client..."
 value={clientSearchQuery}
 onChange={(e) => {
 const v = e.target.value;
 onSetClientSearchQuery(v);
 if (onSearchClients) onSearchClients(v);
 }}
 className="bg-transparent border-none outline-none text-[11px] font-black text-app-text placeholder:text-app-text-faint w-36 focus:w-56 transition-all uppercase tracking-widest italic"
 />
 </div>
 <div className="relative group shrink-0">
 <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted group-focus-within:text-emerald-400 transition-colors" size={12} />
 <select
 value={deliveryZone || ''}
 onChange={(e) => onSetDeliveryZone(e.target.value)}
 className="pl-8 pr-10 py-2 bg-app-text/60 border border-app-border rounded-2xl text-[10px] font-black text-app-text-faint outline-none appearance-none cursor-pointer uppercase tracking-widest hover:border-app-border transition-all italic focus:border-emerald-500/50"
 >
 {deliveryZones.map(z => (
 <option key={z.id} value={z.name} className="bg-app-surface text-app-text">{z.name}</option>
 ))}
 {deliveryZones.length === 0 && (
 <option value="A" className="bg-app-surface text-app-text">Default Zone</option>
 )}
 </select>
 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none" size={12} />
 </div>
 </div>
 </div>

 {/* ═══════ SEARCH + CATEGORY BAR (Tactical) ═══════ */}
 <div className="bg-app-text/20 backdrop-blur-md border-b border-app-border px-6 py-4 flex items-center gap-6 shrink-0 relative z-10 transition-all">
 <div className="relative flex-1 group">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted group-focus-within:text-emerald-400 transition-colors" size={16} />
 <input
 type="text"
 placeholder="Search by barcode, SKU, or name..."
 className="w-full pl-12 pr-4 py-3 bg-app-surface border border-app-border rounded-[1.2rem] text-[11px] font-black text-app-text outline-none focus:border-emerald-500/50 transition-all placeholder:text-app-text-faint uppercase tracking-[0.2em] italic shadow-inner"
 value={searchQuery}
 onChange={(e) => onSetSearchQuery(e.target.value)}
 />
 </div>
 <div className="flex gap-2 overflow-x-auto no-scrollbar shrink-0 items-center">
 {currentParentId === null ? (
 <>
 <button
 onClick={() => {
 onSetActiveCategoryId(null);
 onSetCurrentParentId(null);
 }}
 className={clsx(
 "px-4 py-2.5 whitespace-nowrap rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all italic border shadow-lg",
 activeCategoryId === null
 ? 'bg-emerald-gradient text-app-text border-emerald-400 scale-105 z-10'
 : 'bg-app-surface text-app-text-faint border-app-border hover:text-emerald-400 hover:border-emerald-500/30'
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
 "px-4 py-2.5 whitespace-nowrap rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all italic border",
 (activeCategoryId === cat.id || currentParentId === cat.id)
 ? 'bg-emerald-gradient text-app-text border-emerald-400 scale-105 z-10 shadow-emerald-900/40'
 : 'bg-app-surface text-app-text-faint border-app-border hover:text-emerald-400 hover:border-emerald-500/30'
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
 className="h-10 px-4 bg-emerald-gradient text-app-text rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 italic shadow-lg border border-emerald-400"
 >
 <ArrowLeft size={14} className="stroke-[3]" />
 {categories.find(c => c.id === currentParentId)?.name}
 </button>
 <div className="w-[1px] h-6 bg-app-text/10 mx-2 shrink-0" />
 {categories.filter(c => ((c as any).parent || (c as any).parentId || (c as any).parent_id) === currentParentId).map(cat => (
 <button
 key={cat.id}
 onClick={() => {
 onSetActiveCategoryId(cat.id);
 const hasChildren = categories.some(c => ((c as any).parent || (c as any).parentId || (c as any).parent_id) === cat.id);
 if (hasChildren) onSetCurrentParentId(cat.id);
 }}
 className={clsx(
 "px-4 py-2.5 whitespace-nowrap rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all italic border",
 activeCategoryId === cat.id
 ? 'bg-emerald-gradient text-app-text border-emerald-400 scale-105'
 : 'bg-app-surface text-app-text-faint border-app-border hover:text-emerald-400'
 )}
 >
 {cat.name}
 </button>
 ))}
 </>
 )}
 </div>
 </div>

 {/* ═══════ MAIN CONTENT ═══════ */}
 <div className="flex-1 flex overflow-hidden relative z-10">
 {/* ─── LEFT: Products ─── */}
 <div className="w-1/2 flex flex-col overflow-hidden border-r border-app-border">
 <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
 <div className="absolute inset-0 bg-emerald-500/[0.02] pointer-events-none" />
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
 <div className="w-1/2 flex flex-col overflow-hidden bg-app-text/80 backdrop-blur-md">
 {/* Cart Header */}
 <div className="px-6 py-3 border-b border-app-border flex items-center justify-between shrink-0 bg-app-text/60 transition-all">
 <div className="flex items-center gap-3">
 <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse" />
 <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-app-text-faint italic">Order Queue</h2>
 </div>
 <div className="flex items-center gap-3">
 <span className="px-2 py-0.5 bg-app-surface rounded-lg text-[9px] font-black text-app-text-faint italic uppercase">
 {uniqueItems}L // {totalPieces}P
 </span>
 {cart.length > 0 && (
 <button
 onClick={() => onClearCart(false)}
 className="p-1 text-app-text-muted hover:text-rose-500 transition-colors"
 title="Clear Cart"
 >
 <Trash2 size={14} />
 </button>
 )}
 </div>
 </div>

 {/* Dense Cart Area */}
 <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
 {cart.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-full text-app-text gap-4 animate-in fade-in zoom-in duration-500">
 <ShoppingCart size={48} strokeWidth={1} className="opacity-20" />
 <div className="text-center">
 <p className="text-[10px] font-black uppercase tracking-[0.4em]">Cart Empty</p>
 <p className="text-[8px] font-bold text-app-text uppercase mt-1">Add items to get started</p>
 </div>
 </div>
 ) : (
 <div className="space-y-2">
 {cart.map((item: any) => (
 <div
 key={item.productId}
 className={clsx(
 "flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 relative overflow-hidden group/item",
 highlightedItemId === item.productId
 ? "bg-emerald-500/20 border-emerald-500/40 shadow-[0_10px_20px_rgba(0,0,0,0.3)]"
 : lastAddedItemId === item.productId
 ? "bg-app-surface border-app-border"
 : "bg-app-text/50 border-app-border hover:border-app-border hover:bg-app-bg/80"
 )}
 >
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="text-[13px] font-black text-app-text italic uppercase truncate tracking-wide">{item.name}</span>
 <span className="text-[9px] font-black text-app-text-muted font-mono">#{item.barcode || 'N/A'}</span>
 </div>
 <div className="flex items-center gap-2 mt-1">
 <span className="text-[10px] font-black text-emerald-500/80 italic">{currency}{Number(item.price).toFixed(2)}</span>
 <span className="text-[9px] font-black text-app-text-faint bg-app-surface px-1.5 py-0.5 rounded border border-app-border">STOCK: {item.stock || 0}</span>
 </div>
 {/* Line note mini-view */}
 {item.note && (
 <div className="mt-2 text-[9px] font-black text-amber-500 uppercase tracking-tighter italic border-l-2 border-amber-500/50 pl-2">
 LOG: {item.note}
 </div>
 )}
 </div>

 <div className="flex items-center gap-1.5 bg-app-text/90 p-1 rounded-xl border border-app-border">
 <button onClick={() => onUpdateQuantity(item.productId, -1)} className="w-6 h-6 rounded-lg bg-app-surface hover:bg-rose-500/20 hover:text-rose-500 flex items-center justify-center text-app-text-muted transition-all border border-app-border">
 <Minus size={10} strokeWidth={3} />
 </button>
 <span className="w-6 text-center text-[12px] font-black text-app-text tabular-nums">{item.quantity}</span>
 <button onClick={() => onUpdateQuantity(item.productId, 1)} className="w-6 h-6 rounded-lg bg-app-surface hover:bg-emerald-500/20 hover:text-emerald-400 flex items-center justify-center text-app-text-muted transition-all border border-app-border">
 <Plus size={10} strokeWidth={3} />
 </button>
 </div>

 <div className="text-right min-w-[80px]">
 <span className="text-base font-black text-emerald-400 italic tabular-nums">
 {currency}{formatNumber(Number(item.price) * item.quantity)}
 </span>
 </div>

 <button
 onClick={() => onUpdateQuantity(item.productId, -100)}
 className="opacity-0 group-hover/item:opacity-100 text-app-text hover:text-rose-500 transition-all ml-1"
 >
 <X size={14} strokeWidth={3} />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Payment & Totals (Tactical Dashboard) */}
 <div className="border-t border-app-border bg-app-surface p-6 shrink-0 relative transition-all">
 <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

 <div className="flex items-center justify-between mb-6 relative z-10">
 <div className="flex flex-col">
 <span className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.3em] mb-1 italic">Payment</span>
 <div className="flex items-center gap-3">
 <span className="text-[10px] font-black text-app-text-faint uppercase tracking-widest italic">Sub: {currency}{formatNumber(total)}</span>
 {discount > 0 && (
 <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] font-black text-amber-500 italic">
 -{props.discountType === 'fixed' ? currency : ''}{formatNumber(discount)}{props.discountType === 'percentage' ? '%' : ''} DISC
 </span>
 )}
 </div>
 </div>
 <div className="text-right">
 <span className="text-4xl font-black text-app-text tabular-nums tracking-tighter italic">
 <span className="text-emerald-500 mr-2 opacity-50 underline decoration-2">{currency}</span>
 {formatNumber(totalAmount)}
 </span>
 </div>
 </div>

 {/* Payment Selection Hub */}
 <div className="grid grid-cols-3 gap-2 mb-6">
 {paymentMethods.map((m: any) => {
 const key = typeof m === 'string' ? m : m.key;
 const label = typeof m === 'string' ? m : (m.label || key);
 const isLinked = ['MULTI', 'DELIVERY', 'CREDIT'].includes(key) || (typeof m === 'object' && m.accountId);
 const isActive = paymentMethod === key;

 return (
 <button
 key={key}
 disabled={!isLinked}
 onClick={() => {
 if (key === 'MULTI') setIsMultiPayMode(true);
 else if (isLinked) onSetPaymentMethod(key);
 }}
 className={clsx(
 "py-3 rounded-[1rem] text-[9px] font-black uppercase tracking-widest transition-all italic border",
 !isLinked
 ? "bg-app-bg border-app-border text-app-text opacity-40 cursor-not-allowed"
 : isActive
 ? "bg-emerald-500 text-black border-emerald-400 shadow-[0_5px_15px_rgba(16,185,129,0.3)] scale-105"
 : "bg-app-surface border-app-border text-app-text-faint hover:text-app-text hover:border-emerald-500/30"
 )}
 >
 {label}
 </button>
 );
 })}
 </div>

 {/* Cash & Change Logic */}
 <div className="flex items-center gap-3 mb-6">
 <div className="relative flex-1 group">
 <span className="absolute left-4 -top-2 px-2 bg-app-surface text-[8px] font-black text-app-text-muted uppercase tracking-[0.3em] z-10 transition-colors group-focus-within:text-emerald-400">Amount Received</span>
 <input
 type="text"
 inputMode="numeric"
 placeholder="0.00"
 value={cashReceived ? cashReceived.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ''}
 onChange={(e) => {
 const raw = e.target.value.replace(/\s+/g, '').replace(',', '.');
 if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
 onSetCashReceived(raw);
 }
 }}
 className="w-full px-5 py-4 bg-app-surface border border-app-border rounded-2xl text-[18px] font-black text-app-text outline-none focus:border-emerald-500/50 transition-all font-mono italic text-right placeholder:text-app-text-faint shadow-inner"
 />
 </div>
 </div>

 {/* Main Payment Button */}
 <button
 onClick={() => onCharge()}
 disabled={isProcessing || cart.length === 0}
 className={clsx(
 "group relative w-full h-[72px] rounded-[2rem] overflow-hidden transition-all duration-500",
 cart.length > 0 && !isProcessing
 ? "bg-emerald-gradient hover:scale-[1.02] active:scale-[0.98] shadow-emerald-500/20 ring-1 ring-emerald-400/50"
 : "bg-app-surface grayscale opacity-50 cursor-not-allowed border border-app-border"
 )}
 >
 <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

 <div className="relative z-10 flex items-center justify-between px-10">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-app-text/10 backdrop-blur-xl flex items-center justify-center text-app-text border border-app-border group-hover:rotate-[15deg] transition-all duration-500">
 {isProcessing ? <RefreshCw size={24} className="animate-spin" /> : <ShieldCheck size={28} className="stroke-[2.5]" />}
 </div>
 <div className="flex flex-col items-start">
 <span className="text-[9px] font-black text-emerald-100/60 uppercase tracking-[0.3em] leading-none mb-1 italic">Pay Now</span>
 <span className="text-[18px] font-black text-app-text uppercase tracking-wider leading-none italic">
 {isProcessing ? "PROCESSING..." : changeDue > 0 ? "GIVE CHANGE" : "COMPLETE SALE"}
 </span>
 </div>
 </div>
 <div className="text-right">
 <span className="text-[26px] font-black text-app-text tabular-nums tracking-tighter leading-none italic">
 {currency}{formatNumber(changeDue > 0 ? changeDue : totalAmount)}
 </span>
 </div>
 </div>
 <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-700" />
 </button>
 </div>
 </div>
 </div>

 {/* Loyalty Vault Modal */}
 <ClientVaultModal
 isOpen={isVaultOpen || false}
 onClose={() => { if (setIsVaultOpen) setIsVaultOpen(false); }}
 clientName={selectedClient?.name || 'Walk-in'}
 currency={currency}
 fidelity={clientFidelity}
 loading={fidelityLoading || false}
 />

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
 className="flex items-center justify-between px-2 mb-2 cursor-grab active:cursor-grabbing hover:bg-app-bg rounded-lg p-1 transition-colors group/handle"
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
 let firstMethod = legs.length > 0 ? legs[0].method : undefined;
 if (firstMethod) onSetPaymentMethod(firstMethod);
 setIsMultiPayMode(false);
 setTimeout(() => onCharge(false, { paymentLegs: legs, notes: legsNote, paymentMethod: firstMethod || "CASH", cashReceived: String(totalPaid) }), 300);
 }}
 />
 </div>

 );
}
