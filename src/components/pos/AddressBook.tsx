'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    BookOpen, Plus, X, Check, XCircle, Trash2, Clock,
    ArrowDownLeft, ArrowUpRight, AlertTriangle, Shield,
    Loader2, ChevronDown, ChevronUp, FileText, Hash
} from 'lucide-react';
import { toast } from 'sonner';
import { erpFetch } from '@/lib/erp-api';

interface AddressBookEntry {
    id: number;
    description: string;
    reference: string;
    amountIn: number;
    amountOut: number;
    net: number;
    runningBalance: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    cashierName: string;
    cashierId: number;
    approvedBy: string | null;
    approvedAt: string | null;
    rejectionNotes: string;
    createdAt: string;
}

interface AddressBookSummary {
    totalIn: number;
    totalOut: number;
    netBalance: number;
    approvedBalance: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
}

interface AddressBookProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: number | null;
    cashierId: number | null;
    currency: string;
    isManager?: boolean;
}

export function AddressBook({ isOpen, onClose, sessionId, cashierId, currency, isManager = false }: AddressBookProps) {
    const [entries, setEntries] = useState<AddressBookEntry[]>([]);
    const [summary, setSummary] = useState<AddressBookSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [form, setForm] = useState({ description: '', reference: '', amountIn: '', amountOut: '' });
    const [saving, setSaving] = useState(false);
    const [reviewingId, setReviewingId] = useState<number | null>(null);
    const [rejectNotes, setRejectNotes] = useState('');
    const [showRejectForm, setShowRejectForm] = useState<number | null>(null);

    const loadEntries = useCallback(async () => {
        if (!sessionId) return;
        setLoading(true);
        try {
            const res = await erpFetch(`pos-registers/address-book/?session_id=${sessionId}`);
            if (res?.entries) {
                setEntries(res.entries);
                setSummary(res.summary);
            }
        } catch (e) {
            console.error('Failed to load address book', e);
        }
        setLoading(false);
    }, [sessionId]);

    useEffect(() => {
        if (isOpen && sessionId) loadEntries();
    }, [isOpen, sessionId, loadEntries]);

    const handleAdd = async () => {
        if (!form.description.trim()) {
            toast.error('Description is required'); return;
        }
        const amIn = parseFloat(form.amountIn) || 0;
        const amOut = parseFloat(form.amountOut) || 0;
        if (amIn === 0 && amOut === 0) {
            toast.error('Enter an amount in or out'); return;
        }
        setSaving(true);
        try {
            const res = await erpFetch('pos-registers/address-book/add/', {
                method: 'POST',
                body: JSON.stringify({
                    session_id: sessionId,
                    cashier_id: cashierId,
                    description: form.description,
                    reference: form.reference,
                    amount_in: amIn,
                    amount_out: amOut,
                })
            });
            if (res?.id) {
                toast.success('Entry added — pending manager review');
                setForm({ description: '', reference: '', amountIn: '', amountOut: '' });
                setShowAddForm(false);
                loadEntries();
            } else {
                toast.error(res?.error || 'Failed to add entry');
            }
        } catch (e) { toast.error('Failed to add entry'); }
        setSaving(false);
    };

    const handleReview = async (entryId: number, action: 'approve' | 'reject') => {
        setReviewingId(entryId);
        try {
            const res = await erpFetch('pos-registers/address-book/review/', {
                method: 'POST',
                body: JSON.stringify({
                    entry_id: entryId,
                    action,
                    notes: action === 'reject' ? rejectNotes : '',
                })
            });
            if (res?.status) {
                toast.success(res.message);
                setShowRejectForm(null);
                setRejectNotes('');
                loadEntries();
            } else {
                toast.error(res?.error || 'Review failed');
            }
        } catch (e) { toast.error('Review failed'); }
        setReviewingId(null);
    };

    const handleDelete = async (entryId: number) => {
        try {
            const res = await erpFetch('pos-registers/address-book/delete/', {
                method: 'POST',
                body: JSON.stringify({ entry_id: entryId })
            });
            if (res?.message) {
                toast.success('Entry deleted');
                loadEntries();
            } else {
                toast.error(res?.error || 'Delete failed');
            }
        } catch (e) { toast.error('Delete failed'); }
    };

    const formatMoney = (n: number) => `${currency}${Math.abs(n).toFixed(0)}`;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1500] flex items-center justify-end bg-black/40 backdrop-blur-sm">
            {/* Backdrop click */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Sidebar panel */}
            <div className="relative z-10 w-full max-w-lg h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="shrink-0 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                                <BookOpen size={20} />
                            </div>
                            <div>
                                <h2 className="text-base font-black text-gray-900">Address Book</h2>
                                <p className="text-[10px] text-gray-400 font-bold">
                                    Offline payment ledger • {entries.length} entries
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/60 text-gray-400 hover:text-gray-600 transition-all">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Summary strip */}
                    {summary && (
                        <div className="mt-3 grid grid-cols-4 gap-2">
                            <div className="bg-white/80 rounded-lg p-2 text-center">
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">In</span>
                                <span className="text-sm font-black text-emerald-600">{formatMoney(summary.totalIn)}</span>
                            </div>
                            <div className="bg-white/80 rounded-lg p-2 text-center">
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Out</span>
                                <span className="text-sm font-black text-rose-600">{formatMoney(summary.totalOut)}</span>
                            </div>
                            <div className="bg-white/80 rounded-lg p-2 text-center">
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Balance</span>
                                <span className={`text-sm font-black ${summary.netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {summary.netBalance >= 0 ? '+' : '-'}{formatMoney(summary.netBalance)}
                                </span>
                            </div>
                            <div className="bg-white/80 rounded-lg p-2 text-center">
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Pending</span>
                                <span className="text-sm font-black text-amber-600">{summary.pendingCount}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Entries list */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 size={24} className="animate-spin text-gray-300" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-300 gap-2">
                            <BookOpen size={32} strokeWidth={1} />
                            <p className="text-xs text-gray-400">No entries yet</p>
                            <p className="text-[10px] text-gray-300">Log payments you can't enter in POS</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {entries.map((entry) => (
                                <div key={entry.id} className={`px-5 py-3 hover:bg-gray-50/50 transition-colors ${entry.status === 'REJECTED' ? 'opacity-50' : ''
                                    }`}>
                                    <div className="flex items-start justify-between gap-3">
                                        {/* Left: icon + info */}
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${entry.amountIn > 0
                                                    ? 'bg-emerald-50 text-emerald-500'
                                                    : 'bg-rose-50 text-rose-500'
                                                }`}>
                                                {entry.amountIn > 0 ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-gray-900 truncate">{entry.description}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {entry.reference && (
                                                        <span className="flex items-center gap-0.5 text-[9px] text-gray-400">
                                                            <Hash size={8} /> {entry.reference}
                                                        </span>
                                                    )}
                                                    <span className="text-[9px] text-gray-300">
                                                        {new Date(entry.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span className="text-[9px] text-gray-400">by {entry.cashierName}</span>
                                                </div>
                                                {/* Status badge */}
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    {entry.status === 'PENDING' && (
                                                        <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                                            <Clock size={8} /> Pending Review
                                                        </span>
                                                    )}
                                                    {entry.status === 'APPROVED' && (
                                                        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                            <Check size={8} /> Approved{entry.approvedBy ? ` by ${entry.approvedBy}` : ''}
                                                        </span>
                                                    )}
                                                    {entry.status === 'REJECTED' && (
                                                        <span className="flex items-center gap-1 text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                                            <XCircle size={8} /> Rejected
                                                        </span>
                                                    )}
                                                </div>
                                                {entry.rejectionNotes && (
                                                    <p className="text-[10px] text-rose-400 mt-1 italic">"{entry.rejectionNotes}"</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: amounts + actions */}
                                        <div className="text-right shrink-0">
                                            {entry.amountIn > 0 && (
                                                <p className="text-sm font-black text-emerald-600">+{formatMoney(entry.amountIn)}</p>
                                            )}
                                            {entry.amountOut > 0 && (
                                                <p className="text-sm font-black text-rose-600">-{formatMoney(entry.amountOut)}</p>
                                            )}
                                            <p className="text-[9px] text-gray-400 font-mono mt-0.5">
                                                bal: {entry.runningBalance >= 0 ? '+' : ''}{formatMoney(entry.runningBalance)}
                                            </p>

                                            {/* Manager review buttons */}
                                            {entry.status === 'PENDING' && isManager && (
                                                <div className="flex items-center gap-1 mt-2 justify-end">
                                                    <button
                                                        onClick={() => handleReview(entry.id, 'approve')}
                                                        disabled={reviewingId === entry.id}
                                                        className="p-1 rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-all disabled:opacity-50"
                                                        title="Approve"
                                                    >
                                                        {reviewingId === entry.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                                    </button>
                                                    <button
                                                        onClick={() => setShowRejectForm(showRejectForm === entry.id ? null : entry.id)}
                                                        className="p-1 rounded-md bg-rose-500 text-white hover:bg-rose-600 transition-all"
                                                        title="Reject"
                                                    >
                                                        <XCircle size={10} />
                                                    </button>
                                                </div>
                                            )}
                                            {/* Delete for pending entries by the creator */}
                                            {entry.status === 'PENDING' && entry.cashierId === cashierId && (
                                                <button
                                                    onClick={() => handleDelete(entry.id)}
                                                    className="mt-1 p-1 rounded-md text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                                                    title="Delete entry"
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Reject form */}
                                    {showRejectForm === entry.id && (
                                        <div className="mt-2 flex gap-2 animate-in slide-in-from-top-2">
                                            <input
                                                value={rejectNotes}
                                                onChange={(e) => setRejectNotes(e.target.value)}
                                                placeholder="Reason for rejection..."
                                                className="flex-1 px-3 py-1.5 border border-rose-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-rose-200"
                                            />
                                            <button
                                                onClick={() => handleReview(entry.id, 'reject')}
                                                disabled={reviewingId === entry.id}
                                                className="px-3 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-bold hover:bg-rose-600 disabled:opacity-50"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Add new entry form */}
                <div className="shrink-0 border-t border-gray-100 bg-gray-50">
                    {showAddForm ? (
                        <div className="p-4 space-y-3 animate-in slide-in-from-bottom-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">New Entry</h3>
                                <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={14} />
                                </button>
                            </div>
                            <input
                                value={form.description}
                                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Description (e.g. 'Taxi fare collected')"
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-200"
                                autoFocus
                            />
                            <input
                                value={form.reference}
                                onChange={(e) => setForm(f => ({ ...f, reference: e.target.value }))}
                                placeholder="Reference # (optional)"
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mb-1">
                                        <ArrowDownLeft size={8} className="inline" /> Money In
                                    </label>
                                    <input
                                        type="number"
                                        value={form.amountIn}
                                        onChange={(e) => setForm(f => ({ ...f, amountIn: e.target.value }))}
                                        placeholder="0"
                                        className="w-full px-3 py-2 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-200 text-center"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-rose-600 uppercase tracking-widest block mb-1">
                                        <ArrowUpRight size={8} className="inline" /> Money Out
                                    </label>
                                    <input
                                        type="number"
                                        value={form.amountOut}
                                        onChange={(e) => setForm(f => ({ ...f, amountOut: e.target.value }))}
                                        placeholder="0"
                                        className="w-full px-3 py-2 border border-rose-200 rounded-xl text-sm font-bold text-rose-700 outline-none focus:ring-2 focus:ring-rose-200 text-center"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleAdd}
                                disabled={saving || !form.description.trim()}
                                className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-black text-sm hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-100"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                Add Entry (Pending Approval)
                            </button>
                        </div>
                    ) : (
                        <div className="p-4">
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="w-full py-3 bg-amber-500 text-white rounded-xl font-black text-sm hover:bg-amber-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-100"
                            >
                                <Plus size={14} />
                                New Entry
                            </button>
                            <p className="text-center text-[9px] text-gray-400 mt-2">
                                <AlertTriangle size={8} className="inline text-amber-500" /> Entries require manager approval • You are responsible for accuracy
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
