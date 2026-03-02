'use client';
import { useState, useEffect, useCallback } from 'react';
import { POSLayoutVariant } from '@/types/pos-layout';
import {
 ShoppingCart, Plus, X, Wifi, WifiOff, RefreshCw, Layout,
 Maximize, Minimize, LogOut, Landmark, User, ArrowLeft, Truck, RotateCcw
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
 } catch { /* silent */ }
 }, [registerConfig?.sessionId, isOnline]);

 useEffect(() => {
 pollPendingDeliveries();
 const iv = setInterval(pollPendingDeliveries, 30_000);
 return () => clearInterval(iv);
 }, [pollPendingDeliveries]);

 return (
 <header
 className="h-14 flex items-stretch shrink-0 z-50 relative overflow-hidden"
 style={{
 background: 'var(--app-sidebar-bg)',
 borderBottom: '1px solid var(--app-sidebar-border)',
 boxShadow: 'var(--app-shadow-lg)',
 }}
 >
 {/* Ambient primary glow */}
 <div
 className="absolute top-0 left-1/4 w-96 h-14 blur-[60px] pointer-events-none opacity-20"
 style={{ background: 'var(--app-primary)' }}
 />

 {/* ═══ LEFT 50%: POS BADGE + SESSION TABS ═══ */}
 <div
 className="w-1/2 flex items-center px-4 gap-4 overflow-hidden"
 style={{ borderRight: '1px solid var(--app-sidebar-border)' }}
 >
 {/* POS Badge */}
 <div
 className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 group hover:rotate-6 transition-transform"
 style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px var(--app-primary-glow)' }}
 >
 <ShoppingCart size={18} className="text-white" />
 </div>

 {/* Session Tabs */}
 <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1 items-center py-2">
 {sessions.map(s => (
 <div key={s.id} className="flex shrink-0 group items-center">
 <button
 onClick={() => onSetActiveSessionId(s.id)}
 className={clsx(
 'flex items-center gap-2.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2'
 )}
 style={activeSessionId === s.id ? {
 background: 'var(--app-primary)',
 borderColor: 'var(--app-primary)',
 color: '#fff',
 boxShadow: '0 4px 14px var(--app-primary-glow)',
 } : {
 background: 'var(--app-surface-2)',
 borderColor: 'var(--app-border)',
 color: 'var(--app-text-muted)',
 }}
 >
 <ShoppingCart size={11} />
 {s.name}
 {s.cart.length > 0 && (
 <span
 className="px-2 py-0.5 rounded-full text-[9px] font-black flex items-center justify-center"
 style={{
 background: activeSessionId === s.id ? 'rgba(255,255,255,0.2)' : 'var(--app-surface)',
 color: activeSessionId === s.id ? '#fff' : 'var(--app-text-muted)',
 }}
 >
 {s.cart.length}
 </span>
 )}
 </button>
 <button
 onClick={() => onRemoveSession(s.id)}
 className="ml-[-8px] p-1 transition-all opacity-0 group-hover:opacity-100 rounded-full border"
 style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
 >
 <X size={8} />
 </button>
 </div>
 ))}
 <button
 onClick={onCreateNewSession}
 className="w-9 h-9 flex items-center justify-center rounded-xl transition-all shrink-0 active:scale-95"
 style={{
 background: 'var(--app-surface-2)',
 border: '1px solid var(--app-border)',
 color: 'var(--app-text-muted)',
 }}
 onMouseEnter={e => {
 (e.currentTarget as HTMLElement).style.background = 'var(--app-primary-light)';
 (e.currentTarget as HTMLElement).style.color = 'var(--app-primary)';
 }}
 onMouseLeave={e => {
 (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)';
 (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)';
 }}
 >
 <Plus size={16} />
 </button>
 </div>
 </div>

 {/* ═══ MIDDLE 25%: REGISTER + CASHIER INFO ═══ */}
 <div
 className="w-1/4 flex items-center px-6 gap-3 overflow-hidden"
 style={{ borderRight: '1px solid var(--app-sidebar-border)' }}
 >
 {registerConfig && (
 <div className="flex items-center gap-4 min-w-0">
 <div className="flex flex-col">
 <div className="flex items-center gap-2">
 <Landmark size={12} style={{ color: 'var(--app-primary)', opacity: 0.7 }} className="shrink-0" />
 <span className="text-[10px] font-black uppercase tracking-widest truncate" style={{ color: 'var(--app-sidebar-text)' }}>
 {registerConfig.registerName}
 </span>
 </div>
 <div className="flex items-center gap-2 mt-0.5">
 <User size={10} className="shrink-0" style={{ color: 'var(--app-text-muted)' }} />
 <span className="text-[9px] font-bold truncate uppercase tracking-tighter" style={{ color: 'var(--app-text-muted)' }}>
 {registerConfig.cashierName}
 </span>
 </div>
 </div>
 <div className="h-6 w-px hidden lg:block" style={{ background: 'var(--app-border)' }} />
 <span className="text-[10px] font-black uppercase tracking-widest truncate hidden lg:inline" style={{ color: 'var(--app-text-muted)' }}>
 {registerConfig.siteName}
 </span>
 </div>
 )}
 </div>

 {/* ═══ RIGHT 25%: STATUS + ACTIONS ═══ */}
 <div className="w-1/4 flex items-center justify-end px-4 gap-2">

 {/* Online / Sync toggle */}
 <div
 className="flex items-center rounded-xl p-1 gap-1"
 style={{ background: 'var(--app-surface-2)', border: '1px solid var(--app-border)' }}
 >
 <button
 onClick={() => onSetIsOnline(!isOnline)}
 className="h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
 style={isOnline ? {
 background: 'var(--app-primary-light)',
 color: 'var(--app-primary)',
 } : {
 background: '#f43f5e22',
 color: '#f43f5e',
 }}
 >
 {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
 {isOnline ? 'Online' : 'Offline'}
 </button>
 <button
 onClick={onSync}
 className="h-7 w-7 rounded-lg flex items-center justify-center transition-all"
 style={{ color: 'var(--app-text-muted)' }}
 >
 <RefreshCw size={10} className={isProcessing ? 'animate-spin' : ''} style={isProcessing ? { color: 'var(--app-primary)' } : {}} />
 </button>
 </div>

 {/* Action Stack */}
 <div
 className="flex items-center gap-1.5 h-9 px-2 rounded-2xl"
 style={{ background: 'var(--app-surface-2)', border: '1px solid var(--app-border)' }}
 >
 {onOpenPendingDeliveries && (
 <button
 onClick={onOpenPendingDeliveries}
 className="relative h-7 px-3 rounded-xl flex items-center gap-2 transition-all border"
 style={pendingDeliveriesCount > 0 ? {
 background: '#f59e0b22',
 color: '#f59e0b',
 borderColor: '#f59e0b44',
 } : {
 background: 'var(--app-surface)',
 color: 'var(--app-text-muted)',
 borderColor: 'var(--app-border)',
 }}
 title="Pending Deliveries"
 >
 <Truck size={12} />
 {pendingDeliveriesCount > 0 && (
 <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[8px] font-black flex items-center justify-center shadow-lg animate-bounce">
 {pendingDeliveriesCount}
 </span>
 )}
 </button>
 )}

 <div className="w-px h-4 mx-1" style={{ background: 'var(--app-border)' }} />

 <TBtn icon={isFullscreen ? Minimize : Maximize} onClick={onToggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'} />
 <TBtn icon={Layout} onClick={onOpenLayoutSelector} title="Switch Layout" />
 </div>

 {/* Exit / Critical Zone */}
 <div className="flex items-center gap-1.5 ml-1">
 <Link
 href="/dashboard"
 className="h-8 px-4 rounded-xl text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-[1.05] active:scale-95 border"
 style={{
 background: 'var(--app-primary)',
 borderColor: 'var(--app-primary)',
 boxShadow: '0 4px 14px var(--app-primary-glow)',
 }}
 title="Back to Intelligence Hub"
 >
 <ArrowLeft size={12} className="stroke-[3]" />
 <span className="hidden xl:inline">Hub</span>
 </Link>

 {onOpenReturn && (
 <button
 onClick={onOpenReturn}
 className="h-8 w-8 rounded-xl transition-all flex items-center justify-center border"
 style={{ background: 'var(--app-surface-2)', borderColor: 'var(--app-border)', color: '#f59e0b' }}
 title="Operations: Returns"
 >
 <RotateCcw size={14} />
 </button>
 )}

 <button
 onClick={onCloseRegister || onLockRegister}
 className="h-8 w-8 rounded-xl transition-all flex items-center justify-center border"
 style={{ background: 'var(--app-surface-2)', borderColor: 'var(--app-border)', color: '#f43f5e' }}
 title="Terminate Session / Lock"
 >
 <LogOut size={14} />
 </button>
 </div>
 </div>
 </header>
 );
}

function TBtn({ icon: Icon, onClick, title }: { icon: any; onClick: () => void; title: string }) {
 return (
 <button
 onClick={onClick}
 className="h-7 w-7 rounded-lg flex items-center justify-center transition-all"
 style={{ color: 'var(--app-text-muted)', background: 'transparent' }}
 onMouseEnter={e => {
 (e.currentTarget as HTMLElement).style.color = 'var(--app-primary)';
 (e.currentTarget as HTMLElement).style.background = 'var(--app-primary-light)';
 }}
 onMouseLeave={e => {
 (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)';
 (e.currentTarget as HTMLElement).style.background = 'transparent';
 }}
 title={title}
 >
 <Icon size={14} />
 </button>
 );
}
