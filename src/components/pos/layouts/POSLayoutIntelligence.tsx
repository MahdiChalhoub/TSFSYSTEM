'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { POSLayoutProps } from '@/types/pos-layout';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { AddressBook } from '@/components/pos/AddressBook';
import { POSToolbar } from '@/components/pos/POSToolbar';
import {
    RefreshCw, ShieldCheck, UserPlus, Coins, AlertCircle, Lock,
    History as HistoryIcon, Wifi, WifiOff, Smartphone, Landmark,
    ShoppingCart, X, Plus, Minimize, Maximize, Layout, Search, MapPin,
    ChevronDown, Calculator, ArrowLeft, EyeOff, Eye, Package, Tag,
    GripHorizontal, Minus, Trash2, CreditCard, Wallet, Banknote, Star, BookOpen,
    Phone, User, Building2, DollarSign, Globe, Edit3
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Numpad as POSNumpad, NumpadMode } from '@/components/pos/Numpad';
import { MultiPaymentDashboard } from '@/components/pos/MultiPaymentHub';
import { POSSalesHistoryPanel } from '@/components/pos/POSSalesHistoryPanel';
import { POSDeliveryModal } from '@/components/pos/POSDeliveryModal';
import { POSPendingDeliveriesPanel } from '@/components/pos/POSPendingDeliveriesPanel';
import { CompactClientHeader } from '@/components/pos/CompactClientHeader';
import { getContactSummary } from '@/app/actions/crm/contacts';
import { ClientVaultModal } from '@/components/pos/modals/ClientVaultModal';

const formatNumber = (num: number | string) => {
    const val = Number(num) || 0;
    // Manual formatting for hydration stability across SSR/CSR
    const parts = val.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return parts[1] === '00' ? parts[0] : parts.join('.');
};

const DEFAULT_PAYMENT_METHODS = ['CASH', 'CARD', 'WALLET', 'WAVE', 'OM', 'MULTI', 'DELIVERY'];

export function POSLayoutIntelligence(props: POSLayoutProps) {
    const {
        cart, clients, sessions, activeSessionId, isSuperAdmin, categories, searchQuery,
        selectedCategory, isCartVisible, isReceiptOpen, showCloseRegister, showReturn,
        showCreditWarning, isOverrideOpen, pendingOverrideAction, isVaultOpen,
        isOnline, lastOrder, totalPieces, uniqueItems, clientFidelity, fidelityLoading,
        subtotal, tax, total, activeCategoryId, currentParentId, sidebarMode, isFullscreen,
        currency, clientSearchQuery, productIndex, allowNegativeStockRef, loyaltyPointValue,
        storeChangeInWallet, pointsRedeemed, selectedClientId, selectedClient, totalAmount,
        discountAmount, discount, discountType, paymentMethod, cashReceived, notes, paymentLegs,
        isProcessing, registerConfig, deliveryZone, deliveryZones, highlightedItemId,

        // Handlers
        onSetSearchQuery, onSetActiveCategoryId, onSetCurrentParentId, onSetActiveSessionId,
        onSetPaymentMethod, onSetCashReceived, onSetDiscount, onSetDiscountType, onAddToCart,
        onUpdateQuantity, onUpdatePrice, onUpdateLineDiscount, onUpdateLineNote,
        onClearCart, onCreateNewSession, onRemoveSession, onUpdateActiveSession,
        onToggleFullscreen, onCycleSidebarMode, onCharge, onSync, onSetIsOnline,
        onSetClientSearchQuery, onSearchClients, onSetDeliveryZone, onSetNotes,
        onSetOverrideOpen, onSetPendingOverrideAction,
        onSetReceiptOpen, onOpenLayoutSelector, onSetStoreChangeInWallet,
        onSetPointsRedeemed, onCloseRegister, onOpenReturn, onSetIsVaultOpen,
        onLockRegister, onOpenRegister, currentLayout
    } = props;

    const paymentMethods = registerConfig?.paymentMethods || (props as any).paymentMethods || DEFAULT_PAYMENT_METHODS;
    const receivedNum = Number(cashReceived?.toString() || '0');
    const changeDue = receivedNum > totalAmount ? receivedNum - totalAmount : 0;
    const deficit = receivedNum > 0 && receivedNum < totalAmount ? totalAmount - receivedNum : 0;
    const [leftExpanded, setLeftExpanded] = useState(false);
    const [showNumpad, setShowNumpad] = useState(false);
    const [numpadMode, setNumpadMode] = useState<NumpadMode>('qty');
    const [selectedCartIdx, setSelectedCartIdx] = useState<number | null>(null);
    // ── Multi-Payment State ──
    const [isMultiPayMode, setIsMultiPayMode] = useState(false);
    const [isAddressBookOpen, setIsAddressBookOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
    const [isPendingDeliveriesOpen, setIsPendingDeliveriesOpen] = useState(false);
    const [showClientPanel, setShowClientPanel] = useState(false);
    const clientPanelRef = useRef<HTMLDivElement>(null);

    // ── Loyalty Vault State ──
    const [fidelityData, setFidelityData] = useState<any>(null);
    const [vaultLoading, setVaultLoading] = useState(false);

    const handleOpenVault = async () => {
        if (!selectedClient) return;
        onSetIsVaultOpen(true);
        setVaultLoading(true);
        try {
            const result = await getContactSummary(selectedClient.id);
            setFidelityData(result);
        } catch (e) {
            toast.error("Failed to sync fidelity metrics");
        } finally {
            setVaultLoading(false);
        }
    };

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

    const handleProtectedQuantity = useCallback((productId: number, delta: number) => {
        const item = cart.find(i => i.productId === productId);
        // ALL decreases require manager override (decrease qty, remove item)
        if (delta < 0) {
            const actionLabel = (item?.quantity || 0) + delta <= 0
                ? `Delete "${item?.name || 'Item'}" from cart`
                : `Decrease "${item?.name || 'Item'}" qty by ${Math.abs(delta)}`;
            onSetPendingOverrideAction({
                label: actionLabel,
                execute: () => onUpdateQuantity(productId, delta)
            });
            onSetOverrideOpen(true);
        } else {
            onUpdateQuantity(productId, delta);
        }
    }, [cart, onUpdateQuantity, onSetOverrideOpen, onSetPendingOverrideAction]);

    const handleProtectedDiscount = useCallback((val: number) => {
        onSetPendingOverrideAction({
            label: `Apply ${val}% Discount`,
            execute: () => onSetDiscount(val)
        });
        onSetOverrideOpen(true);
    }, [onSetDiscount, onSetOverrideOpen, onSetPendingOverrideAction]);

    const handleProtectedPrice = useCallback((productId: number, newPrice: number) => {
        const item = cart.find(i => i.productId === productId);
        const currentPrice = Number(item?.price || 0);
        if (newPrice < currentPrice) {
            onSetPendingOverrideAction({
                label: `Decrease Price to ${currency}${newPrice.toFixed(2)}`,
                execute: () => onUpdatePrice(productId, newPrice)
            });
            onSetOverrideOpen(true);
        } else {
            onUpdatePrice(productId, newPrice);
        }
    }, [cart, currency, onUpdatePrice, onSetOverrideOpen, onSetPendingOverrideAction]);

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

    return (
        <div className={clsx(
            "flex flex-col overflow-hidden select-none h-full font-sans transition-colors duration-700 bg-[#020617] text-slate-200",
            isFullscreen ? "fixed inset-0 z-[1000] h-screen w-screen" : "absolute inset-0"
        )}>
            {/* ═══════════ SHARED TOOLBAR ═══════════ */}
            <POSToolbar
                sessions={sessions}
                activeSessionId={activeSessionId || ''}
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
                onCloseRegister={onCloseRegister}
                onOpenReturn={onOpenReturn}
                onOpenAddressBook={() => setIsAddressBookOpen(true)}
                onOpenPendingDeliveries={() => setIsPendingDeliveriesOpen(true)}
            />

            <div className="flex-1 flex overflow-hidden relative">
                {isMultiPayMode && (
                    <div className="absolute top-0 right-0 w-[42%] h-full bg-slate-950/40 backdrop-blur-[8px] z-[100] flex flex-col items-center justify-center p-8 text-center pointer-events-auto">
                        <div className="bg-slate-900/90 p-8 rounded-[2rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/5 flex flex-col items-center gap-6 animate-in zoom-in-95 duration-500 backdrop-blur-2xl">
                            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-2xl shadow-amber-500/10">
                                <Lock size={40} className="stroke-[2.5]" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-white uppercase tracking-widest">Cart Locked</h3>
                                <p className="text-[11px] text-slate-500 max-w-[240px] uppercase font-bold tracking-tighter leading-relaxed">Safety Protocol Active. Exit payment orchestration to modify items.</p>
                            </div>
                            <button
                                onClick={() => setIsMultiPayMode(false)}
                                className="px-10 py-3.5 bg-white text-slate-950 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-emerald-400 transition-all active:scale-95 shadow-xl shadow-white/5"
                            >
                                Release Lock
                            </button>
                        </div>
                    </div>
                )}

                <aside className="w-[58%] flex flex-col bg-[#0F172A] border-r border-white/5 shrink-0 overflow-hidden relative shadow-[40px_0_80px_rgba(0,0,0,0.4)] z-20">
                    {/* Ambient Glow */}
                    <div className="absolute top-0 left-0 w-full h-[300px] bg-emerald-500/5 blur-[120px] pointer-events-none" />
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
                                if (legs.length > 0) onSetPaymentMethod(legs[0].method);
                                setIsMultiPayMode(false);
                                setTimeout(() => onCharge(), 300);
                            }}
                        />
                    ) : (
                        <>
                            <CompactClientHeader
                                client={selectedClient}
                                currency={currency}
                                uniqueItems={uniqueItems}
                                totalPieces={totalPieces}
                                onOpenVault={handleOpenVault}
                            />

                            <div className="px-10 py-6 border-b border-white/5 bg-slate-950/40 backdrop-blur-2xl sticky top-0 z-[20] space-y-6 shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="relative flex-1 group">
                                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-500 transition-colors" size={18} />
                                        <input
                                            id="pos-product-search"
                                            type="text"
                                            placeholder="SCAN BARCODE OR QUERY MATRIX..."
                                            className="w-full pl-14 pr-14 py-4.5 bg-slate-900 border border-white/5 rounded-2xl text-[14px] outline-none focus:bg-[#020617] focus:border-emerald-500/50 focus:ring-8 focus:ring-emerald-500/5 transition-all font-black text-white placeholder:text-slate-700 placeholder:uppercase placeholder:tracking-[0.2em]"
                                            value={searchQuery}
                                            onChange={(e) => onSetSearchQuery(e.target.value)}
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => onSetSearchQuery('')}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setShowNumpad(!showNumpad)}
                                        title={showNumpad ? "Deactivate Neural Numpad" : "Initialize Speed Calc"}
                                        className={clsx(
                                            "w-14 h-14 rounded-2xl border-2 transition-all shrink-0 active:scale-95 flex items-center justify-center shadow-2xl",
                                            showNumpad
                                                ? "bg-amber-gradient border-amber-400 text-white shadow-amber-500/20 rotate-6"
                                                : "bg-slate-900 border-white/5 text-slate-500 hover:border-amber-500/30 hover:text-amber-500"
                                        )}
                                    >
                                        <Calculator size={26} className={showNumpad ? "fill-white/20" : ""} />
                                    </button>
                                </div>

                                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 items-center">
                                    {currentParentId === null ? (
                                        <>
                                            <button
                                                onClick={() => {
                                                    onSetActiveCategoryId(null);
                                                    onSetCurrentParentId(null);
                                                    setLeftExpanded(true);
                                                }}
                                                className={clsx(
                                                    "px-6 py-3 whitespace-nowrap rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 shrink-0 h-11 flex items-center",
                                                    (activeCategoryId === null && currentParentId === null)
                                                        ? 'bg-white border-white text-slate-950 shadow-2xl shadow-white/10 scale-105'
                                                        : 'bg-slate-900/50 border-white/5 text-slate-500 hover:border-emerald-500/30 hover:text-emerald-400'
                                                )}
                                            >Master Matrix</button>
                                            <div className="w-px h-6 bg-white/5 shrink-0" />
                                            {categories.filter((c: any) => !((c as any).parent || (c as any).parentId || (c as any).parent_id)).map(cat => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => {
                                                        onSetActiveCategoryId(cat.id);
                                                        onSetCurrentParentId(cat.id);
                                                        setLeftExpanded(true);
                                                    }}
                                                    className={clsx(
                                                        "px-6 py-3 whitespace-nowrap rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 shrink-0 h-11 flex items-center",
                                                        (activeCategoryId === cat.id || currentParentId === cat.id)
                                                            ? 'bg-emerald-gradient border-emerald-400 text-white shadow-2xl shadow-emerald-500/20 scale-105'
                                                            : 'bg-slate-900/50 border-white/5 text-slate-500 hover:border-emerald-500/30 hover:text-emerald-400'
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
                                                className="h-11 px-6 bg-slate-900 border-2 border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shrink-0 flex items-center gap-3 shadow-2xl"
                                            >
                                                <ArrowLeft size={16} className="text-emerald-500 stroke-[3]" />
                                                {currentParentName}
                                            </button>
                                            <div className="w-px h-6 bg-white/10 mx-2 shrink-0" />
                                            {categories.filter((c: any) => ((c as any).parent || (c as any).parentId || (c as any).parent_id) === currentParentId).map(cat => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => {
                                                        onSetActiveCategoryId(cat.id);
                                                        setLeftExpanded(true);
                                                    }}
                                                    className={clsx(
                                                        "px-6 py-3 whitespace-nowrap rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 shrink-0 h-11 flex items-center",
                                                        activeCategoryId === cat.id
                                                            ? 'bg-emerald-gradient border-emerald-400 text-white shadow-2xl shadow-emerald-500/20 scale-105'
                                                            : 'bg-slate-900/50 border-white/5 text-slate-500 hover:border-emerald-500/30 hover:text-emerald-400'
                                                    )}
                                                >{cat.name}</button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="px-8 py-3 bg-[#020617] border-b border-white/5 flex items-center justify-between shrink-0">
                                <span className="text-[10px] font-black text-slate-600 flex items-center gap-3 uppercase tracking-[0.3em]">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                    Active Stream: <span className="text-slate-400 italic font-black">{leftExpanded ? 'Matrix View' : 'Index View'}</span>
                                </span>
                                <button
                                    onClick={() => setLeftExpanded(!leftExpanded)}
                                    className="text-[10px] font-black text-emerald-400 hover:text-white bg-emerald-500/5 hover:bg-emerald-500 border border-emerald-500/20 px-4 py-1.5 rounded-full flex items-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                                >
                                    {leftExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
                                    <span className="uppercase tracking-widest">Toggle Cluster</span>
                                </button>
                            </div>

                            <div className="flex-1 relative overflow-hidden bg-[#020617]">
                                <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-5">
                                    {leftExpanded ? (
                                        <ProductGrid
                                            searchQuery={searchQuery}
                                            categoryId={activeCategoryId || currentParentId}
                                            onAddToCart={onAddToCart}
                                            currency={currency}
                                            onProductsLoaded={(props as any).onProductsLoaded}
                                            onAutoAdd={(product) => {
                                                onAddToCart(product);
                                                setTimeout(() => onSetSearchQuery(''), 300);
                                            }}
                                            onNotFound={(q) => {
                                                toast.error(`"${q}" not found`, {
                                                    description: 'Zero matches in current availability matrix.',
                                                    duration: 3000,
                                                });
                                                setTimeout(() => onSetSearchQuery(''), 1500);
                                            }}
                                        />
                                    ) : (
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                                            {currentParentId !== null ? (
                                                <button
                                                    onClick={() => {
                                                        const parent = categories.find(c => c.id === currentParentId);
                                                        const grandParentId = (parent as any)?.parent || (parent as any)?.parentId || (parent as any)?.parent_id || null;
                                                        onSetCurrentParentId(grandParentId);
                                                        onSetActiveCategoryId(grandParentId);
                                                    }}
                                                    className="p-10 rounded-3xl bg-slate-900 border border-white/5 text-slate-500 text-center hover:bg-slate-800 transition-all flex flex-col items-center justify-center font-black uppercase text-[12px] tracking-[0.2em] gap-4 shadow-2xl group"
                                                >
                                                    <ArrowLeft size={32} className="group-hover:-translate-x-2 transition-transform" />
                                                    Navigation: Back
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => { onSetActiveCategoryId(null); setLeftExpanded(true); }}
                                                    className="p-8 rounded-3xl bg-emerald-gradient text-white text-center group hover:shadow-[0_0_50px_rgba(16,185,129,0.3)] transition-all border-none relative overflow-hidden"
                                                >
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[40px] -rotate-45" />
                                                    <Package size={32} className="mx-auto mb-3 relative z-10 group-hover:scale-110 transition-transform" />
                                                    <span className="text-[14px] font-black uppercase tracking-[0.1em] relative z-10">Matrix All</span>
                                                </button>
                                            )}
                                            {filteredCategories.map(cat => {
                                                const hasChildren = categories.some((c: any) => ((c as any).parent || (c as any).parentId || (c as any).parent_id) === cat.id);
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
                                                            "p-10 rounded-3xl border text-center group hover:shadow-2xl transition-all relative flex flex-col items-center justify-center gap-4 border-white/5",
                                                            (activeCategoryId === cat.id || currentParentId === cat.id)
                                                                ? "bg-slate-900 border-emerald-500/50 ring-1 ring-emerald-500/20"
                                                                : "bg-slate-900/40 hover:bg-slate-900 hover:border-emerald-500/30"
                                                        )}
                                                    >
                                                        <div className={clsx(
                                                            "w-16 h-16 rounded-[1.8rem] flex items-center justify-center transition-all duration-700 shadow-inner",
                                                            (activeCategoryId === cat.id || currentParentId === cat.id)
                                                                ? 'bg-emerald-gradient text-white rotate-6 scale-110 shadow-emerald-500/20'
                                                                : 'bg-slate-950 text-slate-600 group-hover:bg-slate-800 group-hover:text-emerald-400 group-hover:rotate-3'
                                                        )}>
                                                            <Tag size={28} className="stroke-[2.5]" />
                                                        </div>
                                                        <div className="flex flex-col items-center">
                                                            <span className={clsx(
                                                                "text-[14px] font-black uppercase tracking-tight transition-colors line-clamp-1 italic",
                                                                (activeCategoryId === cat.id || currentParentId === cat.id) ? 'text-emerald-400' : 'text-slate-300'
                                                            )}>{cat.name}</span>
                                                            {hasChildren && <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-1 opacity-60">Sub-Clusters Available</span>}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
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
                                            "z-[100] w-[300px] p-3 bg-slate-900/90 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.6)] animate-in zoom-in-95 ring-1 ring-white/10",
                                            !isDragging && "transition-transform duration-200 ease-out"
                                        )}
                                    >
                                        <div
                                            onMouseDown={startDragging}
                                            className="flex items-center justify-between px-3 mb-3 cursor-grab active:cursor-grabbing hover:bg-white/5 rounded-2xl p-2 transition-colors group/handle border border-transparent hover:border-white/5"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] italic">
                                                    {isMultiPayMode ? 'Payment DNA' : selectedCartIdx !== null ? `Node Edit: #${selectedCartIdx + 1}` : 'Neural Calc v1'}
                                                </span>
                                            </div>
                                            <button onClick={() => setShowNumpad(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white transition-all shadow-inner border border-white/5">
                                                <X size={14} />
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
                                                    toast.error("Cart cluster empty.");
                                                }
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </aside>

                {/* ═══ VERTICAL NAVIGATION BAR ═══ */}
                <div className="w-[100px] bg-slate-950 border-r border-white/5 flex flex-col items-center py-8 gap-6 shrink-0 overflow-y-auto no-scrollbar shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.05)] z-10">
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em] mb-4 rotate-90 origin-center whitespace-nowrap opacity-40">System Control</span>

                    {paymentMethods.filter((m: any) => {
                        const key = typeof m === 'string' ? m : m.key;
                        return key !== 'DELIVERY';
                    }).map((m: any) => {
                        const key = typeof m === 'string' ? m : m.key;
                        const label = typeof m === 'string' ? m : (m.label || m.key);

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
                                title={!isLinked ? `⚠️ ${label}: Disconnected Node` : label}
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
                                    "group flex flex-col items-center justify-center p-3 rounded-2xl transition-all w-20 h-20 border-2 relative shrink-0",
                                    !isLinked
                                        ? "bg-slate-900/50 border-transparent text-slate-800 cursor-not-allowed opacity-30 shadow-inner"
                                        : isActive || (isMultiPayMode && key.includes('MULTI'))
                                            ? "bg-emerald-gradient border-emerald-400 text-white shadow-[0_0_40px_rgba(16,185,129,0.3)] scale-110 z-10"
                                            : "bg-slate-900 border-white/5 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400 hover:shadow-2xl hover:bg-slate-800"
                                )}
                            >
                                <Icon size={28} className={clsx("transition-transform stroke-[2.5]", isActive ? "scale-110" : "group-hover:scale-110")} />
                                <span className="text-[10px] font-black mt-2 uppercase truncate w-full text-center tracking-tighter leading-none italic">{label}</span>
                                {isActive && (
                                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-10 bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.8)]" />
                                )}
                                {!isLinked && (
                                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center border-2 border-slate-950">
                                        <AlertCircle size={10} className="text-white" />
                                    </div>
                                )}
                            </button>
                        );
                    })}

                    <div className="mt-auto w-full flex flex-col items-center gap-6 pt-8 border-t border-white/5">
                        {paymentMethods.some((m: any) => (typeof m === 'string' ? m : m.key) === 'DELIVERY') && (
                            <button
                                onClick={() => setIsDeliveryModalOpen(true)}
                                className={clsx(
                                    "group flex flex-col items-center justify-center p-3 rounded-2xl transition-all w-20 h-20 border-2 relative shrink-0",
                                    paymentMethod === 'DELIVERY'
                                        ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_40px_rgba(59,130,246,0.3)] scale-110"
                                        : "bg-slate-900 border-white/5 text-slate-500 hover:border-blue-500/50 hover:text-blue-400 hover:bg-slate-800"
                                )}
                            >
                                <MapPin size={28} className={clsx("transition-transform stroke-[2.5]", paymentMethod === 'DELIVERY' ? "scale-110" : "group-hover:scale-110")} />
                                <span className="text-[10px] font-black mt-2 uppercase truncate w-full text-center tracking-tighter leading-none italic">Logistics</span>
                            </button>
                        )}

                        <button
                            onClick={() => setIsHistoryOpen(true)}
                            className="group flex flex-col items-center justify-center p-3 rounded-2xl transition-all w-20 h-20 border-2 bg-slate-900 border-white/5 text-slate-500 hover:border-indigo-500/50 hover:text-indigo-400 hover:bg-slate-800 hover:shadow-2xl"
                        >
                            <HistoryIcon size={28} className="transition-transform group-hover:scale-110 stroke-[2.5]" />
                            <span className="text-[10px] font-black mt-2 uppercase truncate w-full text-center tracking-tighter leading-none italic">History</span>
                        </button>

                        <button
                            onClick={() => {
                                const el = document.getElementById('pos-product-search') as HTMLInputElement | null;
                                el?.focus();
                                el?.select();
                            }}
                            className="group flex flex-col items-center justify-center p-3 rounded-2xl transition-all w-20 h-20 border-2 bg-slate-900 border-white/5 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-slate-800"
                        >
                            <BookOpen size={28} className="transition-transform group-hover:scale-110 stroke-[2.5]" />
                            <span className="text-[10px] font-black mt-2 uppercase truncate w-full text-center tracking-tighter leading-none italic">Glossary</span>
                        </button>
                    </div>
                </div>

                {/* ═══ MAIN CART AREA ═══ */}
                <main className="flex-1 flex flex-col bg-[#020617] overflow-hidden relative shadow-2xl">
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/5 blur-[150px] pointer-events-none" />

                    <div className="flex flex-col h-full overflow-hidden relative z-10">
                        <div className="px-6 py-4 border-b border-white/5 bg-slate-950/40 backdrop-blur-xl flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Active Shipment</h2>
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{uniqueItems} Lines · {totalPieces} Pcs</span>
                            </div>
                            {cart.length > 0 && (
                                <button onClick={() => {
                                    onSetPendingOverrideAction({ label: 'Purge entire shipment cluster', execute: () => onClearCart() });
                                    onSetOverrideOpen(true);
                                }} className="text-[10px] text-rose-500/70 hover:text-rose-500 font-black uppercase tracking-widest transition-colors hover:bg-rose-500/5 px-4 py-1.5 rounded-full border border-rose-500/20">Purge</button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar-dark px-2 py-2">
                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-800 gap-6 opacity-40">
                                    <div className="w-24 h-24 rounded-[2.5rem] bg-slate-900 flex items-center justify-center border-2 border-dashed border-white/10">
                                        <ShoppingCart size={48} strokeWidth={1} />
                                    </div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.4em] text-center">Awaiting data input...</p>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {cart.map((item, idx) => (
                                        <div
                                            key={item.productId}
                                            onClick={() => { setSelectedCartIdx(idx); setNumpadMode('qty'); setShowNumpad(true); }}
                                            className={clsx(
                                                "px-5 py-4 group transition-all duration-500 flex flex-col gap-3 cursor-pointer rounded-2xl relative overflow-hidden backdrop-blur-sm",
                                                selectedCartIdx === idx && highlightedItemId === item.productId
                                                    ? "bg-emerald-500/20 ring-2 ring-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                                                    : selectedCartIdx === idx
                                                        ? "bg-amber-500/10 ring-2 ring-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.1)]"
                                                        : highlightedItemId === item.productId
                                                            ? "bg-emerald-500/10 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.1)]"
                                                            : "bg-slate-900/40 border border-white/5 hover:bg-slate-900 hover:border-white/10"
                                            )}
                                        >
                                            <div className="flex items-center gap-4 w-full relative z-10">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[15px] font-black text-white truncate leading-tight group-hover:text-emerald-400 italic transition-colors">{item.name}</p>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <span className="bg-emerald-500/10 text-emerald-500 px-2.5 py-0.5 rounded-lg text-[10px] font-black border border-emerald-500/20 uppercase tracking-tighter italic">Stock: {item.stock || 0}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span
                                                        onClick={(e) => { e.stopPropagation(); setSelectedCartIdx(idx); setNumpadMode('price'); setShowNumpad(true); }}
                                                        className="text-[13px] font-black text-slate-500 shrink-0 hover:text-emerald-400 transition-colors uppercase tracking-tight tabular-nums"
                                                    >
                                                        {currency}{Number(item.price).toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0 bg-slate-950/80 p-1 rounded-xl border border-white/5">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleProtectedQuantity(item.productId, -1); }}
                                                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-rose-600 hover:text-white flex items-center justify-center text-slate-500 transition-all border border-white/5 active:scale-90"
                                                    >
                                                        <Minus size={14} className="stroke-[3]" />
                                                    </button>
                                                    <span
                                                        onClick={(e) => { e.stopPropagation(); setSelectedCartIdx(idx); setNumpadMode('qty'); setShowNumpad(true); }}
                                                        className="w-10 text-center text-[15px] font-black tabular-nums text-white hover:text-amber-400 transition-colors"
                                                    >
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item.productId, 1); }}
                                                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-emerald-500 hover:text-white text-emerald-500 flex items-center justify-center transition-all border border-white/5 active:scale-90"
                                                    >
                                                        <Plus size={14} className="stroke-[3]" />
                                                    </button>
                                                </div>
                                                <p className="text-[16px] font-black text-emerald-400 tabular-nums shrink-0 w-24 text-right italic">
                                                    {currency}{(Number(item.price) * item.quantity).toFixed(2)}
                                                </p>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleProtectedQuantity(item.productId, -item.quantity); }}
                                                    className="ml-3 w-10 h-10 rounded-xl bg-slate-900 border border-white/5 text-rose-500 hover:bg-rose-600 hover:text-white transition-all shrink-0 flex items-center justify-center shadow-inner"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            {(selectedCartIdx === idx || item.note) && (
                                                <div className="pl-1 w-full" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center gap-3 bg-black/40 border border-white/5 px-4 py-2 rounded-xl backdrop-blur-md">
                                                        <Edit3 size={12} className="text-slate-600" />
                                                        <input
                                                            type="text"
                                                            placeholder="ATTACH OPERATIONAL NOTE..."
                                                            defaultValue={item.note || ''}
                                                            className="flex-1 text-[11px] bg-transparent outline-none text-slate-300 focus:text-white transition-all font-black uppercase tracking-widest placeholder:text-slate-800"
                                                            onBlur={(e) => { onUpdateLineNote?.(item.productId, e.target.value); }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    onUpdateLineNote?.(item.productId, (e.target as HTMLInputElement).value);
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* ═══ FOOTER: TOTALS & ACTIONS ═══ */}
                        <div className="border-t border-white/10 bg-slate-950/80 backdrop-blur-2xl px-6 py-6 shrink-0 space-y-5 rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-slate-900/50 rounded-2xl p-4 border border-white/5 shadow-inner group">
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] block mb-2 group-hover:text-slate-400 transition-colors">Matrix Subtotal</span>
                                    <span className="text-xl font-black text-white tabular-nums tracking-tighter italic">{currency}{formatNumber(total)}</span>
                                </div>
                                <div
                                    onClick={() => { setNumpadMode('disc'); setShowNumpad(true); }}
                                    className="bg-slate-900/50 rounded-2xl p-4 border border-white/5 text-center cursor-pointer hover:bg-slate-900 transition-all group relative overflow-hidden"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] italic">Strategic Discount</span>
                                        <div className="flex items-center bg-slate-950/80 rounded-lg p-1 border border-white/5">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onSetDiscountType('fixed'); }}
                                                className={clsx("px-2 py-0.5 text-[10px] font-black rounded-md transition-all", discountType === 'fixed' ? "text-slate-950 bg-amber-500 shadow-lg shadow-amber-500/20" : "text-slate-600 hover:text-slate-400")}
                                            >{currency}</button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onSetDiscountType('percentage'); }}
                                                className={clsx("px-2 py-0.5 text-[10px] font-black rounded-md transition-all", discountType === 'percentage' ? "text-slate-950 bg-amber-500 shadow-lg shadow-amber-500/20" : "text-slate-600 hover:text-slate-400")}
                                            >%</button>
                                        </div>
                                    </div>
                                    <span className={clsx("text-2xl font-black tabular-nums tracking-tighter", discount > 0 ? "text-amber-500 italic" : "text-slate-800")}>
                                        {discount > 0 ? `-${formatNumber(discountType === 'percentage' ? total * discount / 100 : discount)}` : '0.00'}
                                    </span>
                                </div>
                                <div className="bg-emerald-gradient rounded-3xl p-4 text-center shadow-[0_10px_40px_rgba(16,185,129,0.2)] border border-white/20 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 blur-2xl rounded-full" />
                                    <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.3em] block mb-2 relative z-10">Grand Aggregate</span>
                                    <span className="text-3xl font-black text-white tabular-nums tracking-tighter leading-none relative z-10 italic">{currency}{formatNumber(totalAmount)}</span>
                                </div>
                            </div>

                            {selectedClient && selectedClientId > 1 && (
                                <div className="flex items-center gap-3 flex-wrap bg-slate-900/30 p-2 rounded-2xl border border-white/5">
                                    {(selectedClient as any).balance > 0 && (
                                        <button
                                            onClick={() => {
                                                onSetPaymentMethod('WALLET');
                                                const bal = (selectedClient as any).balance;
                                                onSetCashReceived(String(Math.min(bal, totalAmount)));
                                            }}
                                            className="flex items-center gap-3 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all shadow-lg"
                                        >
                                            <Wallet size={14} />
                                            <span>Vault: {currency}{((selectedClient as any).balance || 0).toFixed(2)}</span>
                                            <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-[9px] font-black">EXTRACT</span>
                                        </button>
                                    )}
                                    {(selectedClient as any).loyalty_points > 0 && (
                                        <button
                                            onClick={() => {
                                                const pts = (selectedClient as any).loyalty_points;
                                                onSetPointsRedeemed(pts);
                                            }}
                                            className={clsx(
                                                "flex items-center gap-3 px-4 py-2 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all",
                                                pointsRedeemed > 0 ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)]" : "bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-slate-950"
                                            )}
                                        >
                                            <Star size={14} className={pointsRedeemed > 0 ? "fill-slate-950" : ""} />
                                            <span>{(selectedClient as any).loyalty_points} Points</span>
                                            <span className={clsx("px-2 py-0.5 rounded text-[9px] font-black", pointsRedeemed > 0 ? "bg-slate-950/20 text-slate-950" : "bg-amber-500 text-slate-950")}>
                                                {pointsRedeemed > 0 ? 'SYNCHRONIZED' : 'REDEEM'}
                                            </span>
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="flex items-stretch gap-4">
                                <div className="flex-1 relative group">
                                    <span className="absolute left-4 top-2 text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] group-focus-within:text-emerald-500 transition-colors">Credits Received</span>
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
                                        className="w-full pt-7 pb-3 px-4 text-right bg-slate-900 border-2 border-white/5 rounded-2xl text-2xl font-black outline-none focus:border-emerald-500/50 focus:ring-8 focus:ring-emerald-500/5 transition-all font-mono tabular-nums text-white placeholder:text-slate-800"
                                    />
                                    <div className="absolute left-4 bottom-3 flex gap-2">
                                        {[100, 500, 1000].map(val => (
                                            <button
                                                key={val}
                                                onClick={() => onSetCashReceived(String(Number(cashReceived || 0) + val))}
                                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-black text-slate-500 rounded-lg transition-colors border border-white/5"
                                            >
                                                +{val}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={onCharge}
                                    disabled={cart.length === 0 || isProcessing}
                                    className={clsx(
                                        "flex-[1.2] rounded-[1.8rem] flex flex-col items-center justify-center transition-all relative overflow-hidden shadow-2xl group",
                                        cart.length > 0 && !isProcessing
                                            ? deficit > 0 ? "bg-rose-gradient text-white shadow-rose-500/20" : changeDue > 0 ? "bg-blue-600 text-white shadow-blue-500/20" : "bg-emerald-gradient text-white shadow-emerald-500/30"
                                            : "bg-slate-900 text-slate-700 border border-white/5"
                                    )}
                                >
                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <span className="text-[11px] font-black uppercase tracking-[0.5em] relative z-10 mb-1 opacity-70 italic">{deficit > 0 ? "Remaining" : changeDue > 0 ? "Change" : "Execute"}</span>
                                    <span className="text-3xl font-black leading-none relative z-10 tabular-nums tracking-tighter italic">{currency}{formatNumber(deficit > 0 ? deficit : changeDue > 0 ? changeDue : totalAmount)}</span>
                                </button>
                            </div>
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
            <AddressBook
                isOpen={isAddressBookOpen}
                onClose={() => setIsAddressBookOpen(false)}
                sessionId={registerConfig?.sessionId || null}
                cashierId={registerConfig?.cashierId || null}
                currency={currency}
                isManager={!!(registerConfig as any)?.isManager}
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
                    onSetNotes(`DELIVERY|${deliveryData.recipient_name}|${deliveryData.phone}|${deliveryData.address_line1}|${deliveryData.payment_mode}|zone:${deliveryData.zone ?? 'none'}`);
                    if ((props as any).onSetDeliveryData) (props as any).onSetDeliveryData(deliveryData);
                    if (deliveryData.payment_mode === 'IMMEDIATE') {
                        await new Promise(r => setTimeout(r, 200));
                        onCharge();
                    }
                }}
            />
            {isPendingDeliveriesOpen && registerConfig?.sessionId && (
                <POSPendingDeliveriesPanel
                    sessionId={registerConfig.sessionId}
                    currency={currency}
                    onClose={() => setIsPendingDeliveriesOpen(false)}
                />
            )}
            <ClientVaultModal
                isOpen={isVaultOpen}
                onClose={() => onSetIsVaultOpen(false)}
                clientName={selectedClient?.name || 'Walk-in'}
                currency={currency}
                fidelity={clientFidelity}
                loading={fidelityLoading || false}
            />
            <ManagerOverride
                isOpen={isOverrideOpen}
                onClose={() => onSetOverrideOpen(false)}
                onSuccess={() => {
                    if (pendingOverrideAction) {
                        pendingOverrideAction.execute();
                    }
                }}
                actionLabel={pendingOverrideAction?.label || "Protected Action"}
            />
        </div>
    );
}
