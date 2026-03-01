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
    onOpenAccountBook?: () => void;
    onOpenPendingDeliveries?: () => void;
    // Additional client props still accepted but unused in toolbar itself
    [key: string]: any;
}

export function POSToolbar({
    sessions, activeSessionId, onSetActiveSessionId, onCreateNewSession, onRemoveSession,
    registerConfig, isOnline, isProcessing, isFullscreen,
    onSetIsOnline, onSync, onToggleFullscreen, onOpenLayoutSelector,
    onLockRegister, onCloseRegister, onOpenReturn, onHoldCart, onOpenAccountBook, onOpenPendingDeliveries
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
        <header className="h-14 bg-slate-950 border-b border-emerald-500/10 flex items-stretch shadow-2xl shrink-0 z-50 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/4 w-96 h-14 bg-emerald-500/10 blur-[60px] pointer-events-none" />

            {/* ═══ LEFT 50%: POS + TICKET TABS ═══ */}
            <div className="w-1/2 flex items-center px-4 gap-4 overflow-hidden border-r border-white/5">
                {/* POS Badge */}
                <div className="w-9 h-9 rounded-xl bg-emerald-gradient flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0 group hover:rotate-6 transition-transform">
                    <ShoppingCart size={18} className="text-white fill-white/20" />
                </div>

                {/* Ticket Tabs */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1 items-center py-2">
                    {sessions.map(s => (
                        <div key={s.id} className="flex shrink-0 group items-center">
                            <button
                                onClick={() => onSetActiveSessionId(s.id)}
                                className={clsx(
                                    "flex items-center gap-2.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2",
                                    activeSessionId === s.id
                                        ? "bg-emerald-gradient border-emerald-400 text-white shadow-xl shadow-emerald-500/20"
                                        : "bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                                )}
                            >
                                <ShoppingCart size={11} className={activeSessionId === s.id ? "text-white" : "text-slate-600"} />
                                {s.name}
                                {s.cart.length > 0 && (
                                    <span className={clsx(
                                        "px-2 py-0.5 rounded-full text-[9px] font-black flex items-center justify-center",
                                        activeSessionId === s.id ? "bg-white/20 text-white" : "bg-slate-800 text-slate-500"
                                    )}>{s.cart.length}</span>
                                )}
                            </button>
                            <button onClick={() => onRemoveSession(s.id)} className="ml-[-8px] p-1 text-slate-700 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 bg-slate-950 rounded-full border border-slate-800">
                                <X size={8} />
                            </button>
                        </div>
                    ))}
                    <button onClick={onCreateNewSession} className="w-9 h-9 flex items-center justify-center bg-slate-900 border border-slate-800 text-slate-600 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 transition-all shrink-0 active:scale-95 shadow-sm">
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* ═══ MIDDLE 25%: REGISTER + CASHIER ═══ */}
            <div className="w-1/4 flex items-center px-6 gap-3 border-r border-white/5 overflow-hidden">
                {registerConfig && (
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <Landmark size={12} className="text-emerald-500/70 shrink-0" />
                                <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest truncate">
                                    {registerConfig.registerName}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <User size={10} className="text-slate-600 shrink-0" />
                                <span className="text-[9px] font-bold text-slate-500 truncate uppercase tracking-tighter">
                                    {registerConfig.cashierName}
                                </span>
                            </div>
                        </div>
                        <div className="h-6 w-px bg-slate-800 hidden lg:block" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest truncate hidden lg:inline">
                            {registerConfig.siteName}
                        </span>
                    </div>
                )}
            </div>

            {/* ═══ RIGHT 25%: STATUS + ACTIONS ═══ */}
            <div className="w-1/4 flex items-center justify-end px-4 gap-2">
                {/* Online / Sync */}
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 shadow-inner">
                    <button
                        onClick={() => onSetIsOnline(!isOnline)}
                        className={clsx(
                            "h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm",
                            isOnline ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        )}
                    >
                        {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                        {isOnline ? 'Online' : 'Offline'}
                    </button>
                    <button onClick={onSync} className="h-7 w-7 rounded-lg text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/5 transition-all flex items-center justify-center">
                        <RefreshCw size={10} className={isProcessing ? "animate-spin text-emerald-500" : ""} />
                    </button>
                </div>

                {/* Right Action Stack */}
                <div className="flex items-center gap-1.5 h-9 px-2 bg-slate-900/50 border border-slate-800 rounded-2xl">
                    {onOpenPendingDeliveries && (
                        <button
                            onClick={onOpenPendingDeliveries}
                            className={clsx(
                                "relative h-7 px-3 rounded-xl flex items-center gap-2 transition-all border",
                                pendingDeliveriesCount > 0
                                    ? "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20 active:scale-95"
                                    : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300"
                            )}
                            title="Pending Deliveries"
                        >
                            <Truck size={12} />
                            {pendingDeliveriesCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[8px] font-black flex items-center justify-center shadow-lg shadow-amber-500/20 scale-110 active:scale-125 transition-transform animate-bounce">
                                    {pendingDeliveriesCount}
                                </span>
                            )}
                        </button>
                    )}

                    <div className="w-px h-4 bg-slate-800 mx-1" />

                    <TBtn icon={isFullscreen ? Minimize : Maximize} onClick={onToggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"} />
                    <TBtn icon={Layout} onClick={onOpenLayoutSelector} title="Switch Layout" />
                </div>

                {/* Danger/Critical Zones */}
                <div className="flex items-center gap-1.5 ml-1">
                    <Link href="/dashboard" className="h-8 px-4 rounded-xl bg-emerald-gradient text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:scale-[1.05] active:scale-95 transition-all border border-emerald-400/30" title="Back to Intelligence Hub">
                        <ArrowLeft size={12} className="stroke-[3]" />
                        <span className="hidden xl:inline">Hub</span>
                    </Link>

                    {onOpenReturn && (
                        <button onClick={onOpenReturn} className="h-8 w-8 rounded-xl bg-slate-900 border border-slate-800 text-amber-500 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center shadow-sm" title="Operations: Returns">
                            <RotateCcw size={14} />
                        </button>
                    )}

                    <button onClick={onCloseRegister || onLockRegister} className="h-8 w-8 rounded-xl bg-slate-900 border border-slate-800 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm" title="Terminate Session / Lock">
                        <LogOut size={14} />
                    </button>
                </div>
            </div>
        </header>
    );
}

function TBtn({ icon: Icon, onClick, title }: { icon: any; onClick: () => void; title: string }) {
    return (
        <button onClick={onClick} className="h-7 w-7 rounded-lg bg-transparent text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/5 transition-all flex items-center justify-center" title={title}>
            <Icon size={14} />
        </button>
    );
}
