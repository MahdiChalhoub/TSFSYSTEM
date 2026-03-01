'use client';

import { useState, useEffect, useCallback } from 'react';
import { erpFetch } from '@/lib/erp-api';
import {
    ChevronDown, ChevronRight, Printer, RefreshCw, Search,
    Clock, TrendingUp, CreditCard, ArrowLeft, Receipt
} from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';

interface PaymentBreakdown {
    method: string;
    label: string;
    total: number;
    count: number;
}

interface Session {
    sessionId: number;
    registerName: string;
    siteName: string;
    cashierName: string;
    closedByName: string;
    status: string;
    openedAt: string;
    closedAt: string;
    duration: string;
    openingBalance: number;
    closingBalance: number;
    expectedBalance: number;
    difference: number;
    totalSales: number;
    totalTransactions: number;
    totalCashIn: number;
    paymentBreakdown: PaymentBreakdown[];
    closingNotes: string;
}

const fmtDate = (iso: string) => {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('fr-FR', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return iso; }
};

const fmt = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function SessionRow({ session, currency }: { session: Session; currency: string }) {
    const [expanded, setExpanded] = useState(false);
    const diff = session.difference;

    const diffColor = Math.abs(diff) < 1 ? 'text-emerald-400' : diff > 0 ? 'text-blue-400' : 'text-rose-400';
    const diffLabel = Math.abs(diff) < 1 ? 'Balanced ✓' : diff > 0 ? `+${currency} ${fmt(diff)}` : `−${currency} ${fmt(Math.abs(diff))}`;

    const handlePrint = () => {
        const w = window.open('', '_blank', 'width=420,height=700');
        if (!w) return;
        const rows = session.paymentBreakdown.map(b =>
            `<div class="row"><span>${b.label} ×${b.count}</span><span>${currency} ${fmt(b.total)}</span></div>`
        ).join('');
        w.document.write(`<html><head><title>Shift #${session.sessionId}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box;font-family:'Courier New',mono;font-size:12px}body{padding:20px;color:#111}
        h1{font-size:16px;font-weight:900;text-align:center;text-transform:uppercase;letter-spacing:3px;margin-bottom:2px}
        .center{text-align:center}.divider{border-top:1px dashed #888;margin:10px 0}
        .row{display:flex;justify-content:space-between;margin:3px 0}
        .total{font-size:14px;font-weight:900;border-top:2px solid #111;margin-top:6px;padding-top:6px;display:flex;justify-content:space-between}
        </style></head><body>
        <h1>${session.registerName}</h1>
        <p class="center" style="color:#666;font-size:10px">${session.siteName || ''} · Shift Report</p>
        <div class="divider"></div>
        <div class="row"><span>Cashier</span><span>${session.cashierName}</span></div>
        <div class="row"><span>Opened</span><span>${fmtDate(session.openedAt)}</span></div>
        <div class="row"><span>Closed</span><span>${fmtDate(session.closedAt)}</span></div>
        <div class="row"><span>Duration</span><span>${session.duration}</span></div>
        <div class="divider"></div>
        ${rows || '<div class="row"><span>No sales</span></div>'}
        <div class="total"><span>TOTAL SALES</span><span>${currency} ${fmt(session.totalSales)}</span></div>
        <div style="color:#999;font-size:10px;text-align:right">${session.totalTransactions} transactions</div>
        <div class="divider"></div>
        <div class="row"><span>Opening balance</span><span>${currency} ${fmt(session.openingBalance)}</span></div>
        <div class="row"><span>+ Cash sales</span><span>${currency} ${fmt(session.totalCashIn)}</span></div>
        <div class="row"><span>Expected</span><span>${currency} ${fmt(session.expectedBalance)}</span></div>
        <div class="row"><span>Counted</span><span>${currency} ${fmt(session.closingBalance)}</span></div>
        <div class="row" style="font-weight:900"><span>Difference</span><span>${diff >= 0 ? '+' : ''}${currency} ${fmt(diff)}</span></div>
        ${session.closingNotes ? `<div class="divider"></div><div style="color:#666">${session.closingNotes}</div>` : ''}
        </body></html>`);
        w.document.close(); w.print();
    };

    return (
        <div className={clsx("border rounded-2xl overflow-hidden transition-all",
            expanded ? "border-white/15 bg-white/5" : "border-white/5 bg-white/3 hover:bg-white/5 hover:border-white/10"
        )}>
            <button className="w-full flex items-center gap-4 px-5 py-4 text-left" onClick={() => setExpanded(!expanded)}>
                {expanded
                    ? <ChevronDown size={14} className="text-white/30 shrink-0" />
                    : <ChevronRight size={14} className="text-white/30 shrink-0" />}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-sm truncate">{session.registerName}</span>
                        {session.status === 'FORCE_CLOSED' && (
                            <span className="text-[9px] font-black uppercase bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-md">Force</span>
                        )}
                    </div>
                    <div className="text-white/40 text-xs mt-0.5">{session.cashierName} · {fmtDate(session.openedAt)}</div>
                </div>
                <div className="text-right shrink-0 mr-4">
                    <div className="text-white font-black tabular-nums">{currency} {fmt(session.totalSales)}</div>
                    <div className="text-white/30 text-xs">{session.totalTransactions} tx</div>
                </div>
                <div className="text-right shrink-0">
                    <div className={clsx("text-xs font-black", diffColor)}>{diffLabel}</div>
                    <div className="text-white/25 text-xs">{session.duration}</div>
                </div>
            </button>

            {expanded && (
                <div className="border-t border-white/5 px-5 pb-5 pt-4 space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Payment Breakdown */}
                        <div>
                            <div className="text-white/25 text-[10px] uppercase tracking-widest mb-2 font-black">Payment Breakdown</div>
                            {session.paymentBreakdown.length === 0 ? (
                                <div className="text-white/20 text-xs">No sales in this session</div>
                            ) : (
                                <div className="space-y-1">
                                    {session.paymentBreakdown.map(b => (
                                        <div key={b.method} className="flex justify-between text-xs">
                                            <span className="text-white/60">{b.label} <span className="text-white/25">×{b.count}</span></span>
                                            <span className="text-white font-bold tabular-nums">{fmt(b.total)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between border-t border-white/10 pt-1 text-xs font-black text-emerald-400">
                                        <span>TOTAL</span><span tabular-nums>{fmt(session.totalSales)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Cash Reconciliation */}
                        <div>
                            <div className="text-white/25 text-[10px] uppercase tracking-widest mb-2 font-black">Cash Recon</div>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-white/50">Opening</span><span className="text-white/70 tabular-nums">{fmt(session.openingBalance)}</span></div>
                                <div className="flex justify-between"><span className="text-white/50">+ Cash sales</span><span className="text-white/70 tabular-nums">{fmt(session.totalCashIn)}</span></div>
                                <div className="flex justify-between"><span className="text-white/50">Expected</span><span className="text-white/70 tabular-nums">{fmt(session.expectedBalance)}</span></div>
                                <div className="flex justify-between"><span className="text-white/50">Counted</span><span className="text-white tabular-nums">{fmt(session.closingBalance)}</span></div>
                                <div className={clsx("flex justify-between font-black border-t border-white/10 pt-1", diffColor)}>
                                    <span>Diff</span><span className="tabular-nums">{diff >= 0 ? '+' : ''}{fmt(diff)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {session.closingNotes && (
                        <div className="text-white/30 text-xs italic">{session.closingNotes}</div>
                    )}
                    <button onClick={handlePrint} className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 font-bold text-xs flex items-center justify-center gap-2 transition-all">
                        <Printer size={13} /> Print Shift Report
                    </button>
                </div>
            )}
        </div>
    );
}

export default function SessionHistoryPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [search, setSearch] = useState('');
    const currency = 'XOF';
    const LIMIT = 25;

    const load = async (off = 0) => {
        setLoading(true);
        try {
            const data = await erpFetch(`pos-registers/session-history/?limit=${LIMIT}&offset=${off}`);
            if (data?.results) {
                setSessions(off === 0 ? data.results : prev => [...prev, ...data.results]);
                setTotal(data.count ?? 0);
                setOffset(off + LIMIT);
            }
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(0); }, []);

    const filtered = search
        ? sessions.filter(s =>
            s.registerName.toLowerCase().includes(search.toLowerCase()) ||
            s.cashierName.toLowerCase().includes(search.toLowerCase())
        )
        : sessions;

    const totalSalesAll = sessions.reduce((sum, s) => sum + (s.totalSales || 0), 0);

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <Link href="/sales" className="flex items-center gap-1.5 text-white/30 hover:text-white text-xs font-bold transition-all">
                            <ArrowLeft size={12} /> POS
                        </Link>
                    </div>
                    <h1 className="text-2xl font-black tracking-tight">Register Sessions</h1>
                    <p className="text-white/40 text-sm mt-0.5">All closed register sessions · {total} total</p>
                </div>
                <button onClick={() => load(0)} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 flex items-center justify-center transition-all">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Sessions', value: String(total), icon: Clock, color: 'text-indigo-400' },
                    { label: 'Total Sales', value: `${currency} ${fmt(totalSalesAll)}`, icon: TrendingUp, color: 'text-emerald-400' },
                    { label: 'Loaded', value: String(sessions.length), icon: CreditCard, color: 'text-amber-400' },
                ].map(s => (
                    <div key={s.label} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                        <s.icon size={20} className={clsx(s.color, 'shrink-0')} />
                        <div>
                            <div className="text-white/40 text-xs">{s.label}</div>
                            <div className="text-white font-black text-sm mt-0.5">{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Filter by register or cashier…"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/8 rounded-2xl text-white/80 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
            </div>

            {/* Sessions */}
            <div className="space-y-2">
                {loading && sessions.length === 0 ? (
                    <div className="text-center py-16 text-white/20">Loading sessions…</div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-white/20 flex flex-col items-center gap-3">
                        <Receipt size={32} strokeWidth={1} />
                        No sessions found
                    </div>
                ) : filtered.map(s => <SessionRow key={s.sessionId} session={s} currency={currency} />)}
            </div>

            {/* Load more */}
            {sessions.length < total && !search && (
                <button onClick={() => load(offset)} disabled={loading} className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/50 font-bold text-sm transition-all disabled:opacity-40">
                    {loading ? 'Loading…' : `Load more (${total - sessions.length} remaining)`}
                </button>
            )}
        </div>
    );
}
