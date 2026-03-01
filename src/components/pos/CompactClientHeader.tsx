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
        <div className="px-8 py-5 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between relative overflow-hidden shrink-0">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-10 w-64 h-full bg-slate-500/5 blur-[40px] pointer-events-none" />

            <div className="flex items-center gap-4 relative z-10">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-800 animate-pulse border border-white/5" />
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] leading-none mb-1">Operational Context</span>
                    <span className="text-[13px] font-black text-white/40 uppercase tracking-tighter italic">Anonymous Session Protocol</span>
                </div>
            </div>

            <div className="flex gap-3 relative z-10">
                <div className="h-10 px-5 bg-white/5 rounded-2xl flex items-center gap-3 border border-white/5 backdrop-blur-md">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Matrix Throughput</span>
                    <span className="text-[14px] font-black tabular-nums text-emerald-400 leading-tight tracking-tighter">{totalPieces} <span className="text-[10px] text-slate-600 ml-1">UNITS</span></span>
                </div>
            </div>
        </div>
    );

    const balance = client.balance || 0;
    const loyalty = client.loyalty_points || client.loyalty || 0;

    return (
        <div className="px-10 py-6 bg-[#0F172A] border-b border-white/5 flex items-center justify-between gap-10 relative overflow-hidden group shrink-0">
            {/* Accent Line */}
            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-gradient opacity-80" />
            {/* Glow */}
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none" />

            <div className="flex items-center gap-12 divide-x divide-white/5 relative z-10">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-[1.8rem] bg-slate-900 flex items-center justify-center text-slate-500 shrink-0 border border-white/5 shadow-2xl transition-all duration-700 group-hover:bg-emerald-gradient group-hover:text-white group-hover:rotate-3 group-hover:scale-110">
                        <span className="text-lg font-black uppercase text-inherit italic">{client.name?.substring(0, 2)}</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.4em] leading-none mb-2">Authenticated Partner</span>
                        <h2 className="font-black text-white text-2xl uppercase tracking-tighter truncate max-w-[280px] italic leading-none">{client.name}</h2>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest border-r border-slate-800 pr-3">Registry Node</span>
                            <span className="font-black text-slate-400 text-[11px] tabular-nums tracking-widest">{client.phone || 'COMMS_DISABLED'}</span>
                        </div>
                    </div>
                </div>

                <div className="pl-12 flex flex-col justify-center">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] leading-none mb-3">Logistics Coordinate</span>
                    <div className="flex items-center gap-3 text-[13px] font-black text-slate-400 italic">
                        <MapPin size={16} className="text-emerald-500 shrink-0 opacity-60" />
                        <span className="truncate max-w-[300px] uppercase tracking-tight">{client.address || 'Standard Hub Allocation'}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-10 ml-auto relative z-10">
                <div className="flex gap-4">
                    <div className="flex flex-col items-center px-6 py-2 bg-slate-950/50 rounded-2xl border border-white/5 shadow-inner">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter mb-1">Sub-Items</span>
                        <span className="text-[16px] font-black tabular-nums text-emerald-400 leading-tight tracking-tighter">{uniqueItems}</span>
                    </div>
                    <div className="flex flex-col items-center px-6 py-2 bg-white/5 rounded-2xl border border-white/5">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter mb-1">Aggregate</span>
                        <span className="text-[16px] font-black tabular-nums text-white leading-tight tracking-tighter">{totalPieces}</span>
                    </div>
                </div>

                <button
                    onClick={onOpenVault}
                    className="flex gap-10 divide-x divide-white/5 bg-slate-900/50 hover:bg-slate-900 hover:shadow-[0_0_50px_rgba(16,185,129,0.15)] px-8 py-3 rounded-[2.5rem] transition-all active:scale-95 group border border-white/10 hover:border-emerald-500/30"
                >
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none group-hover:text-emerald-400 transition-colors mb-2">Vault Balance</span>
                        <span className={clsx("font-black text-2xl tracking-tighter tabular-nums leading-none", balance > 0 ? "text-rose-500" : "text-emerald-500")}>
                            {currency}{balance.toLocaleString()}
                        </span>
                    </div>
                    <div className="pl-10 flex flex-col text-right">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none group-hover:text-amber-400 transition-colors mb-2">Loyalty DNA</span>
                        <span className="font-black text-amber-500 text-2xl tracking-tighter tabular-nums leading-none">{loyalty}<span className="text-[11px] ml-1 uppercase opacity-40">pts</span></span>
                    </div>
                </button>
            </div>
        </div>
    );
}
