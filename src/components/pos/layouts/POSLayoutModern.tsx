'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { AccountBook } from '@/components/pos/AccountBook';
import { POSToolbar } from '@/components/pos/POSToolbar';
import {
 RefreshCw, ShieldCheck, UserPlus, Coins, AlertCircle, Lock,
 History as HistoryIcon, Wifi, WifiOff, Smartphone, Landmark,
 ShoppingCart, X, Plus, Minimize, Maximize, Layout, Search, MapPin,
 ChevronDown, Calculator, ArrowLeft, EyeOff, Eye, Package, Tag,
 GripHorizontal, Minus, Trash2, CreditCard, Wallet, Banknote, Star, BookOpen,
 Phone, User, Building2, DollarSign, Globe
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import Link from 'next/link';
import { Numpad as POSNumpad, NumpadMode } from '@/components/pos/Numpad';
import { MultiPaymentDashboard } from '@/components/pos/MultiPaymentHub';
import { POSSalesHistoryPanel } from '@/components/pos/POSSalesHistoryPanel';
import { POSDeliveryModal } from '@/components/pos/POSDeliveryModal';
import { POSPendingDeliveriesPanel } from '@/components/pos/POSPendingDeliveriesPanel';


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
 onSetStoreChangeInWallet, onSetPointsRedeemed, onSetNotes,
 currentLayout, onSearchClients
 } = props;
 const paymentMethods = (props as any).paymentMethods || DEFAULT_PAYMENT_METHODS;
 const registerConfig = (props as any).registerConfig;
 const onLockRegister = (props as any).onLockRegister;
 const receivedNum = Number(cashReceived) || 0;
 const changeDue = receivedNum > totalAmount ? receivedNum - totalAmount : 0;
 const deficit = receivedNum > 0 && receivedNum < totalAmount ? totalAmount - receivedNum : 0;
 const [leftExpanded, setLeftExpanded] = useState(false);
 const [showNumpad, setShowNumpad] = useState(false);
 const [numpadMode, setNumpadMode] = useState<NumpadMode>('qty');
 const [selectedCartIdx, setSelectedCartIdx] = useState<number | null>(null);
 // ── Multi-Payment State ──
 const [isMultiPayMode, setIsMultiPayMode] = useState(false);
 const [isAccountBookOpen, setIsAccountBookOpen] = useState(false);
 const [isHistoryOpen, setIsHistoryOpen] = useState(false);
 const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
 const [isPendingDeliveriesOpen, setIsPendingDeliveriesOpen] = useState(false);
 const [showClientPanel, setShowClientPanel] = useState(false);
 const [searchResults, setSearchResults] = useState<any[]>([]); // last API search results — avoids showing accumulated duplicates
 const clientPanelRef = useRef<HTMLDivElement>(null);

 // Close client panel on outside click
 useEffect(() => {
 if (!showClientPanel) return;
 function handleOutside(e: MouseEvent) {
 if (clientPanelRef.current && !clientPanelRef.current.contains(e.target as Node)) {
 setShowClientPanel(false);
 }
 }
 document.addEventListener('mousedown', handleOutside);
 return () => document.removeEventListener('mousedown', handleOutside);
 }, [showClientPanel]);

 // Auto-switch to products view when a search query is active
 useEffect(() => {
 if (searchQuery) setLeftExpanded(true);
 }, [searchQuery]);

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
 // ALL decreases require manager override (decrease qty, remove item)
 if (delta < 0) {
 const actionLabel = (item?.quantity || 0) + delta <= 0
 ? `Delete "${item?.name || 'Item'}" from cart`
 : `Decrease "${item?.name || 'Item'}" qty by ${Math.abs(delta)}`;
 props.onSetPendingOverrideAction({
 label: actionLabel,
 execute: () => onUpdateQuantity(productId, delta)
 });
 onSetOverrideOpen(true);
 } else {
 onUpdateQuantity(productId, delta);
 }
 }, [cart, onUpdateQuantity, onSetOverrideOpen]);
 const handleProtectedDiscount = useCallback((val: number) => {
 props.onSetPendingOverrideAction({
 label: `Apply ${val}% Discount`,
 execute: () => onSetDiscount(val)
 });
 onSetOverrideOpen(true);
 }, [onSetDiscount, onSetOverrideOpen]);
 const handleProtectedPrice = useCallback((productId: number, newPrice: number) => {
 const item = cart.find(i => i.productId === productId);
 const currentPrice = Number(item?.price || 0);
 if (newPrice < currentPrice) {
 props.onSetPendingOverrideAction({
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

 // Client-side hydration safety
 const [isClient, setIsClient] = useState(false);
 useEffect(() => { setIsClient(true); }, []);


 const filteredCategories = categories.filter(cat => {
 const parentId = (cat as any).parent || (cat as any).parentId || (cat as any).parent_id || null;
 return parentId === currentParentId;
 });
 const currentParentName = currentParentId ? categories.find(c => c.id === currentParentId)?.name : null;
 const filteredClients = clients.filter(c => {
 if (c.id === 1) return false; // exclude walk-in from dropdown
 if (!clientSearchQuery) return true; // show all when no query
 const q = clientSearchQuery.toLowerCase();
 return (
 c.name?.toLowerCase().includes(q) ||
 c.phone?.toLowerCase().includes(q) ||
 (c as any).address?.toLowerCase().includes(q)
 );
 });
 const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
 return (
 <div className={clsx(
 "flex flex-col overflow-hidden select-none h-full",
 isFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen bg-[#f4f6f8]" : "absolute inset-0 bg-[#f4f6f8]"
 )}>
 {/* ═══════════ SHARED TOOLBAR ═══════════ */}
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
 onOpenAccountBook={() => setIsAccountBookOpen(true)}
 onOpenPendingDeliveries={() => setIsPendingDeliveriesOpen(true)}
 />

 {/* ═══════════ MAIN SPLIT ═══════════ */}
 <div className="flex-1 flex overflow-hidden relative">
 {/* ── Security Overlay for Cart when in Payment Mode ── */}
 {isMultiPayMode && (
 <div className="absolute top-0 right-0 w-[42%] h-full bg-app-text/10 backdrop-blur-[2px] z-[100] flex flex-col items-center justify-center p-8 text-center pointer-events-auto">
 <div className="bg-app-text/90 p-6 rounded-3xl shadow-2xl border border-amber-200 flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
 <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
 <Lock size={32} />
 </div>
 <div>
 <h3 className="text-lg font-black text-app-text">Cart Locked</h3>
 <p className="text-xs text-app-text-faint max-w-[200px] mt-1">Exit Payment Mode to modify items or quantities.</p>
 </div>
 <button
 onClick={() => setIsMultiPayMode(false)}
 className="px-6 py-2 bg-app-surface text-app-text rounded-xl text-xs font-bold hover:bg-app-surface-2 transition-all"
 >
 Unlock Cart
 </button>
 </div>
 </div>
 )}

 {/* ════ LEFT COLUMN (58%) ════ */}
 <aside className="w-[58%] flex flex-col bg-app-surface border-r border-gray-200/80 shrink-0 overflow-hidden relative">
 {isMultiPayMode ? (
 <MultiPaymentDashboard
 totalAmount={totalAmount}
 client={selectedClient}
 currency={currency}
 paymentMethods={paymentMethods}
 isProcessing={isProcessing}
 allowedAccounts={registerConfig?.allowedAccounts || []}
 onCancel={() => setIsMultiPayMode(false)}
 onConfirm={(legs) => {
 const legsNote = legs.map(l => `${l.method}:${l.amount.toFixed(2)}`).join(' | ');
 if (onSetNotes) onSetNotes(legsNote);
 const totalPaid = legs.reduce((sum, l) => sum + l.amount, 0);
 onSetCashReceived(String(totalPaid));
 let firstMethod = legs.length > 0 ? legs[0].method : undefined;
 if (firstMethod) onSetPaymentMethod(firstMethod);
 setIsMultiPayMode(false);
 setTimeout(() => onCharge(false, { paymentLegs: legs, notes: legsNote, paymentMethod: firstMethod || "CASH", cashReceived: String(totalPaid) }), 300);
 }}
 />
 ) : (
 <>
 {/* ==========================================
 CLIENT BAR — fully inline, no popover
 ========================================== */}
 <div ref={clientPanelRef} className="px-3 py-1.5 border-b border-app-border bg-app-surface shrink-0 space-y-1">

 {/* ROW 1: avatar | name↔search | badges | zone */}
 <div className="flex items-center gap-2 min-w-0">

 {/* Avatar — click to toggle search */}
 <button
 onClick={() => setShowClientPanel(p => !p)}
 className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-app-text text-[11px] font-black shadow-md shadow-indigo-100 shrink-0 hover:ring-2 hover:ring-indigo-300 transition-all"
 >
 {showClientPanel
 ? <Search size={12} />
 : (selectedClient?.name?.charAt(0) || 'C')
 }
 </button>

 {/* Name ↔ Search in the same spot */}
 <div className="relative min-w-0" style={{ width: 150 }}>
 {showClientPanel ? (
 /* SEARCH MODE */
 <>
 <input
 id="pos-customer-search"
 type="text"
 autoFocus
 placeholder="Search client..."
 value={clientSearchQuery}
 onChange={async (e) => {
 const v = e.target.value;
 onSetClientSearchQuery(v);
 if (onSearchClients) onSearchClients(v);
 }}
 onFocus={async () => {
 setClientDropdownOpen(true);
 if (clients.filter((c) => c.id !== 1).length === 0 && onSearchClients) {
 await onSearchClients('');
 }
 }}
 onBlur={() => setTimeout(() => setClientDropdownOpen(false), 200)}
 onKeyDown={(e) => {
 if (e.key === 'Escape') {
 setShowClientPanel(false);
 onSetClientSearchQuery('');
 setSearchResults([]);
 setClientDropdownOpen(false);
 }
 }}
 />
 {/* Suggestions dropdown — show when focused */}
 {clientDropdownOpen && (
 <div className="absolute top-full left-0 w-72 mt-1 bg-app-surface border border-app-border rounded-xl shadow-2xl z-[300] max-h-64 overflow-y-auto">
 {filteredClients.length === 0 ? (
 <div className="px-4 py-3 text-[10px] text-app-text-faint text-center font-bold">No clients found</div>
 ) : filteredClients.map(c => (
 <button
 key={c.id}
 onClick={() => {
 onUpdateActiveSession({ clientId: c.id });
 // Auto-set zone from client if available
 if ((c as any).zone && onSetDeliveryZone) onSetDeliveryZone((c as any).zone);
 onSetClientSearchQuery('');
 setSearchResults([]);
 setShowClientPanel(false);
 }}
 className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 border-b border-gray-50 last:border-0 flex items-center justify-between group transition-colors"
 >
 <div className="flex items-center gap-2 min-w-0">
 <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-black shrink-0">
 {c.name?.charAt(0) || 'C'}
 </div>
 <div className="min-w-0">
 <p className="text-[11px] font-black text-app-text truncate group-hover:text-indigo-700">{c.name}</p>
 {c.phone && <p className="text-[9px] text-app-text-faint font-mono">{c.phone}</p>}
 {(c as any).address && (c as any).address !== 'N/A' && <p className="text-[9px] text-app-text-faint truncate">{(c as any).address}</p>}
 {(c as any).customer_tier && (c as any).customer_tier !== 'STANDARD' && <p className="text-[9px] font-bold text-indigo-500 uppercase">{(c as any).customer_tier}</p>}
 </div>
 </div>
 <div className="shrink-0 ml-2 text-right">
 <p className="text-[9px] font-black text-emerald-600">{currency}{formatNumber(c.balance || 0)}</p>
 <p className="text-[8px] text-amber-500 font-bold">{c.loyalty || 0}pts</p>
 </div>
 </button>
 ))}
 </div>
 )}
 </>
 ) : (
 /* DISPLAY MODE — click to edit */
 <button
 onClick={() => setShowClientPanel(true)}
 className="w-full text-left truncate group"
 >
 <p className="text-[12px] font-black text-app-text truncate leading-none group-hover:text-indigo-600 transition-colors">
 {selectedClient?.name || 'Walk-in'}
 </p>
 {selectedClient?.phone && (
 <p className="text-[9px] text-app-text-faint font-mono leading-none mt-0.5 truncate">{selectedClient.phone}</p>
 )}
 </button>
 )}
 </div>

 {/* ── Info Badges — scrollable row ── */}
 <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-hide">

 {/* Balance */}
 <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-md text-[9px] font-black whitespace-nowrap shrink-0">
 BAL {currency}{formatNumber(selectedClient?.balance || 0)}
 </span>

 {/* Credit limit */}
 {(selectedClient?.creditLimit || (selectedClient as any)?.credit_limit) > 0 && (
 <span className="bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-md text-[9px] font-black whitespace-nowrap shrink-0">
 CR {currency}{formatNumber(selectedClient?.creditLimit || (selectedClient as any)?.credit_limit || 0)}
 </span>
 )}

 {/* Loyalty */}
 <span className="bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-md text-[9px] font-black flex items-center gap-0.5 whitespace-nowrap shrink-0">
 <Star size={7} />{selectedClient?.loyalty || 0}pts
 </span>

 {/* Customer Tier (VIP / Wholesale / Retail / Standard) */}
 {(selectedClient as any)?.customer_tier && (selectedClient as any).customer_tier !== 'STANDARD' && (
 <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded-md text-[9px] font-black whitespace-nowrap shrink-0 uppercase">
 {(selectedClient as any).customer_tier}
 </span>
 )}

 {/* Customer Type (free-text label) */}
 {(selectedClient as any)?.customer_type && (
 <span className="bg-violet-50 text-violet-700 border border-violet-100 px-1.5 py-0.5 rounded-md text-[9px] font-black whitespace-nowrap shrink-0">
 <Tag size={7} className="inline mr-0.5" />{(selectedClient as any).customer_type}
 </span>
 )}

 </div>

 {/* Zone selector */}
 <div className="relative shrink-0">
 <MapPin className="absolute left-1.5 top-1/2 -translate-y-1/2 text-app-text-faint pointer-events-none" size={9} />
 <select
 value={deliveryZone}
 onChange={(e) => onSetDeliveryZone(e.target.value)}
 className="pl-5 pr-5 py-1 bg-app-surface border border-app-border rounded-lg text-[10px] font-black outline-none appearance-none cursor-pointer focus:border-emerald-400 transition-all uppercase tracking-wider"
 >
 {deliveryZones.map(z => (
 <option key={z.id} value={z.name}>{z.name}</option>
 ))}
 {deliveryZones.length === 0 && <option value="">Zone</option>}
 </select>
 <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 text-app-text-faint pointer-events-none" size={8} />
 </div>
 </div>

 {/* ROW 2: Address (if present) */}
 {selectedClient?.address && selectedClient.address !== 'N/A' && selectedClient.address !== 'n/a' && (
 <div className="flex items-center gap-1 pl-10">
 <Globe size={9} className="text-app-text-faint shrink-0" />
 <p className="text-[9px] text-app-text-muted font-medium truncate leading-none">
 {selectedClient.address}
 </p>
 </div>
 )}
 </div>

 {/* Search + Calculator Button + Category Pills */}
 <div className="px-3 py-2 border-b border-app-border space-y-1.5 shrink-0">
 <div className="flex items-center gap-2">
 <div className="relative flex-1">
 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-text-faint" size={14} />
 <input
 id="pos-product-search"
 type="text"
 placeholder="Search products, scan barcode..."
 className="w-full pl-8 pr-10 py-1.5 bg-app-bg border border-app-border rounded-lg text-xs outline-none focus:bg-app-surface focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition-all font-medium"
 value={searchQuery}
 onChange={(e) => onSetSearchQuery(e.target.value)}
 />
 {searchQuery && (
 <button
 onClick={() => onSetSearchQuery('')}
 className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-app-text-faint hover:text-rose-500 transition-colors"
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
 : "bg-app-surface border-app-border text-app-text-faint hover:border-amber-300 hover:text-amber-600"
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
 (activeCategoryId === null && currentParentId === null) ? 'bg-indigo-600 border-indigo-600 text-app-text shadow-lg shadow-indigo-100' : 'bg-app-surface border-app-border text-app-text-muted hover:border-indigo-300 hover:text-indigo-600'
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
 ? 'bg-emerald-600 border-emerald-600 text-app-text shadow-lg shadow-emerald-200'
 : 'bg-app-surface border-app-border text-app-text-muted hover:border-emerald-300 hover:text-emerald-600'
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
 className="h-9 px-4 bg-indigo-600 border border-indigo-600 text-app-text rounded-xl text-[12px] font-black uppercase tracking-widest transition-all shrink-0 flex items-center gap-2 shadow-lg shadow-indigo-100"
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
 ? 'bg-emerald-600 border-emerald-600 text-app-text shadow-lg shadow-emerald-200'
 : 'bg-app-surface border-app-border text-app-text-muted hover:border-emerald-300 hover:text-emerald-600'
 )}
 >{cat.name}</button>
 ))}
 </>
 )}
 </div>
 </div>
 {/* Toggle View Mode */}
 <div className="px-3 py-1 border-b border-gray-50 flex items-center justify-between shrink-0 bg-gray-50/50">
 <span className="text-[10px] font-semibold text-app-text-muted flex items-center gap-1">
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
 <ProductGrid
 searchQuery={searchQuery}
 categoryId={activeCategoryId || currentParentId}
 onAddToCart={onAddToCart}
 currency={currency}
 onProductsLoaded={(products) => {
 if ((props as any).onProductsLoaded) {
 (props as any).onProductsLoaded(products);
 }
 }}
 onAutoAdd={(product) => {
 onAddToCart(product);
 // Clear search after auto-add
 setTimeout(() => onSetSearchQuery(''), 300);
 }}
 onNotFound={(q) => {
 import('sonner').then(({ toast }) => {
 toast.error(`"${q}" not found`, {
 description: 'No product matches this barcode or search.',
 duration: 3000,
 });
 });
 try {
 const a = new Audio('/sounds/error.mp3');
 a.play().catch(() => { });
 } catch { }
 setTimeout(() => onSetSearchQuery(''), 1500);
 }}
 />
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
 className="p-4 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-app-text text-center group hover:shadow-xl transition-all border-none"
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
 "p-6 rounded-2xl border text-center group hover:shadow-2xl transition-all bg-app-surface relative flex flex-col items-center justify-center gap-3",
 (activeCategoryId === cat.id || currentParentId === cat.id)
 ? "border-emerald-400 ring-4 ring-emerald-50 shadow-xl"
 : "border-app-border hover:border-emerald-200"
 )}
 >
 <div className={clsx(
 "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
 (activeCategoryId === cat.id || currentParentId === cat.id) ? 'bg-emerald-600 text-app-text rotate-12' : 'bg-app-bg text-app-text-faint group-hover:bg-emerald-50 group-hover:text-emerald-500'
 )}>
 <Tag size={20} />
 </div>
 <div className="flex flex-col items-center">
 <span className={clsx(
 "text-[13px] font-black uppercase tracking-wider transition-colors line-clamp-2",
 (activeCategoryId === cat.id || currentParentId === cat.id) ? 'text-emerald-700' : 'text-app-text'
 )}>{cat.name}</span>
 {hasChildren && <span className="text-[9px] font-bold text-app-text-faint uppercase tracking-tighter">Browse Sub-items</span>}
 </div>
 </button>
 );
 })}
 </div>
 )}
 </div>
 {/* Speed Calc Floating Overlay */}
 {isClient && showNumpad && (
 <div
 style={{
 position: 'fixed',
 left: 0,
 top: 0,
 transform: `translate3d(${numpadPos?.x || 20}px, ${numpadPos?.y || 150}px, 0)`,
 cursor: isDragging ? 'grabbing' : 'default',
 willChange: 'transform'
 }}
 className={clsx(
 "z-[50] w-[280px] p-2 bg-app-text/95 backdrop-blur-md rounded-2xl border border-amber-200 shadow-2xl shadow-amber-200/40 animate-in zoom-in-95 ring-4 ring-amber-50",
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
 <button onClick={() => setShowNumpad(false)} className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-100 text-amber-600 hover:bg-amber-600 hover:text-app-text transition-all">
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
 </div>
 )}
 </div>
 </>
 )}
 </aside>

 {/* ════ VERTICAL PAYMENT COLUMN (72px) ════ */}
 <div className="w-[72px] bg-app-surface border-r border-gray-200/80 flex flex-col items-center py-4 gap-4 shrink-0 overflow-y-auto no-scrollbar shadow-[inset_-1px_0_0_0_rgba(0,0,0,0.05)]">
 <span className="text-[9px] font-black text-app-text-faint uppercase tracking-tighter mb-1">Pay</span>
 {paymentMethods.filter((m: any) => {
 const key = typeof m === 'string' ? m : m.key;
 return key !== 'DELIVERY'; // Excluded to put at bottom
 }).map((m: any) => {
 const key = typeof m === 'string' ? m : m.key;
 const label = typeof m === 'string' ? m : (m.label || m.key);

 // Icon mapping
 let Icon = Banknote;
 if (key.includes('CARD')) Icon = CreditCard;
 if (key.includes('WALLET')) Icon = Wallet;
 if (key.includes('WAVE') || key.includes('OM')) Icon = Smartphone;
 if (key.includes('MULTI')) Icon = Calculator;
 if (key.includes('BANK')) Icon = Landmark;

 const isActive = paymentMethod === key;
 const alwaysAllowed = ['MULTI', 'DELIVERY', 'CREDIT'].includes(key);
 const isLinked = alwaysAllowed || (typeof m === 'object' && m.accountId);

 return (
 <button
 key={key}
 disabled={!isLinked}
 title={!isLinked ? `⚠️ ${label}: not linked to a ledger account. Configure in POS Settings → Registers.` : label}
 onClick={() => {
 if (!isLinked) return;
 if (key.includes('MULTI')) {
 setIsMultiPayMode(true);
 setShowNumpad(false);
 } else {
 onSetPaymentMethod(key);
 setIsMultiPayMode(false);
 }
 }}
 className={clsx(
 "group flex flex-col items-center justify-center p-2 rounded-xl transition-all w-14 h-14 border-2 relative",
 !isLinked
 ? "bg-app-bg border-app-border text-gray-300 cursor-not-allowed opacity-50"
 : isActive || (isMultiPayMode && key.includes('MULTI'))
 ? "bg-emerald-50 border-emerald-500 text-emerald-600 shadow-lg shadow-emerald-50 scale-105"
 : "bg-app-surface border-transparent text-app-text-faint hover:bg-app-bg hover:text-app-text-muted"
 )}
 >
 <Icon size={20} className={clsx("transition-transform", isActive ? "scale-110" : "group-hover:scale-110")} />
 <span className="text-[8px] font-black mt-1 uppercase truncate w-full text-center tracking-tighter">{label}</span>
 {isActive && (
 <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-full" />
 )}
 {!isLinked && (
 <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-amber-400 flex items-center justify-center">
 <span className="text-[6px] text-app-text font-black">!</span>
 </div>
 )}
 </button>
 );
 })}

 {/* Bottom Actions Container */}
 <div className="mt-auto w-full flex flex-col items-center gap-4 pt-4 border-t border-app-border">
 {paymentMethods.some((m: any) => (typeof m === 'string' ? m : m.key) === 'DELIVERY') && (
 <button
 onClick={() => setIsDeliveryModalOpen(true)}
 className={clsx(
 "group flex flex-col items-center justify-center p-2 rounded-xl transition-all w-14 h-14 border-2 relative",
 paymentMethod === 'DELIVERY'
 ? "bg-emerald-50 border-emerald-500 text-emerald-600 shadow-lg shadow-emerald-50 scale-105"
 : "bg-app-surface border-transparent text-app-text-faint hover:bg-app-bg hover:text-app-text-muted"
 )}
 >
 <MapPin size={20} className={clsx("transition-transform", paymentMethod === 'DELIVERY' ? "scale-110" : "group-hover:scale-110")} />
 <span className="text-[8px] font-black mt-1 uppercase truncate w-full text-center tracking-tighter">DELIVE...</span>
 {paymentMethod === 'DELIVERY' && (
 <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-full" />
 )}
 </button>
 )}

 <button
 onClick={() => setIsHistoryOpen(true)}
 className="group flex flex-col items-center justify-center p-2 rounded-xl transition-all w-14 h-14 border-2 relative bg-app-surface border-transparent text-app-text-faint hover:bg-app-bg hover:text-app-text-muted"
 >
 <HistoryIcon size={20} className="transition-transform group-hover:scale-110" />
 <span className="text-[8px] font-black mt-1 uppercase truncate w-full text-center tracking-tighter">History</span>
 </button>

 <button
 onClick={() => setIsAccountBookOpen(true)}
 className="group flex flex-col items-center justify-center p-2 rounded-xl transition-all w-14 h-14 border-2 relative bg-app-surface border-transparent text-app-text-faint hover:bg-app-bg hover:text-app-text-muted"
 >
 <BookOpen size={20} className="transition-transform group-hover:scale-110" />
 <span className="text-[8px] font-black mt-1 uppercase truncate w-full text-center tracking-tighter">Acct Book</span>
 </button>
 </div>
 </div>

 {/* ════ RIGHT COLUMN: CART (full height) ════ */}
 <main className="flex-1 flex flex-col bg-[#fafbfc] overflow-hidden">
 {/* ════ NORMAL CART VIEW ════ */}
 <div className="flex flex-col h-full bg-[#fafbfc] overflow-hidden">
 <div className="px-3 py-1.5 border-b border-gray-200/80 bg-app-surface flex items-center justify-between shrink-0">
 <div className="flex items-center gap-1.5">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
 <h2 className="text-xs font-bold text-app-text">Order</h2>
 <span className="text-[10px] text-app-text-faint font-medium">{uniqueItems} lines · {totalPieces} pcs</span>
 </div>
 {cart.length > 0 && (
 <button onClick={() => {
 props.onSetPendingOverrideAction({ label: 'Clear entire cart', execute: () => onClearCart(true) });
 onSetOverrideOpen(true);
 }} className="text-[10px] text-app-text-faint hover:text-rose-500 font-medium transition-colors">Clear</button>
 )}
 </div>
 <div className="flex-1 overflow-y-auto custom-scrollbar">
 {cart.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
 <ShoppingCart size={36} strokeWidth={1} className="text-gray-200" />
 <p className="text-xs text-app-text-faint">No items yet</p>
 </div>
 ) : (
 <div className="divide-y divide-gray-50">
 {cart.map((item: any, idx: number) => (
 <div
 key={item.productId}
 onClick={() => { setSelectedCartIdx(idx); setNumpadMode('qty'); setShowNumpad(true); }}
 className={clsx(
 "px-2.5 py-1.5 group transition-colors duration-300 flex flex-col gap-1.5 cursor-pointer",
 selectedCartIdx === idx && highlightedItemId === item.productId
 ? "bg-teal-100 ring-1 ring-teal-300"
 : selectedCartIdx === idx
 ? "bg-amber-50 ring-1 ring-amber-200"
 : highlightedItemId === item.productId
 ? "bg-emerald-100 ring-1 ring-emerald-200"
 : "hover:bg-app-surface"
 )}
 >
 <div className="flex items-center gap-1.5 w-full">
 {item.imageUrl ? (
 <img
 src={item.imageUrl}
 alt={item.name}
 className="w-9 h-9 rounded-lg object-cover shrink-0 border border-app-border"
 onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
 />
 ) : (() => {
 const CART_COLORS = [
 'bg-rose-50 text-rose-600 border-rose-100',
 'bg-amber-50 text-amber-600 border-amber-100',
 'bg-emerald-50 text-emerald-600 border-emerald-100',
 'bg-cyan-50 text-cyan-600 border-cyan-100',
 'bg-blue-50 text-blue-600 border-blue-100',
 'bg-indigo-50 text-indigo-600 border-indigo-100',
 'bg-violet-50 text-violet-600 border-violet-100',
 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100',
 'bg-pink-50 text-pink-600 border-pink-100',
 'bg-teal-50 text-teal-600 border-teal-100',
 'bg-lime-50 text-lime-600 border-lime-100',
 'bg-orange-50 text-orange-600 border-orange-100',
 ];
 return (
 <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 border ${CART_COLORS[item.productId % CART_COLORS.length]}`}>
 {item.name?.substring(0, 2).toUpperCase()}
 </div>
 );
 })()}
 <div className="flex-1 min-w-0">
 <p className="text-[14px] font-black text-app-text truncate leading-tight group-hover:text-emerald-600">{item.name}</p>
 <div className="flex items-center gap-2 mt-0.5">
 {item.barcode && <span className="text-[10px] font-bold text-app-text-faint uppercase tracking-tighter">#{item.barcode}</span>}
 <span className="bg-emerald-50 text-emerald-700 px-1 rounded text-[10px] font-black">Stock: {item.stock || 0}</span>
 </div>
 </div>
 <span
 onClick={(e) => { e.stopPropagation(); setSelectedCartIdx(idx); setNumpadMode('price'); setShowNumpad(true); }}
 className="text-[12px] font-black text-app-text-faint shrink-0 hover:text-emerald-600 transition-colors"
 >
 {currency}{Number(item.price).toFixed(2)}
 </span>
 <div className="flex items-center gap-px shrink-0">
 <button
 onClick={(e) => { e.stopPropagation(); handleProtectedQuantity(item.productId, -1); }}
 className="w-6 h-6 rounded-lg bg-app-surface-2 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center text-app-text-faint transition-all border border-transparent"
 >
 <Minus size={12} />
 </button>
 <span
 onClick={(e) => { e.stopPropagation(); setSelectedCartIdx(idx); setNumpadMode('qty'); setShowNumpad(true); }}
 className="w-7 text-center text-[13px] font-black tabular-nums text-app-text hover:text-emerald-600 transition-colors"
 >
 {item.quantity}
 </span>
 <button
 onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item.productId, 1); }}
 className="w-6 h-6 rounded-lg bg-emerald-50 hover:bg-emerald-500 hover:text-app-text text-emerald-600 flex items-center justify-center transition-all border border-emerald-100"
 >
 <Plus size={12} />
 </button>
 </div>
 <p className="text-[13px] font-black text-emerald-700 tabular-nums shrink-0 w-16 text-right">
 {currency}{(Number(item.price) * item.quantity).toFixed(2)}
 </p>
 <button
 onClick={(e) => { e.stopPropagation(); handleProtectedQuantity(item.productId, -item.quantity); }}
 className="ml-2 w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-app-text transition-all shrink-0 flex items-center justify-center border border-rose-100"
 title="Delete product from cart"
 >
 <Trash2 size={14} />
 </button>
 </div>

 {/* Line Note Input (shown when selected or note already exists) */}
 {(selectedCartIdx === idx || item.note) && (
 <div className="pl-[2.75rem] pr-10 w-full" onClick={(e) => e.stopPropagation()}>
 <input
 type="text"
 placeholder="Add note (gift, customization)..."
 defaultValue={item.note || ''}
 className="w-full text-[11px] bg-app-surface border border-app-border rounded px-2 py-1 outline-none text-app-text placeholder:text-gray-300 focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 transition-all font-medium shadow-sm"
 onBlur={(e) => { (props as any).onUpdateLineNote?.(item.productId, e.target.value); }}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 (props as any).onUpdateLineNote?.(item.productId, (e.target as HTMLInputElement).value);
 }
 }}
 />
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 <div className="border-t-2 border-emerald-500/20 bg-gradient-to-b from-white to-gray-50/80 px-3 py-3 shrink-0 space-y-2.5">
 {/* ── Summary Row ── */}
 <div className="grid grid-cols-3 gap-2">
 <div className="bg-app-bg rounded-xl p-2 text-center">
 <span className="text-[8px] font-black text-app-text-faint uppercase tracking-widest block">Subtotal</span>
 <span className="text-sm font-black text-app-text tabular-nums">{currency}{formatNumber(total)}</span>
 </div>
 <div
 onClick={() => { setNumpadMode('disc'); setShowNumpad(true); }}
 className="bg-amber-50/60 rounded-xl p-2 text-center cursor-pointer hover:bg-amber-50 transition-colors group"
 >
 <div className="flex items-center justify-center gap-1">
 <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Discount</span>
 <div className="flex items-center bg-app-text/80 rounded px-1 py-px">
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
 <span className="text-lg font-black text-app-text tabular-nums leading-tight">{currency}{formatNumber(totalAmount)}</span>
 </div>
 </div>

 {/* ── Received + Charge ── */}
 <div className="flex items-stretch gap-2">
 <div className="flex-1 relative">
 <span className="absolute left-2.5 top-1.5 text-[7px] font-black text-app-text-faint uppercase tracking-widest">Received</span>
 <div className="flex items-stretch">
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
 className="w-full pt-5 pb-2 px-2.5 text-right bg-app-surface border-2 border-app-border rounded-l-xl text-base font-black outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all font-mono tabular-nums"
 />
 <button
 onClick={() => onSetCashReceived(String(totalAmount))}
 className="px-2.5 pt-5 pb-2 bg-indigo-50 border-2 border-l-0 border-indigo-200 rounded-r-xl text-[10px] font-black text-indigo-600 hover:bg-indigo-100 transition-all whitespace-nowrap flex items-center gap-0.5 tabular-nums"
 title="Auto-fill with bill total"
 >
 <span className="text-indigo-300">|</span> {currency}{formatNumber(totalAmount)}
 </button>
 </div>
 </div>
 <button
 onClick={onCharge}
 disabled={cart.length === 0 || isProcessing}
 className={clsx(
 "flex-1 rounded-xl flex flex-col items-center justify-center transition-all relative overflow-hidden",
 cart.length > 0 && !isProcessing
 ? deficit > 0
 ? "bg-gradient-to-br from-rose-500 to-red-600 text-app-text shadow-xl shadow-rose-200/50 hover:shadow-2xl hover:shadow-rose-300/60 hover:scale-[1.02] active:scale-[0.98]"
 : changeDue > 0
 ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-app-text shadow-xl shadow-blue-200/50 hover:shadow-2xl hover:shadow-blue-300/60 hover:scale-[1.02] active:scale-[0.98]"
 : "bg-gradient-to-br from-emerald-500 to-teal-600 text-app-text shadow-xl shadow-emerald-200/50 hover:shadow-2xl hover:shadow-emerald-300/60 hover:scale-[1.02] active:scale-[0.98]"
 : "bg-gray-200 text-app-text-faint"
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
 ? "bg-blue-500 border-blue-500 text-app-text shadow-md shadow-blue-100"
 : "bg-app-surface border-app-border text-app-text-muted hover:border-blue-300 hover:bg-blue-50"
 )}
 >
 <Wallet size={14} />
 {storeChangeInWallet ? '✓ Add to Wallet' : 'Add to Wallet'}
 </button>
 </div>
 )}
 </div>
 </div>
 </main>
 </div>



 <ReceiptModal
 isOpen={isReceiptOpen}
 onClose={() => onSetReceiptOpen(false)}
 orderId={lastOrder?.id || null}
 refCode={lastOrder?.ref || null}
 />
 <AccountBook
 isOpen={isAccountBookOpen}
 onClose={() => setIsAccountBookOpen(false)}
 sessionId={registerConfig?.sessionId || null}
 cashierId={registerConfig?.cashierId || null}
 currency={currency}
 isManager={registerConfig?.isManager || false}
 />
 <POSSalesHistoryPanel
 isOpen={isHistoryOpen}
 onClose={() => setIsHistoryOpen(false)}
 currency={currency}
 registerName={registerConfig?.registerName}
 sessionId={registerConfig?.sessionId}
 />
 <POSDeliveryModal
 isOpen={isDeliveryModalOpen}
 onClose={() => setIsDeliveryModalOpen(false)}
 orderTotal={totalAmount}
 currency={currency}
 selectedClient={selectedClient}
 sessionId={registerConfig?.sessionId}
 hasClientCredit={!!(selectedClient as any)?.credit_limit}
 preSelectedZoneName={deliveryZone || null}
 onConfirm={async (deliveryData) => {
 onSetPaymentMethod('DELIVERY');
 if (onSetNotes) {
 onSetNotes(`DELIVERY|${deliveryData.recipient_name}|${deliveryData.phone}|${deliveryData.address_line1}|${deliveryData.payment_mode}|zone:${deliveryData.zone ?? 'none'}`);
 }
 if ((props as any).onSetDeliveryData) {
 (props as any).onSetDeliveryData(deliveryData);
 }
 if (deliveryData.payment_mode === 'IMMEDIATE') {
 await new Promise(r => setTimeout(r, 200));
 onCharge();
 }
 }}
 />
 {
 isPendingDeliveriesOpen && registerConfig?.sessionId && (
 <POSPendingDeliveriesPanel
 sessionId={registerConfig.sessionId}
 currency={currency}
 onClose={() => setIsPendingDeliveriesOpen(false)}
 />
 )
 }
 </div >
 );
}
