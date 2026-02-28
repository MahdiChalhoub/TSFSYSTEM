'use client';
import { useState, useEffect, useCallback } from 'react';
import { POSLayoutVariant } from '@/types/pos-layout';
import {
    ShoppingCart, Plus, X, Wifi, WifiOff, RefreshCw, Layout,
    Maximize, Minimize, History, BookOpen,
    LogOut, Landmark, User, ArrowLeft, Truck, RotateCcw
} from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import { erpFetch } from '@/lib/erp-api';
import { QuickHoldButton } from '@/components/pos/POSQuickHold';

export interface POSToolbarProps {
    sessions: Array<{ id: string; name: string; cart: any[] }>;
    activeSessionId: string | null;
    onSetActiveSessionId: (id: string) => void;
    onCreateNewSession: () => void;
    onRemoveSession: (id: string) => void;
    registerConfig: {
        registerId: number; registerName: string; sessionId: number;
        cashierId: number; cashierName: string;
        warehouseId: number | null; cashAccountId: number | null;
        siteName: string; isManager?: boolean;
    } | null;
    isOnline: boolean;
    isProcessing: boolean;
    isFullscreen: boolean;
    totalPieces: number;
    uniqueItems: number;
    currentLayout: POSLayoutVariant;
    onSetIsOnline: (v: boolean) => void;
    onSync: () => void;
    onToggleFullscreen: () => void;
    onOpenLayoutSelector: () => void;
    onLockRegister: () => void;
    onCloseRegister?: () => void;
    onOpenReturn?: () => void;
    onHoldCart?: () => void;
    onOpenAddressBook?: () => void;
    onOpenPendingDeliveries?: () => void;
    // Additional client props still accepted but unused in toolbar itself
    [key: string]: any;
}

export function POSToolbar({
    sessions, activeSessionId, onSetActiveSessionId, onCreateNewSession, onRemoveSession,
    registerConfig, isOnline, isProcessing, isFullscreen,
    onSetIsOnline, onSync, onToggleFullscreen, onOpenLayoutSelector,
    onLockRegister, onCloseRegister, onOpenReturn, onHoldCart, onOpenAddressBook, onOpenPendingDeliveries
}: POSToolbarProps) {
    const [pendingDeliveriesCount, setPendingDeliveriesCount] = useState(0);

    const pollPendingDeliveries = useCallback(async () => {
        if (!registerConfig?.sessionId || !isOnline) return;
        try {
            const data = await erpFetch(`pos/deliveries/pending_holds/?session=${registerConfig.sessionId}`);
            const results = Array.isArray(data) ? data : data?.results ?? [];
            setPendingDeliveriesCount(results.length);
        } catch {
            // silent
        }
    }, [registerConfig?.sessionId, isOnline]);

    useEffect(() => {
        pollPendingDeliveries();
        const iv = setInterval(pollPendingDeliveries, 30_000);
        return () => clearInterval(iv);
    }, [pollPendingDeliveries]);

    return (
        <header className="h-11 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 flex items-stretch shadow-lg shrink-0 z-50">

            {/* ═══ LEFT 50%: POS + TICKET TABS ═══ */}
            <div className="w-1/2 flex items-center px-2.5 gap-1.5 overflow-hidden border-r border-slate-700/30">
                {/* POS Badge */}
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                    <ShoppingCart size={12} className="text-white" />
                </div>

                {/* Ticket Tabs */}
                <div className="flex gap-1 overflow-x-auto no-scrollbar flex-1 items-center">
                    {sessions.map(s => (
                        <div key={s.id} className="flex shrink-0 group">
                            <button
                                onClick={() => onSetActiveSessionId(s.id)}
                                className={clsx(
                                    "flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all whitespace-nowrap",
                                    activeSessionId === s.id
                                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                                        : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                                )}
                            >
                                <ShoppingCart size={9} />
                                {s.name}
                                {s.cart.length > 0 && (
                                    <span className={clsx(
                                        "w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center",
                                        activeSessionId === s.id ? "bg-white/25" : "bg-slate-600 text-slate-300"
                                    )}>{s.cart.length}</span>
                                )}
                            </button>
                            <button onClick={() => onRemoveSession(s.id)} className="ml-[-3px] p-0.5 text-slate-600 hover:text-rose-400 transition-all opacity-0 group-hover:opacity-100">
                                <X size={7} />
                            </button>
                        </div>
                    ))}
                    <button onClick={onCreateNewSession} className="w-6 h-6 flex items-center justify-center bg-slate-700/50 text-slate-500 rounded-md hover:bg-emerald-500/20 hover:text-emerald-400 transition-all shrink-0">
                        <Plus size={11} />
                    </button>
                </div>
            </div>

            {/* ═══ MIDDLE 25%: REGISTER + CASHIER ═══ */}
            <div className="w-1/4 flex items-center px-3 gap-2 border-r border-slate-700/30 overflow-hidden">
                {registerConfig && (
                    <div className="flex items-center gap-2 min-w-0">
                        <Landmark size={14} className="text-violet-400 shrink-0" />
                        <span className="text-xs font-black text-violet-300 uppercase tracking-wide truncate">
                            {registerConfig.registerName}
                        </span>
                        <span className="text-slate-600">•</span>
                        <User size={12} className="text-slate-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-300 truncate">
                            {registerConfig.cashierName}
                        </span>
                        <span className="text-slate-600 hidden lg:inline">•</span>
                        <span className="text-xs font-bold text-slate-400 truncate hidden lg:inline">
                            {registerConfig.siteName}
                        </span>
                    </div>
                )}
            </div>

            {/* ═══ RIGHT 25%: STATUS + ACTIONS ═══ */}
            <div className="w-1/4 flex items-center justify-end px-2 gap-1">
                {/* Online / Sync */}
                <div className="flex items-center bg-slate-800/80 border border-slate-700/40 rounded p-0.5 gap-0.5">
                    <button
                        onClick={() => onSetIsOnline(!isOnline)}
                        className={clsx(
                            "h-5 px-1.5 rounded text-[8px] font-black flex items-center gap-0.5 transition-all",
                            isOnline ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                        )}
                    >
                        {isOnline ? <Wifi size={8} /> : <WifiOff size={8} />}
                    </button>
                    <button onClick={onSync} className="h-5 px-1.5 rounded text-slate-500 hover:text-emerald-400 transition-all flex items-center">
                        <RefreshCw size={8} className={isProcessing ? "animate-spin" : ""} />
                    </button>
                </div>

                {/* Pending Deliveries Badge */}
                {onOpenPendingDeliveries && (
                    <button
                        onClick={onOpenPendingDeliveries}
                        className={clsx(
                            "relative h-6 px-1.5 rounded flex items-center gap-1 transition-all border",
                            pendingDeliveriesCount > 0
                                ? "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 animate-pulse-slow"
                                : "bg-slate-700/50 text-slate-500 border-slate-600/30 hover:bg-slate-700 hover:text-slate-300"
                        )}
                        title="Pending Deliveries"
                    >
                        <Truck size={10} />
                        {pendingDeliveriesCount > 0 && (
                            <span className="text-[8px] font-black bg-amber-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center absolute -top-1 -right-1">
                                {pendingDeliveriesCount}
                            </span>
                        )}
                    </button>
                )}

                {/* Action buttons */}
                {onOpenAddressBook && <TBtn icon={BookOpen} onClick={onOpenAddressBook} title="Address Book" />}
                <Link href="/dashboard" className="h-6 px-1.5 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all flex items-center gap-1 border border-amber-500/20" title="Back to Admin Dashboard">
                    <ArrowLeft size={10} className="stroke-[3]" />
                    <span className="text-[7px] font-black uppercase">Admin</span>
                </Link>
                <Link href="/sales/history" className="h-6 w-6 rounded bg-slate-700/50 text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-all flex items-center justify-center border border-slate-600/30" title="Order History">
                    <History size={10} />
                </Link>
                <Link href="/sales/sessions" className="h-6 w-6 rounded bg-slate-700/50 text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-all flex items-center justify-center border border-slate-600/30" title="Register Session History">
                    <BookOpen size={10} />
                </Link>
                <Link href="/sales/drivers" className="h-6 w-6 rounded bg-slate-700/50 text-slate-400 hover:bg-amber-500/20 hover:text-amber-300 transition-all flex items-center justify-center border border-slate-600/30" title="Driver & User Management">
                    <Truck size={10} />
                </Link>
                <Link href="/sales/audit" className="h-6 w-6 rounded bg-slate-700/50 text-slate-400 hover:bg-violet-500/20 hover:text-violet-300 transition-all flex items-center justify-center border border-slate-600/30" title="POS Audit Log">
                    <History size={10} />
                </Link>
                <TBtn icon={isFullscreen ? Minimize : Maximize} onClick={onToggleFullscreen} title={isFullscreen ? "Exit" : "Full"} />
                <TBtn icon={Layout} onClick={onOpenLayoutSelector} title="Layout" />
                {/* Quick Hold button */}
                <QuickHoldButton
                    orgKey={registerConfig?.registerId ? `reg_${registerConfig.registerId}` : 'pos_global'}
                    currency="XOF"
                    cart={(sessions.find(s => s.id === activeSessionId)?.cart) || []}
                    totalAmount={0}
                    selectedClientId={null}
                    selectedClientName=""
                    onRestoreHold={(hold) => { if (onHoldCart) onHoldCart(); }}
                    onCreateNewSession={() => { }}
                />
                {onOpenReturn && (
                    <button onClick={onOpenReturn} className="h-6 px-1.5 rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-all flex items-center gap-0.5 border border-amber-500/20" title="Returns / Refund">
                        <RotateCcw size={9} />
                        <span className="text-[7px] font-black uppercase hidden xl:inline">Return</span>
                    </button>
                )}
                <button onClick={onCloseRegister || onLockRegister} className="h-6 px-1.5 rounded bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-all flex items-center gap-0.5 border border-rose-500/20" title="Close Register">
                    <LogOut size={9} />
                    <span className="text-[7px] font-black uppercase hidden xl:inline">Close</span>
                </button>
            </div>

        </header>
    );
}

function TBtn({ icon: Icon, onClick, title }: { icon: any; onClick: () => void; title: string }) {
    return (
        <button onClick={onClick} className="h-6 w-6 rounded bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-all flex items-center justify-center border border-slate-600/30" title={title}>
            <Icon size={10} />
        </button>
    );
}
