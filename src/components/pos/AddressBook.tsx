'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    BookOpen, Plus, X, Check, XCircle, Trash2, Clock,
    ArrowDownLeft, ArrowUpRight, AlertTriangle, Shield,
    Loader2, ChevronDown, ChevronUp, FileText, Hash,
    Truck, Receipt, Users, Wallet, DollarSign, RefreshCw,
    ArrowLeftRight, HelpCircle, MessageSquare, Send,
    Building2, ShoppingBag, Undo2, Scale, Package
} from 'lucide-react';
import { toast } from 'sonner';
import { erpFetch } from '@/lib/erp-api';
import clsx from 'clsx';

// ── Types ──────────────────────────────────────────────────
interface AddressBookEntry {
    id: number;
    entryType: string;
    direction: 'IN' | 'OUT';
    description: string;
    reference: string;
    amountIn: number;
    amountOut: number;
    net: number;
    runningBalance: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEED_INFO' | 'MODIFIED';
    hiddenFromCashier: boolean;
    cashierName: string;
    cashierId: number;
    approvedBy: string | null;
    approvedAt: string | null;
    rejectionNotes: string;
    cashierResponse: string;
    // Linking
    supplierId: number | null;
    supplierName: string;
    supplierInvoiceRef: string;
    clientId: number | null;
    clientName: string;
    clientInvoiceRef: string;
    expenseCategory: string;
    partnerName: string;
    linkedOrderRef: string;
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
    needInfoCount: number;
}

interface AddressBookProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: number | null;
    cashierId: number | null;
    currency: string;
    isManager?: boolean;
}

// ── Entry Type Config ──────────────────────────────────────
const ENTRY_TYPES = [
    { key: 'SUPPLIER_PAYMENT', label: 'Supplier Payment', icon: Building2, dir: 'OUT', color: 'rose', fields: ['supplier', 'invoice'] },
    { key: 'EXPENSE', label: 'Expense', icon: Receipt, dir: 'OUT', color: 'rose', fields: ['expense_category'] },
    { key: 'CLIENT_PAYMENT', label: 'Client Payment', icon: DollarSign, dir: 'IN', color: 'emerald', fields: ['client', 'invoice'] },
    { key: 'CLIENT_PREPAYMENT', label: 'Client Prepayment', icon: Wallet, dir: 'IN', color: 'emerald', fields: ['client'] },
    { key: 'SALES_RETURN', label: 'Sales Return', icon: Undo2, dir: 'OUT', color: 'amber', fields: ['client', 'order'] },
    { key: 'PARTNER_CONTRIBUTION', label: 'Partner Contribution', icon: Users, dir: 'IN', color: 'emerald', fields: ['partner'] },
    { key: 'PARTNER_WITHDRAWAL', label: 'Partner Withdrawal', icon: Users, dir: 'OUT', color: 'rose', fields: ['partner'] },
    { key: 'SALE_DEPOSIT', label: 'Sale Deposit', icon: ShoppingBag, dir: 'IN', color: 'emerald', fields: [] },
    { key: 'MONEY_TRANSFER', label: 'Money Transfer', icon: ArrowLeftRight, dir: 'OUT', color: 'blue', fields: [] },
    { key: 'CASH_SHORTAGE', label: 'Cash Shortage', icon: Scale, dir: 'OUT', color: 'rose', fields: [] },
    { key: 'OTHER_IN', label: 'Other (Money In)', icon: ArrowDownLeft, dir: 'IN', color: 'emerald', fields: [] },
    { key: 'OTHER_OUT', label: 'Other (Money Out)', icon: ArrowUpRight, dir: 'OUT', color: 'rose', fields: [] },
] as const;

const TYPE_MAP = Object.fromEntries(ENTRY_TYPES.map(t => [t.key, t]));

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
    PENDING: { label: 'Pending Review', bg: 'bg-amber-50', text: 'text-amber-600', icon: Clock },
    APPROVED: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-600', icon: Check },
    REJECTED: { label: 'Rejected', bg: 'bg-rose-50', text: 'text-rose-600', icon: XCircle },
    NEED_INFO: { label: 'Info Requested', bg: 'bg-blue-50', text: 'text-blue-600', icon: HelpCircle },
    MODIFIED: { label: 'Resubmitted', bg: 'bg-violet-50', text: 'text-violet-600', icon: RefreshCw },
};

// ── Component ──────────────────────────────────────────────
export function AddressBook({ isOpen, onClose, sessionId, cashierId, currency, isManager = false }: AddressBookProps) {
    const [entries, setEntries] = useState<AddressBookEntry[]>([]);
    const [summary, setSummary] = useState<AddressBookSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [reviewingId, setReviewingId] = useState<number | null>(null);
    const [rejectNotes, setRejectNotes] = useState('');
    const [showRejectForm, setShowRejectForm] = useState<number | null>(null);
    const [showRespondForm, setShowRespondForm] = useState<number | null>(null);
    const [respondText, setRespondText] = useState('');

    // Form state
    const [form, setForm] = useState({
        entryType: 'OTHER_IN',
        description: '',
        reference: '',
        amount: '',
        // Linking
        supplierName: '',
        supplierInvoiceRef: '',
        clientName: '',
        clientInvoiceRef: '',
        expenseCategory: '',
        partnerName: '',
        linkedOrderRef: '',
    });

    const selectedType = TYPE_MAP[form.entryType] || ENTRY_TYPES[ENTRY_TYPES.length - 1];

    const loadEntries = useCallback(async () => {
        if (!sessionId) return;
        setLoading(true);
        try {
            const mgr = isManager ? '&is_manager=true' : '';
            const res = await erpFetch(`pos-registers/address-book/?session_id=${sessionId}${mgr}`);
            if (res?.entries) {
                setEntries(res.entries);
                setSummary(res.summary);
            }
        } catch (e) {
            console.error('Failed to load address book', e);
        }
        setLoading(false);
    }, [sessionId, isManager]);

    useEffect(() => {
        if (isOpen && sessionId) loadEntries();
    }, [isOpen, sessionId, loadEntries]);

    const handleAdd = async () => {
        if (!form.description.trim()) { toast.error('Description is required'); return; }
        const amount = parseFloat(form.amount) || 0;
        if (amount === 0) { toast.error('Enter an amount'); return; }

        const isOut = selectedType.dir === 'OUT';
        setSaving(true);
        try {
            const res = await erpFetch('pos-registers/address-book/add/', {
                method: 'POST',
                body: JSON.stringify({
                    session_id: sessionId,
                    cashier_id: cashierId,
                    entry_type: form.entryType,
                    description: form.description,
                    reference: form.reference,
                    amount_in: isOut ? 0 : amount,
                    amount_out: isOut ? amount : 0,
                    supplier_name: form.supplierName,
                    supplier_invoice_ref: form.supplierInvoiceRef,
                    client_name: form.clientName,
                    client_invoice_ref: form.clientInvoiceRef,
                    expense_category: form.expenseCategory,
                    partner_name: form.partnerName,
                    linked_order_ref: form.linkedOrderRef,
                })
            });
            if (res?.id) {
                toast.success('Entry added — pending manager review');
                setForm({
                    entryType: 'OTHER_IN', description: '', reference: '', amount: '',
                    supplierName: '', supplierInvoiceRef: '', clientName: '', clientInvoiceRef: '',
                    expenseCategory: '', partnerName: '', linkedOrderRef: ''
                });
                setShowAddForm(false);
                loadEntries();
            } else {
                toast.error(res?.error || 'Failed to add entry');
            }
        } catch (e) { toast.error('Failed to add entry'); }
        setSaving(false);
    };

    const handleReview = async (entryId: number, action: 'approve' | 'reject' | 'need_info') => {
        setReviewingId(entryId);
        try {
            const res = await erpFetch('pos-registers/address-book/review/', {
                method: 'POST',
                body: JSON.stringify({
                    entry_id: entryId,
                    action,
                    notes: action !== 'approve' ? rejectNotes : '',
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

    const handleRespond = async (entryId: number) => {
        if (!respondText.trim()) { toast.error('Please write a response'); return; }
        try {
            const res = await erpFetch('pos-registers/address-book/respond/', {
                method: 'POST',
                body: JSON.stringify({ entry_id: entryId, response: respondText })
            });
            if (res?.status) {
                toast.success('Resubmitted for review');
                setShowRespondForm(null);
                setRespondText('');
                loadEntries();
            } else {
                toast.error(res?.error || 'Response failed');
            }
        } catch (e) { toast.error('Response failed'); }
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

    const formatMoney = (n: number) => {
        const abs = Math.abs(n);
        const parts = abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return `${currency}${parts}`;
    };

    const getTypeIcon = (entryType: string) => {
        const cfg = TYPE_MAP[entryType];
        return cfg?.icon || FileText;
    };

    const getTypeLabel = (entryType: string) => {
        const cfg = TYPE_MAP[entryType];
        return cfg?.label || entryType;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1500] flex items-center justify-end bg-black/40 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={onClose} />

            <div className="relative z-10 w-full max-w-lg h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* ═══ HEADER ═══ */}
                <div className="shrink-0 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                                <BookOpen size={20} />
                            </div>
                            <div>
                                <h2 className="text-base font-black text-gray-900">Address Book</h2>
                                <p className="text-[10px] text-gray-400 font-bold">
                                    Cashier Daily Ledger • {entries.length} entries
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

                {/* ═══ ENTRIES LIST ═══ */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 size={24} className="animate-spin text-gray-300" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-300 gap-2">
                            <BookOpen size={32} strokeWidth={1} />
                            <p className="text-xs text-gray-400">No entries yet</p>
                            <p className="text-[10px] text-gray-300">Log all money in/out during your shift</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {entries.map((entry) => {
                                const TypeIcon = getTypeIcon(entry.entryType);
                                const statusCfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.PENDING;
                                const StatusIcon = statusCfg.icon;
                                const isIn = entry.direction === 'IN';

                                return (
                                    <div key={entry.id} className={clsx(
                                        "px-4 py-3 hover:bg-gray-50/50 transition-colors",
                                        entry.status === 'REJECTED' && 'bg-rose-50/30',
                                        entry.status === 'NEED_INFO' && 'bg-blue-50/30',
                                    )}>
                                        <div className="flex items-start justify-between gap-3">
                                            {/* Left: icon + info */}
                                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                                <div className={clsx(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                                    isIn ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'
                                                )}>
                                                    <TypeIcon size={14} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-gray-900 truncate">{entry.description}</p>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        <span className={clsx(
                                                            "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider",
                                                            isIn ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                                        )}>
                                                            {getTypeLabel(entry.entryType)}
                                                        </span>
                                                        {entry.reference && (
                                                            <span className="flex items-center gap-0.5 text-[9px] text-gray-400">
                                                                <Hash size={7} /> {entry.reference}
                                                            </span>
                                                        )}
                                                        <span className="text-[9px] text-gray-300">
                                                            {new Date(entry.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    {/* Linking info */}
                                                    {entry.supplierName && (
                                                        <p className="text-[9px] text-gray-500 mt-0.5">
                                                            <Building2 size={8} className="inline mr-0.5" /> {entry.supplierName}
                                                            {entry.supplierInvoiceRef && <span className="ml-1 text-gray-400">• INV: {entry.supplierInvoiceRef}</span>}
                                                        </p>
                                                    )}
                                                    {entry.clientName && (
                                                        <p className="text-[9px] text-gray-500 mt-0.5">
                                                            <Users size={8} className="inline mr-0.5" /> {entry.clientName}
                                                            {entry.clientInvoiceRef && <span className="ml-1 text-gray-400">• INV: {entry.clientInvoiceRef}</span>}
                                                        </p>
                                                    )}
                                                    {entry.expenseCategory && (
                                                        <p className="text-[9px] text-gray-500 mt-0.5">
                                                            <Receipt size={8} className="inline mr-0.5" /> {entry.expenseCategory}
                                                        </p>
                                                    )}
                                                    {entry.partnerName && (
                                                        <p className="text-[9px] text-gray-500 mt-0.5">
                                                            <Users size={8} className="inline mr-0.5" /> Partner: {entry.partnerName}
                                                        </p>
                                                    )}
                                                    {entry.linkedOrderRef && (
                                                        <p className="text-[9px] text-gray-500 mt-0.5">
                                                            <ShoppingBag size={8} className="inline mr-0.5" /> Order: {entry.linkedOrderRef}
                                                        </p>
                                                    )}
                                                    {/* Status badge */}
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className={clsx(
                                                            "flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded",
                                                            statusCfg.bg, statusCfg.text
                                                        )}>
                                                            <StatusIcon size={8} /> {statusCfg.label}
                                                        </span>
                                                        <span className="text-[9px] text-gray-400">by {entry.cashierName}</span>
                                                    </div>
                                                    {entry.rejectionNotes && (
                                                        <p className="text-[10px] text-rose-400 mt-1 italic bg-rose-50 px-2 py-1 rounded">
                                                            💬 {entry.rejectionNotes}
                                                        </p>
                                                    )}
                                                    {entry.cashierResponse && (
                                                        <p className="text-[10px] text-blue-500 mt-1 italic bg-blue-50 px-2 py-1 rounded">
                                                            ↩️ {entry.cashierResponse}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: amounts + actions */}
                                            <div className="text-right shrink-0">
                                                <p className={clsx(
                                                    "text-sm font-black",
                                                    isIn ? 'text-emerald-600' : 'text-rose-600'
                                                )}>
                                                    {isIn ? '+' : '-'}{formatMoney(isIn ? entry.amountIn : entry.amountOut)}
                                                </p>
                                                <p className="text-[9px] text-gray-400 font-mono mt-0.5">
                                                    bal: {entry.runningBalance >= 0 ? '+' : ''}{formatMoney(entry.runningBalance)}
                                                </p>

                                                {/* Manager review buttons */}
                                                {(entry.status === 'PENDING' || entry.status === 'MODIFIED') && isManager && (
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
                                                            onClick={() => { setShowRejectForm(showRejectForm === entry.id ? null : entry.id); setRejectNotes(''); }}
                                                            className="p-1 rounded-md bg-rose-500 text-white hover:bg-rose-600 transition-all"
                                                            title="Reject"
                                                        >
                                                            <XCircle size={10} />
                                                        </button>
                                                        <button
                                                            onClick={() => { setShowRejectForm(entry.id); setRejectNotes(''); }}
                                                            className="p-1 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-all"
                                                            title="Request Info"
                                                        >
                                                            <HelpCircle size={10} />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Cashier respond button for REJECTED / NEED_INFO */}
                                                {(entry.status === 'REJECTED' || entry.status === 'NEED_INFO') && entry.cashierId === cashierId && (
                                                    <button
                                                        onClick={() => setShowRespondForm(showRespondForm === entry.id ? null : entry.id)}
                                                        className="mt-1 px-2 py-1 rounded-md bg-blue-50 text-blue-600 text-[9px] font-bold hover:bg-blue-100 transition-all flex items-center gap-1 ml-auto"
                                                    >
                                                        <MessageSquare size={9} /> Respond
                                                    </button>
                                                )}

                                                {/* Delete for pending entries */}
                                                {entry.status === 'PENDING' && entry.cashierId === cashierId && !isManager && (
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

                                        {/* Manager reject/info form */}
                                        {showRejectForm === entry.id && (
                                            <div className="mt-2 flex gap-2 animate-in slide-in-from-top-2">
                                                <input
                                                    value={rejectNotes}
                                                    onChange={(e) => setRejectNotes(e.target.value)}
                                                    placeholder="Notes (reason / what info is needed)..."
                                                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-200"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleReview(entry.id, 'reject')}
                                                    disabled={reviewingId === entry.id}
                                                    className="px-2.5 py-1.5 bg-rose-500 text-white rounded-lg text-[10px] font-bold hover:bg-rose-600 disabled:opacity-50"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleReview(entry.id, 'need_info')}
                                                    disabled={reviewingId === entry.id}
                                                    className="px-2.5 py-1.5 bg-blue-500 text-white rounded-lg text-[10px] font-bold hover:bg-blue-600 disabled:opacity-50"
                                                >
                                                    Need Info
                                                </button>
                                            </div>
                                        )}

                                        {/* Cashier respond form */}
                                        {showRespondForm === entry.id && (
                                            <div className="mt-2 flex gap-2 animate-in slide-in-from-top-2">
                                                <input
                                                    value={respondText}
                                                    onChange={(e) => setRespondText(e.target.value)}
                                                    placeholder="Your explanation or correction..."
                                                    className="flex-1 px-3 py-1.5 border border-blue-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-200"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleRespond(entry.id)}
                                                    className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 flex items-center gap-1"
                                                >
                                                    <Send size={10} /> Resubmit
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ═══ ADD NEW ENTRY FORM ═══ */}
                <div className="shrink-0 border-t border-gray-100 bg-gray-50">
                    {showAddForm ? (
                        <div className="p-4 space-y-3 animate-in slide-in-from-bottom-4 max-h-[60vh] overflow-y-auto">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">New Entry</h3>
                                <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Entry Type Selector */}
                            <div>
                                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Transaction Type</label>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {ENTRY_TYPES.map(t => {
                                        const Icon = t.icon;
                                        const isSelected = form.entryType === t.key;
                                        return (
                                            <button
                                                key={t.key}
                                                onClick={() => setForm(f => ({ ...f, entryType: t.key }))}
                                                className={clsx(
                                                    "p-2 rounded-lg border text-center transition-all text-[9px] font-bold flex flex-col items-center gap-1",
                                                    isSelected
                                                        ? t.dir === 'IN'
                                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-100'
                                                            : 'bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-100'
                                                        : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
                                                )}
                                            >
                                                <Icon size={14} />
                                                <span className="leading-tight">{t.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Description */}
                            <input
                                value={form.description}
                                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Description (e.g. 'Paid supplier for flour delivery')"
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-200"
                                autoFocus
                            />

                            {/* Amount */}
                            <div>
                                <label className={clsx(
                                    "text-[9px] font-black uppercase tracking-widest block mb-1",
                                    selectedType.dir === 'IN' ? 'text-emerald-600' : 'text-rose-600'
                                )}>
                                    {selectedType.dir === 'IN' ? <><ArrowDownLeft size={8} className="inline" /> Amount In</> : <><ArrowUpRight size={8} className="inline" /> Amount Out</>}
                                </label>
                                <input
                                    type="number"
                                    value={form.amount}
                                    onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                                    placeholder="0"
                                    className={clsx(
                                        "w-full px-3 py-2.5 border rounded-xl text-lg font-black outline-none focus:ring-2 text-center tabular-nums",
                                        selectedType.dir === 'IN'
                                            ? 'border-emerald-200 text-emerald-700 focus:ring-emerald-200'
                                            : 'border-rose-200 text-rose-700 focus:ring-rose-200'
                                    )}
                                />
                            </div>

                            {/* Reference */}
                            <input
                                value={form.reference}
                                onChange={(e) => setForm(f => ({ ...f, reference: e.target.value }))}
                                placeholder="Reference # (optional)"
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
                            />

                            {/* Dynamic fields based on entry type */}
                            {(selectedType.fields?.includes('supplier') || false) && (
                                <div className="space-y-2">
                                    <input
                                        value={form.supplierName}
                                        onChange={(e) => setForm(f => ({ ...f, supplierName: e.target.value }))}
                                        placeholder="Supplier name"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
                                    />
                                </div>
                            )}
                            {(selectedType.fields?.includes('invoice') || false) && (
                                <input
                                    value={form.entryType.startsWith('SUPPLIER') ? form.supplierInvoiceRef : form.clientInvoiceRef}
                                    onChange={(e) => setForm(f => ({
                                        ...f,
                                        ...(form.entryType.startsWith('SUPPLIER')
                                            ? { supplierInvoiceRef: e.target.value }
                                            : { clientInvoiceRef: e.target.value })
                                    }))}
                                    placeholder="Invoice reference (optional — can link later)"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
                                />
                            )}
                            {(selectedType.fields?.includes('client') || false) && (
                                <input
                                    value={form.clientName}
                                    onChange={(e) => setForm(f => ({ ...f, clientName: e.target.value }))}
                                    placeholder="Client name"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
                                />
                            )}
                            {(selectedType.fields?.includes('expense_category') || false) && (
                                <input
                                    value={form.expenseCategory}
                                    onChange={(e) => setForm(f => ({ ...f, expenseCategory: e.target.value }))}
                                    placeholder="Expense category (e.g. Transport, Utilities, Supplies)"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
                                />
                            )}
                            {(selectedType.fields?.includes('partner') || false) && (
                                <input
                                    value={form.partnerName}
                                    onChange={(e) => setForm(f => ({ ...f, partnerName: e.target.value }))}
                                    placeholder="Partner / Owner name"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
                                />
                            )}
                            {(selectedType.fields?.includes('order') || false) && (
                                <input
                                    value={form.linkedOrderRef}
                                    onChange={(e) => setForm(f => ({ ...f, linkedOrderRef: e.target.value }))}
                                    placeholder="Original order reference"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
                                />
                            )}

                            {/* Submit */}
                            <button
                                onClick={handleAdd}
                                disabled={saving || !form.description.trim() || !form.amount}
                                className={clsx(
                                    "w-full py-2.5 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg text-white",
                                    selectedType.dir === 'IN'
                                        ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100'
                                        : 'bg-rose-500 hover:bg-rose-600 shadow-rose-100',
                                    "disabled:opacity-50"
                                )}
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                {selectedType.dir === 'IN' ? 'Record Money In' : 'Record Money Out'} (Pending Approval)
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
