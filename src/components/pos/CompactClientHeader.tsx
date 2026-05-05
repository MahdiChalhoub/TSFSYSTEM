'use client';

import { MapPin } from 'lucide-react';
import clsx from 'clsx';

export function CompactClientHeader({ client, currency = '$', uniqueItems, totalPieces, onOpenVault }: {
 client: any,
 currency?: string,
 uniqueItems: number,
 totalPieces: number,
 onOpenVault?: () => void
}) {
 if (!client) return (
 <div className="px-8 py-5 bg-app-bg/80 backdrop-blur-xl border-b border-app-foreground/5 flex items-center justify-between relative overflow-hidden shrink-0">
 {/* Ambient Background Glow */}
 <div className="absolute top-0 left-10 w-64 h-full bg-app-foreground/5 blur-[40px] pointer-events-none" />

 <div className="flex items-center gap-4 relative z-10">
 <div className="w-2.5 h-2.5 rounded-full bg-app-surface-2 animate-pulse border border-app-foreground/5" />
 <div className="flex flex-col">
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.4em] leading-none mb-1">Customer</span>
 <span className="text-[13px] font-black text-app-foreground/40 uppercase tracking-tighter italic">Walk-in Customer</span>
 </div>
 </div>

 <div className="flex gap-3 relative z-10">
 <div className="h-10 px-5 bg-app-foreground/5 rounded-2xl flex items-center gap-3 border border-app-foreground/5 backdrop-blur-md">
 <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-[0.2em]">Order Total</span>
 <span className="text-[14px] font-black tabular-nums text-app-primary leading-tight tracking-tighter">{totalPieces} <span className="text-[10px] text-app-muted-foreground ml-1">UNITS</span></span>
 </div>
 </div>
 </div>
 );

 const balance = client.balance || 0;
 const loyalty = client.loyalty_points || client.loyalty || 0;

 return (
 <div className="px-10 py-6 bg-[#0F172A] border-b border-app-foreground/5 flex items-center justify-between gap-10 relative overflow-hidden group shrink-0">
 {/* Accent Line */}
 <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-gradient opacity-80" />
 {/* Glow */}
 <div className="absolute -top-12 -left-12 w-48 h-48 bg-app-primary/10 rounded-full blur-[60px] pointer-events-none" />

 <div className="flex items-center gap-12 divide-x divide-white/5 relative z-10">
 <div className="flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.8rem] bg-app-surface flex items-center justify-center text-app-muted-foreground shrink-0 border border-app-foreground/5 shadow-2xl transition-all duration-700 group-hover:bg-emerald-gradient group-hover:text-app-foreground group-hover:rotate-3 group-hover:scale-110">
 <span className="text-lg font-black uppercase text-inherit italic">{client.name?.substring(0, 2)}</span>
 </div>
 <div className="flex flex-col min-w-0">
 <span className="text-[10px] font-black text-app-primary/50 uppercase tracking-[0.4em] leading-none mb-2">Authenticated Partner</span>
 <h2 className="font-black text-app-foreground text-2xl uppercase tracking-tighter truncate max-w-[280px] italic leading-none">{client.name}</h2>
 <div className="flex items-center gap-3 mt-2">
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest border-r border-app-border pr-3">Client Database</span>
 <span className="font-black text-app-muted-foreground text-[11px] tabular-nums tracking-widest">{client.phone || 'COMMS_DISABLED'}</span>
 </div>
 </div>
 </div>

 <div className="pl-12 flex flex-col justify-center">
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.3em] leading-none mb-3">Logistics Coordinate</span>
 <div className="flex items-center gap-3 text-[13px] font-black text-app-muted-foreground italic">
 <MapPin size={16} className="text-app-primary shrink-0 opacity-60" />
 <span className="truncate max-w-[300px] uppercase tracking-tight">{client.address || 'Standard Hub Allocation'}</span>
 </div>
 </div>
 </div>

 <div className="flex items-center gap-10 ml-auto relative z-10">
 <div className="flex gap-4">
 <div className="flex flex-col items-center px-6 py-2 bg-app-bg/50 rounded-2xl border border-app-foreground/5 shadow-inner">
 <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-tighter mb-1">Sub-Items</span>
 <span className="text-[16px] font-black tabular-nums text-app-primary leading-tight tracking-tighter">{uniqueItems}</span>
 </div>
 <div className="flex flex-col items-center px-6 py-2 bg-app-foreground/5 rounded-2xl border border-app-foreground/5">
 <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-tighter mb-1">Aggregate</span>
 <span className="text-[16px] font-black tabular-nums text-app-foreground leading-tight tracking-tighter">{totalPieces}</span>
 </div>
 </div>

 <button
 onClick={onOpenVault}
 className="flex gap-10 divide-x divide-white/5 bg-app-surface/50 hover:bg-app-surface hover:shadow-[0_0_50px_rgba(16,185,129,0.15)] px-8 py-3 rounded-[2.5rem] transition-all active:scale-95 group border border-app-foreground/10 hover:border-app-primary/30"
 >
 <div className="flex flex-col text-right">
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest leading-none group-hover:text-app-primary transition-colors mb-2">Vault Balance</span>
 <span className={clsx("font-black text-2xl tracking-tighter tabular-nums leading-none", balance > 0 ? "text-rose-500" : "text-app-primary")}>
 {currency}{balance.toLocaleString()}
 </span>
 </div>
 <div className="pl-10 flex flex-col text-right">
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest leading-none group-hover:text-app-warning transition-colors mb-2">Loyalty DNA</span>
 <span className="font-black text-app-warning text-2xl tracking-tighter tabular-nums leading-none">{loyalty}<span className="text-[11px] ml-1 uppercase opacity-40">pts</span></span>
 </div>
 </button>
 </div>
 </div>
 );
}
