'use client';

/**
 * POSQuickHold — floating quick-hold button + restore panel
 *
 * Saves current cart (items, client, notes) as named snapshots into localStorage.
 * Displays a numbered badge on the hold button when holds exist.
 * Tap a hold to restore it into a new or current session.
 */

import { useState, useEffect } from 'react';
import { Bookmark, BookOpen, X, ChevronRight, ShoppingBag, Trash2, Plus, Clock } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

export interface CartHold {
    id: string;
    label: string;
    savedAt: string; // ISO
    cart: any[];
    clientId: number | null;
    clientName: string;
    total: number;
    currency: string;
}

interface POSQuickHoldProps {
    orgKey: string;          // tenant key for isolation, e.g. "tsf_ci"
    currency: string;
    cart: any[];
    totalAmount: number;
    selectedClientId: number | null;
    selectedClientName: string;
    onRestoreHold: (hold: CartHold) => void;
    onCreateNewSession: () => void;
}

const STORAGE_KEY = (orgKey: string) => `pos_holds_${orgKey}`;

export function saveHold(orgKey: string, hold: CartHold) {
    const existing = loadHolds(orgKey);
    existing.unshift(hold);
    if (existing.length > 20) existing.pop(); // cap at 20
    localStorage.setItem(STORAGE_KEY(orgKey), JSON.stringify(existing));
}

export function loadHolds(orgKey: string): CartHold[] {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY(orgKey)) || '[]');
    } catch { return []; }
}

export function deleteHold(orgKey: string, id: string) {
    const existing = loadHolds(orgKey).filter(h => h.id !== id);
    localStorage.setItem(STORAGE_KEY(orgKey), JSON.stringify(existing));
}

const fmt = (v: number, cur: string) => `${cur} ${v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtTime = (iso: string) => {
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
};

export default function POSQuickHold({
    orgKey, currency, cart, totalAmount, selectedClientId, selectedClientName,
    onRestoreHold, onCreateNewSession,
}: POSQuickHoldProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [holds, setHolds] = useState<CartHold[]>([]);

    const refresh = () => setHolds(loadHolds(orgKey));

    useEffect(() => {
        refresh();
        // Refresh when panel opens
    }, [isOpen, orgKey]);

    const handleHold = () => {
        if (!cart.length) { toast.error('Cart is empty — nothing to hold'); return; }
        const label = `Hold ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
        const hold: CartHold = {
            id: crypto.randomUUID(),
            label,
            savedAt: new Date().toISOString(),
            cart: JSON.parse(JSON.stringify(cart)),
            clientId: selectedClientId,
            clientName: selectedClientName || 'Walk-In',
            total: totalAmount,
            currency,
        };
        saveHold(orgKey, hold);
        refresh();
        toast.success(`Cart held as "${label}"`);
    };

    const handleRestore = (hold: CartHold) => {
        onRestoreHold(hold);
        setIsOpen(false);
        toast.success(`Restored: ${hold.label}`);
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        deleteHold(orgKey, id);
        refresh();
    };

    return (
        <>
            {/* Holds panel */}
            {isOpen && (
                <div className="fixed inset-0 z-[150]" onClick={() => setIsOpen(false)}>
                    <div
                        className="absolute top-9 right-4 w-72 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-top-2 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                            <BookOpen size={14} className="text-indigo-400 shrink-0" />
                            <span className="text-white font-black text-sm flex-1">Held Carts</span>
                            <button onClick={handleHold} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-black text-xs transition-all">
                                <Plus size={10} /> Hold Current
                            </button>
                            <button onClick={() => setIsOpen(false)} className="w-6 h-6 rounded-lg text-white/25 hover:text-white flex items-center justify-center ml-1">
                                <X size={12} />
                            </button>
                        </div>

                        {holds.length === 0 ? (
                            <div className="py-10 text-center text-white/20 text-xs flex flex-col items-center gap-2">
                                <ShoppingBag size={24} strokeWidth={1} />
                                <span>No held carts yet</span>
                                <span className="text-white/15">Press Hold Current or use Ctrl+H</span>
                            </div>
                        ) : (
                            <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                                {holds.map(hold => (
                                    <button
                                        key={hold.id}
                                        onClick={() => handleRestore(hold)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left transition-all group"
                                    >
                                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                                            <ShoppingBag size={14} className="text-indigo-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-xs font-bold truncate">{hold.label}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-white/40 text-[10px] flex items-center gap-1"><Clock size={8} />{fmtTime(hold.savedAt)}</span>
                                                <span className="text-white/40 text-[10px]">·</span>
                                                <span className="text-white/40 text-[10px] truncate">{hold.clientName}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-indigo-400 font-black text-xs tabular-nums">{fmt(hold.total, hold.currency)}</span>
                                            <button
                                                onClick={(e) => handleDelete(hold.id, e)}
                                                className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center transition-all"
                                            >
                                                <Trash2 size={9} />
                                            </button>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="px-4 py-2 border-t border-white/5 text-white/20 text-[10px] text-center">
                            Holds are stored locally · max 20 · cleared on logout
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// Separate hook for the toolbar button UI — used inside toolbar or any layout
export function QuickHoldButton({ orgKey, currency, cart, totalAmount, selectedClientId, selectedClientName, onRestoreHold, onCreateNewSession }: POSQuickHoldProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [holds, setHolds] = useState<CartHold[]>([]);

    const refresh = () => setHolds(loadHolds(orgKey));

    useEffect(() => { refresh(); }, [isOpen, orgKey]);

    const handleHold = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!cart.length) { toast.error('Cart is empty'); return; }
        const label = `Hold ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
        const hold: CartHold = {
            id: crypto.randomUUID(),
            label,
            savedAt: new Date().toISOString(),
            cart: JSON.parse(JSON.stringify(cart)),
            clientId: selectedClientId,
            clientName: selectedClientName || 'Walk-In',
            total: totalAmount,
            currency,
        };
        saveHold(orgKey, hold);
        refresh();
        toast.success(`Held as "${label}"`);
    };

    const handleRestore = (hold: CartHold, e?: React.MouseEvent) => {
        e?.stopPropagation();
        onRestoreHold(hold);
        setIsOpen(false);
        toast.success(`Restored: ${hold.label}`);
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        deleteHold(orgKey, id);
        refresh();
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(o => !o)}
                className="h-6 px-1.5 rounded bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-all flex items-center gap-0.5 border border-indigo-500/20 relative"
                title="Quick Hold (Ctrl+H)"
            >
                <Bookmark size={9} />
                <span className="text-[7px] font-black uppercase hidden xl:inline">Hold</span>
                {holds.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-500 text-white text-[7px] font-black rounded-full flex items-center justify-center">
                        {holds.length > 9 ? '9+' : holds.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[150]" onClick={() => setIsOpen(false)}>
                    <div
                        className="absolute mt-1 w-72 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-top-2 duration-200"
                        style={{ top: 36, right: 0 }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                            <BookOpen size={14} className="text-indigo-400 shrink-0" />
                            <span className="text-white font-black text-sm flex-1">Held Carts</span>
                            <button onClick={handleHold} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-black text-xs transition-all">
                                <Plus size={10} /> Save
                            </button>
                        </div>
                        {holds.length === 0 ? (
                            <div className="py-8 text-center text-white/20 text-xs flex flex-col items-center gap-1">
                                <ShoppingBag size={20} strokeWidth={1} />
                                No held carts · press Save to hold current
                            </div>
                        ) : (
                            <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
                                {holds.map(hold => (
                                    <button key={hold.id} onClick={(e) => handleRestore(hold, e)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left group transition-all">
                                        <ShoppingBag size={14} className="text-indigo-400 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-xs font-bold">{hold.label}</p>
                                            <p className="text-white/30 text-[10px]">{hold.clientName} · {fmtTime(hold.savedAt)}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-indigo-400 text-xs font-black">{fmt(hold.total, hold.currency)}</span>
                                            <button onClick={(e) => handleDelete(hold.id, e)} className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 transition-all">
                                                <Trash2 size={9} />
                                            </button>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
