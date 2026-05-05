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
import { getChartOfAccounts } from '@/app/actions/finance/accounts';

// ── Types ──────────────────────────────────────────────────
interface AccountBookEntry {
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

interface AccountBookSummary {
 totalIn: number;
 totalOut: number;
 netBalance: number;
 // Not yet posted
 pendingIn: number;
 pendingOut: number;
 pendingBalance: number;
 // Already posted
 approvedIn: number;
 approvedOut: number;
 approvedBalance: number;
 // Counts
 pendingCount: number;
 approvedCount: number;
 rejectedCount: number;
 needInfoCount: number;
 totalCount: number;
}

interface AccountBookProps {
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
 { key: 'SALES_RETURN', label: 'Sales Return', icon: Undo2, dir: 'OUT', color: 'amber', fields: ['client', 'invoice', 'order'] },
 // ── Partner: Capital vs Cash Transfer ──
 { key: 'PARTNER_CAPITAL_IN', label: 'Capital Injection', icon: Users, dir: 'IN', color: 'emerald', fields: ['partner'] },
 { key: 'PARTNER_CASH_IN', label: 'Partner Cash In', icon: ArrowLeftRight, dir: 'IN', color: 'emerald', fields: ['partner'] },
 { key: 'PARTNER_CASH_OUT', label: 'Partner Cash Out', icon: ArrowLeftRight, dir: 'OUT', color: 'rose', fields: ['partner'] },
 { key: 'PARTNER_CAPITAL_OUT', label: 'Capital Withdrawal', icon: Users, dir: 'OUT', color: 'rose', fields: ['partner'] },
 // ──
 { key: 'SALE_DEPOSIT', label: 'Sale Deposit', icon: ShoppingBag, dir: 'IN', color: 'emerald', fields: [] },
 { key: 'MONEY_TRANSFER', label: 'Money Transfer', icon: ArrowLeftRight, dir: 'OUT', color: 'blue', fields: [] },
 { key: 'CASH_SHORTAGE', label: 'Cash Shortage', icon: Scale, dir: 'OUT', color: 'rose', fields: [] },
 { key: 'OTHER_IN', label: 'Other (Money In)', icon: ArrowDownLeft, dir: 'IN', color: 'emerald', fields: [] },
 { key: 'OTHER_OUT', label: 'Other (Money Out)', icon: ArrowUpRight, dir: 'OUT', color: 'rose', fields: [] },
];

const TYPE_MAP = Object.fromEntries(ENTRY_TYPES.map(t => [t.key, t]));

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
 PENDING: { label: 'Pending Review', bg: 'bg-app-warning-bg', text: 'text-app-warning', icon: Clock },
 APPROVED: { label: 'Approved', bg: 'bg-app-primary-light', text: 'text-app-primary', icon: Check },
 REJECTED: { label: 'Rejected', bg: 'bg-app-error-soft', text: 'text-app-error', icon: XCircle },
 NEED_INFO: { label: 'Info Requested', bg: 'bg-app-info-bg', text: 'text-app-info', icon: HelpCircle },
 MODIFIED: { label: 'Resubmitted', bg: 'bg-violet-50', text: 'text-violet-600', icon: RefreshCw },
};

// ── Component ──────────────────────────────────────────────
export function AccountBook({ isOpen, onClose, sessionId, cashierId, currency, isManager = false }: AccountBookProps) {
 const [entries, setEntries] = useState<AccountBookEntry[]>([]);
 const [summary, setSummary] = useState<AccountBookSummary | null>(null);
 const [expenseCategories, setExpenseCategories] = useState<{ id: number; name: string }[]>([]);
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
 // Linking (IDs)
 supplierId: null as number | null,
 supplierName: '',
 supplierInvoiceId: null as number | null,
 supplierInvoiceRef: '',
 clientId: null as number | null,
 clientName: '',
 clientInvoiceId: null as number | null,
 clientInvoiceRef: '',
 expenseCategory: '',
 partnerId: null as number | null,
 partnerName: '',
 linkedOrderRef: '',
 });

 // Contact search
 const [contactQuery, setContactQuery] = useState('');
 const [contactResults, setContactResults] = useState<Array<{ id: number; name: string; phone: string; type: string; balance: number }>>([]);
 const [contactSearching, setContactSearching] = useState(false);
 const [showContactDropdown, setShowContactDropdown] = useState(false);

 // Invoice list
 const [invoices, setInvoices] = useState<Array<{
 id: number; invoiceNumber: string; type: string; status: string;
 totalAmount: number; paidAmount: number; balanceDue: number;
 issueDate: string; dueDate: string;
 }>>([]);
 const [invoicesLoading, setInvoicesLoading] = useState(false);

 // Contact search handler
 const searchContacts = useCallback(async (query: string, type: 'SUPPLIER' | 'CUSTOMER' | 'ALL') => {
 if (query.length < 1) { setContactResults([]); return; }
 setContactSearching(true);
 try {
 const res = await erpFetch(`pos-registers/address-book/search-contacts/?q=${encodeURIComponent(query)}&type=${type}`);
 if (Array.isArray(res)) setContactResults(res);
 } catch { setContactResults([]); }
 setContactSearching(false);
 }, []);

 // Load unpaid invoices for selected contact
 const loadUnpaidInvoices = useCallback(async (contactId: number, invoiceType?: 'PURCHASE' | 'SALES') => {
 setInvoicesLoading(true);
 try {
 const typeParam = invoiceType ? `&type=${invoiceType}` : '';
 const res = await erpFetch(`pos-registers/address-book/unpaid-invoices/?contact_id=${contactId}${typeParam}`);
 if (Array.isArray(res)) setInvoices(res);
 } catch { setInvoices([]); }
 setInvoicesLoading(false);
 }, []);

 // Select a contact (supplier or client)
 const selectContact = useCallback((contact: { id: number; name: string }, isSupplier: boolean) => {
 if (isSupplier) {
 setForm(f => ({ ...f, supplierId: contact.id, supplierName: contact.name }));
 loadUnpaidInvoices(contact.id, 'PURCHASE');
 } else {
 setForm(f => ({ ...f, clientId: contact.id, clientName: contact.name }));
 loadUnpaidInvoices(contact.id, 'SALES');
 }
 setShowContactDropdown(false);
 setContactQuery('');
 setContactResults([]);
 }, [loadUnpaidInvoices]);

 // Select an invoice
 const selectInvoice = useCallback((inv: { id: number; invoiceNumber: string; balanceDue: number }, isSupplier: boolean) => {
 if (isSupplier) {
 setForm(f => ({
 ...f,
 supplierInvoiceId: inv.id,
 supplierInvoiceRef: inv.invoiceNumber,
 amount: String(inv.balanceDue),
 description: f.description || `Payment for ${inv.invoiceNumber}`,
 }));
 } else {
 setForm(f => ({
 ...f,
 clientInvoiceId: inv.id,
 clientInvoiceRef: inv.invoiceNumber,
 amount: String(inv.balanceDue),
 description: f.description || `Payment for ${inv.invoiceNumber}`,
 }));
 }
 }, []);

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
 if (isOpen) {
 getChartOfAccounts(false, isManager ? 'OFFICIAL' : 'INTERNAL').then(data => {
 const exps = data.filter((a: any) => a.type === 'EXPENSE');
 setExpenseCategories(exps.map((e: any) => ({ name: e.name, id: e.id })));
 }).catch(e => console.error("Failed to fetch expense categories", e));
 }
 }, [isOpen, sessionId, loadEntries, isManager]);

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
 supplier_id: form.supplierId,
 supplier_name: form.supplierName,
 supplier_invoice_id: form.supplierInvoiceId,
 supplier_invoice_ref: form.supplierInvoiceRef,
 client_id: form.clientId,
 client_name: form.clientName,
 client_invoice_id: form.clientInvoiceId,
 client_invoice_ref: form.clientInvoiceRef,
 expense_category: form.expenseCategory,
 partner_id: form.partnerId,
 partner_name: form.partnerName,
 linked_order_ref: form.linkedOrderRef,
 })
 });
 if (res?.id) {
 toast.success('Entry added — pending manager review');
 setForm({
 entryType: 'OTHER_IN', description: '', reference: '', amount: '',
 supplierId: null, supplierName: '', supplierInvoiceId: null, supplierInvoiceRef: '',
 clientId: null, clientName: '', clientInvoiceId: null, clientInvoiceRef: '',
 expenseCategory: '', partnerId: null, partnerName: '', linkedOrderRef: ''
 });
 setInvoices([]);
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

 <div className="relative z-10 w-full max-w-lg h-full bg-app-surface shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
 {/* ═══ HEADER ═══ */}
 <div className="shrink-0 px-5 py-4 border-b border-app-border bg-gradient-to-r from-amber-50 to-orange-50">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-app-warning-bg text-app-warning flex items-center justify-center">
 <BookOpen size={20} />
 </div>
 <div>
 <h2 className="text-base font-black text-app-foreground">Account Book</h2>
 <p className="text-[10px] text-app-muted-foreground font-bold">
 Cashier Daily Ledger • {entries.length} entries
 </p>
 </div>
 </div>
 <button onClick={onClose} className="p-2 rounded-xl hover:bg-app-foreground/60 text-app-muted-foreground hover:text-app-muted-foreground transition-all">
 <X size={18} />
 </button>
 </div>

 {/* ── Audit Summary: Pending (not posted) vs Approved (posted) ── */}
 {summary && (
 <div className="mt-3 space-y-2">
 {/* Pending balance — NOT YET POSTED */}
 {summary.pendingCount > 0 && (
 <div className="bg-app-warning-bg/80 border border-app-warning/60 rounded-xl p-2.5">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1.5">
 <Clock size={10} className="text-app-warning" />
 <span className="text-[9px] font-black text-app-warning uppercase tracking-widest">
 Awaiting Approval ({summary.pendingCount})
 </span>
 </div>
 <span className={clsx(
 "text-sm font-black",
 summary.pendingBalance >= 0 ? 'text-app-success' : 'text-app-error'
 )}>
 {summary.pendingBalance >= 0 ? '+' : ''}{formatMoney(summary.pendingBalance)}
 </span>
 </div>
 <div className="flex items-center gap-3 mt-1">
 <span className="text-[9px] text-app-primary font-bold">↓ In: {formatMoney(summary.pendingIn)}</span>
 <span className="text-[9px] text-app-error font-bold">↑ Out: {formatMoney(summary.pendingOut)}</span>
 </div>
 </div>
 )}

 {/* Approved balance — ALREADY POSTED */}
 {summary.approvedCount > 0 && (
 <div className="bg-app-primary-light/80 border border-app-success/60 rounded-xl p-2.5">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1.5">
 <Check size={10} className="text-app-primary" />
 <span className="text-[9px] font-black text-app-success uppercase tracking-widest">
 Posted ({summary.approvedCount})
 </span>
 </div>
 <span className={clsx(
 "text-sm font-black",
 summary.approvedBalance >= 0 ? 'text-app-success' : 'text-app-error'
 )}>
 {summary.approvedBalance >= 0 ? '+' : ''}{formatMoney(summary.approvedBalance)}
 </span>
 </div>
 <div className="flex items-center gap-3 mt-1">
 <span className="text-[9px] text-app-primary font-bold">↓ In: {formatMoney(summary.approvedIn)}</span>
 <span className="text-[9px] text-app-error font-bold">↑ Out: {formatMoney(summary.approvedOut)}</span>
 </div>
 </div>
 )}

 {/* Status counts */}
 <div className="flex items-center gap-2 justify-center">
 {summary.rejectedCount > 0 && (
 <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-app-error-soft text-app-error">
 {summary.rejectedCount} rejected
 </span>
 )}
 {summary.needInfoCount > 0 && (
 <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-app-info-bg text-app-info">
 {summary.needInfoCount} need info
 </span>
 )}
 <span className="text-[8px] font-bold text-app-muted-foreground">
 {summary.totalCount} total entries
 </span>
 </div>
 </div>
 )}
 </div>

 {/* ═══ ENTRIES LIST ═══ */}
 <div className="flex-1 overflow-y-auto">
 {loading ? (
 <div className="flex items-center justify-center h-40">
 <Loader2 size={24} className="animate-spin text-app-muted-foreground" />
 </div>
 ) : entries.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-40 text-app-muted-foreground gap-2">
 <BookOpen size={32} strokeWidth={1} />
 <p className="text-xs text-app-muted-foreground">No entries yet</p>
 <p className="text-[10px] text-app-muted-foreground">Log all money in/out during your shift</p>
 </div>
 ) : (
 <div className="divide-y divide-app-border">
 {entries.map((entry) => {
 const TypeIcon = getTypeIcon(entry.entryType);
 const statusCfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.PENDING;
 const StatusIcon = statusCfg.icon;
 const isIn = entry.direction === 'IN';

 return (
 <div key={entry.id} className={clsx(
 "px-4 py-3 hover:bg-app-bg/50 transition-colors",
 entry.status === 'REJECTED' && 'bg-app-error-soft/30',
 entry.status === 'NEED_INFO' && 'bg-app-info-bg/30',
 )}>
 <div className="flex items-start justify-between gap-3">
 {/* Left: icon + info */}
 <div className="flex items-start gap-2.5 flex-1 min-w-0">
 <div className={clsx(
 "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
 isIn ? 'bg-app-primary-light text-app-primary' : 'bg-app-error-soft text-app-error'
 )}>
 <TypeIcon size={14} />
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-sm font-bold text-app-foreground truncate">{entry.description}</p>
 <div className="flex items-center gap-2 mt-0.5 flex-wrap">
 <span className={clsx(
 "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider",
 isIn ? 'bg-app-primary-light text-app-primary' : 'bg-app-error-soft text-app-error'
 )}>
 {getTypeLabel(entry.entryType)}
 </span>
 {entry.reference && (
 <span className="flex items-center gap-0.5 text-[9px] text-app-muted-foreground">
 <Hash size={7} /> {entry.reference}
 </span>
 )}
 <span className="text-[9px] text-app-muted-foreground">
 {new Date(entry.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
 </span>
 </div>
 {/* Linking info */}
 {entry.supplierName && (
 <p className="text-[9px] text-app-muted-foreground mt-0.5">
 <Building2 size={8} className="inline mr-0.5" /> {entry.supplierName}
 {entry.supplierInvoiceRef && <span className="ml-1 text-app-muted-foreground">• INV: {entry.supplierInvoiceRef}</span>}
 </p>
 )}
 {entry.clientName && (
 <p className="text-[9px] text-app-muted-foreground mt-0.5">
 <Users size={8} className="inline mr-0.5" /> {entry.clientName}
 {entry.clientInvoiceRef && <span className="ml-1 text-app-muted-foreground">• INV: {entry.clientInvoiceRef}</span>}
 </p>
 )}
 {entry.expenseCategory && (
 <p className="text-[9px] text-app-muted-foreground mt-0.5">
 <Receipt size={8} className="inline mr-0.5" /> {entry.expenseCategory}
 </p>
 )}
 {entry.partnerName && (
 <p className="text-[9px] text-app-muted-foreground mt-0.5">
 <Users size={8} className="inline mr-0.5" /> Partner: {entry.partnerName}
 </p>
 )}
 {entry.linkedOrderRef && (
 <p className="text-[9px] text-app-muted-foreground mt-0.5">
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
 <span className="text-[9px] text-app-muted-foreground">by {entry.cashierName}</span>
 </div>
 {entry.rejectionNotes && (
 <p className="text-[10px] text-rose-400 mt-1 italic bg-app-error-soft px-2 py-1 rounded">
 💬 {entry.rejectionNotes}
 </p>
 )}
 {entry.cashierResponse && (
 <p className="text-[10px] text-app-info mt-1 italic bg-app-info-bg px-2 py-1 rounded">
 ↩️ {entry.cashierResponse}
 </p>
 )}
 </div>
 </div>

 {/* Right: amounts + actions */}
 <div className="text-right shrink-0">
 <p className={clsx(
 "text-sm font-black",
 isIn ? 'text-app-primary' : 'text-app-error'
 )}>
 {isIn ? '+' : '-'}{formatMoney(isIn ? entry.amountIn : entry.amountOut)}
 </p>
 <p className="text-[9px] text-app-muted-foreground font-mono mt-0.5">
 bal: {entry.runningBalance >= 0 ? '+' : ''}{formatMoney(entry.runningBalance)}
 </p>

 {/* Manager review buttons */}
 {(entry.status === 'PENDING' || entry.status === 'MODIFIED') && isManager && (
 <div className="flex items-center gap-1 mt-2 justify-end">
 <button
 onClick={() => handleReview(entry.id, 'approve')}
 disabled={reviewingId === entry.id}
 className="p-1 rounded-md bg-app-primary text-app-foreground hover:bg-app-primary transition-all disabled:opacity-50"
 title="Approve"
 >
 {reviewingId === entry.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
 </button>
 <button
 onClick={() => { setShowRejectForm(showRejectForm === entry.id ? null : entry.id); setRejectNotes(''); }}
 className="p-1 rounded-md bg-app-error text-app-foreground hover:bg-app-error transition-all"
 title="Reject"
 >
 <XCircle size={10} />
 </button>
 <button
 onClick={() => { setShowRejectForm(entry.id); setRejectNotes(''); }}
 className="p-1 rounded-md bg-app-info text-app-foreground hover:bg-app-info transition-all"
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
 className="mt-1 px-2 py-1 rounded-md bg-app-info-bg text-app-info text-[9px] font-bold hover:bg-app-info-bg transition-all flex items-center gap-1 ml-auto"
 >
 <MessageSquare size={9} /> Respond
 </button>
 )}

 {/* Delete for pending entries */}
 {entry.status === 'PENDING' && entry.cashierId === cashierId && !isManager && (
 <button
 onClick={() => handleDelete(entry.id)}
 className="mt-1 p-1 rounded-md text-app-muted-foreground hover:text-app-error hover:bg-app-error-soft transition-all"
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
 className="flex-1 px-3 py-1.5 border border-app-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-200"
 autoFocus
 />
 <button
 onClick={() => handleReview(entry.id, 'reject')}
 disabled={reviewingId === entry.id}
 className="px-2.5 py-1.5 bg-app-error text-app-foreground rounded-lg text-[10px] font-bold hover:bg-app-error disabled:opacity-50"
 >
 Reject
 </button>
 <button
 onClick={() => handleReview(entry.id, 'need_info')}
 disabled={reviewingId === entry.id}
 className="px-2.5 py-1.5 bg-app-info text-app-foreground rounded-lg text-[10px] font-bold hover:bg-app-info disabled:opacity-50"
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
 className="flex-1 px-3 py-1.5 border border-app-info rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-200"
 autoFocus
 />
 <button
 onClick={() => handleRespond(entry.id)}
 className="px-3 py-1.5 bg-app-info text-app-foreground rounded-lg text-xs font-bold hover:bg-app-info flex items-center gap-1"
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
 <div className="shrink-0 border-t border-app-border bg-app-bg">
 {showAddForm ? (
 <div className="p-4 space-y-3 animate-in slide-in-from-bottom-4 max-h-[60vh] overflow-y-auto">
 <div className="flex items-center justify-between">
 <h3 className="text-xs font-black text-app-foreground uppercase tracking-widest">New Entry</h3>
 <button onClick={() => setShowAddForm(false)} className="text-app-muted-foreground hover:text-app-muted-foreground">
 <X size={14} />
 </button>
 </div>

 {/* Entry Type Selector */}
 <div>
 <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest block mb-1.5">Transaction Type</label>
 <div className="grid grid-cols-3 gap-1.5">
 {ENTRY_TYPES.filter(t => isManager || !['PARTNER_CAPITAL_IN', 'PARTNER_CASH_IN', 'PARTNER_CASH_OUT', 'PARTNER_CAPITAL_OUT', 'CASH_SHORTAGE', 'MONEY_TRANSFER'].includes(t.key)).map(t => {
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
 ? 'bg-app-primary-light border-app-success text-app-success ring-2 ring-emerald-100'
 : 'bg-app-error-soft border-app-error text-app-error ring-2 ring-rose-100'
 : 'bg-app-surface border-app-border text-app-muted-foreground hover:border-app-border'
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
 className="w-full px-3 py-2 border border-app-border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-200"
 autoFocus
 />

 {/* Amount */}
 <div>
 <label className={clsx(
 "text-[9px] font-black uppercase tracking-widest block mb-1",
 selectedType.dir === 'IN' ? 'text-app-primary' : 'text-app-error'
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
 ? 'border-app-success text-app-success focus:ring-emerald-200'
 : 'border-app-error text-app-error focus:ring-rose-200'
 )}
 />
 </div>

 {/* Reference */}
 <input
 value={form.reference}
 onChange={(e) => setForm(f => ({ ...f, reference: e.target.value }))}
 placeholder="Reference # (optional)"
 className="w-full px-3 py-2 border border-app-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
 />

 {/* ── SUPPLIER SELECTOR (live search from database) ── */}
 {(selectedType.fields?.includes('supplier') || false) && (
 <div className="space-y-2">
 <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest block">
 <Building2 size={8} className="inline mr-0.5" /> Select Supplier
 </label>
 {form.supplierId ? (
 <div className="flex items-center justify-between bg-app-warning-bg border border-app-warning rounded-xl px-3 py-2">
 <span className="text-sm font-bold text-app-foreground">{form.supplierName}</span>
 <button
 onClick={() => { setForm(f => ({ ...f, supplierId: null, supplierName: '', supplierInvoiceId: null, supplierInvoiceRef: '' })); setInvoices([]); }}
 className="text-app-muted-foreground hover:text-app-error transition-colors"
 >
 <X size={14} />
 </button>
 </div>
 ) : (
 <div className="relative">
 <input
 value={contactQuery}
 onChange={(e) => {
 setContactQuery(e.target.value);
 setShowContactDropdown(true);
 searchContacts(e.target.value, 'SUPPLIER');
 }}
 onFocus={() => { if (contactQuery.length > 0) setShowContactDropdown(true); }}
 placeholder="🔍 Search supplier by name or phone..."
 className="w-full px-3 py-2 border border-app-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
 />
 {showContactDropdown && contactResults.length > 0 && (
 <div className="absolute z-50 w-full mt-1 bg-app-surface border border-app-border rounded-xl shadow-xl max-h-40 overflow-y-auto">
 {contactResults.map(c => (
 <button
 key={c.id}
 onClick={() => selectContact(c, true)}
 className="w-full px-3 py-2 text-left hover:bg-app-warning-bg transition-colors flex items-center justify-between text-sm border-b border-app-border last:border-0"
 >
 <div>
 <span className="font-bold text-app-foreground">{c.name}</span>
 {c.phone && <span className="text-app-muted-foreground ml-2 text-xs">{c.phone}</span>}
 </div>
 {c.balance !== 0 && (
 <span className={clsx("text-xs font-bold", c.balance > 0 ? 'text-app-error' : 'text-app-primary')}>
 {currency}{Math.abs(c.balance).toFixed(0)}
 </span>
 )}
 </button>
 ))}
 </div>
 )}
 {contactSearching && (
 <div className="absolute right-3 top-2.5"><Loader2 size={14} className="animate-spin text-app-muted-foreground" /></div>
 )}
 </div>
 )}
 </div>
 )}

 {/* ── CLIENT SELECTOR (live search from database) ── */}
 {(selectedType.fields?.includes('client') || false) && (
 <div className="space-y-2">
 <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest block">
 <Users size={8} className="inline mr-0.5" /> Select Client
 </label>
 {form.clientId ? (
 <div className="flex items-center justify-between bg-app-primary-light border border-app-success rounded-xl px-3 py-2">
 <span className="text-sm font-bold text-app-foreground">{form.clientName}</span>
 <button
 onClick={() => { setForm(f => ({ ...f, clientId: null, clientName: '', clientInvoiceId: null, clientInvoiceRef: '' })); setInvoices([]); }}
 className="text-app-muted-foreground hover:text-app-error transition-colors"
 >
 <X size={14} />
 </button>
 </div>
 ) : (
 <div className="relative">
 <input
 value={contactQuery}
 onChange={(e) => {
 setContactQuery(e.target.value);
 setShowContactDropdown(true);
 searchContacts(e.target.value, 'CUSTOMER');
 }}
 onFocus={() => { if (contactQuery.length > 0) setShowContactDropdown(true); }}
 placeholder="🔍 Search client by name or phone..."
 className="w-full px-3 py-2 border border-app-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-200"
 />
 {showContactDropdown && contactResults.length > 0 && (
 <div className="absolute z-50 w-full mt-1 bg-app-surface border border-app-border rounded-xl shadow-xl max-h-40 overflow-y-auto">
 {contactResults.map(c => (
 <button
 key={c.id}
 onClick={() => selectContact(c, false)}
 className="w-full px-3 py-2 text-left hover:bg-app-primary-light transition-colors flex items-center justify-between text-sm border-b border-app-border last:border-0"
 >
 <div>
 <span className="font-bold text-app-foreground">{c.name}</span>
 {c.phone && <span className="text-app-muted-foreground ml-2 text-xs">{c.phone}</span>}
 </div>
 {c.balance !== 0 && (
 <span className={clsx("text-xs font-bold", c.balance > 0 ? 'text-app-primary' : 'text-app-error')}>
 {currency}{Math.abs(c.balance).toFixed(0)}
 </span>
 )}
 </button>
 ))}
 </div>
 )}
 {contactSearching && (
 <div className="absolute right-3 top-2.5"><Loader2 size={14} className="animate-spin text-app-muted-foreground" /></div>
 )}
 </div>
 )}
 </div>
 )}

 {/* ── UNPAID INVOICES (auto-loaded for selected contact) ── */}
 {(selectedType.fields?.includes('invoice') || false) && (form.supplierId || form.clientId) && (
 <div className="space-y-1.5">
 <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest block">
 <Receipt size={8} className="inline mr-0.5" /> Link to Unpaid Invoice (optional)
 </label>
 {invoicesLoading ? (
 <div className="flex items-center gap-2 text-xs text-app-muted-foreground py-2">
 <Loader2 size={12} className="animate-spin" /> Loading invoices...
 </div>
 ) : invoices.length === 0 ? (
 <p className="text-[10px] text-app-muted-foreground italic py-1">No unpaid invoices found for this contact</p>
 ) : (
 <div className="space-y-1 max-h-32 overflow-y-auto">
 {invoices.map(inv => {
 const isSelected = (form.supplierInvoiceId === inv.id || form.clientInvoiceId === inv.id);
 const isSupplier = !!form.supplierId;
 return (
 <button
 key={inv.id}
 onClick={() => selectInvoice(inv, isSupplier)}
 className={clsx(
 "w-full px-3 py-2 rounded-lg border text-left flex items-center justify-between transition-all text-xs",
 isSelected
 ? 'bg-app-warning-bg border-app-warning ring-2 ring-amber-100'
 : 'bg-app-surface border-app-border hover:border-app-border'
 )}
 >
 <div>
 <span className="font-bold text-app-foreground">{inv.invoiceNumber}</span>
 <span className="text-app-muted-foreground ml-1.5">
 {inv.status === 'PARTIAL_PAID' ? '(partial)' : inv.status === 'OVERDUE' ? '(overdue!)' : ''}
 </span>
 {inv.dueDate && <span className="text-app-muted-foreground ml-1 text-[9px]">due {inv.dueDate}</span>}
 </div>
 <div className="text-right">
 <span className="font-black text-app-error">{currency}{inv.balanceDue.toFixed(0)}</span>
 {inv.paidAmount > 0 && (
 <span className="text-[9px] text-app-muted-foreground block">
 paid {currency}{inv.paidAmount.toFixed(0)} / {currency}{inv.totalAmount.toFixed(0)}
 </span>
 )}
 </div>
 </button>
 );
 })}
 </div>
 )}
 </div>
 )}

 {/* ── EXPENSE CATEGORY ── */}
 {(selectedType.fields?.includes('expense_category') || false) && (
 <div className="space-y-2">
 <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest block mb-1.5">
 Expense Category
 </label>
 <input
 value={form.expenseCategory}
 onChange={(e) => setForm(f => ({ ...f, expenseCategory: e.target.value }))}
 list="expense-categories"
 placeholder="Select or type an expense category..."
 className="w-full px-3 py-2 border border-app-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
 />
 <datalist id="expense-categories">
 {expenseCategories.map(cat => (
 <option key={cat.id} value={cat.name} />
 ))}
 </datalist>
 </div>
 )}

 {/* ── PARTNER SELECTOR (live search from database) ── */}
 {(selectedType.fields?.includes('partner') || false) && (
 <div className="space-y-2">
 <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest block">
 <Users size={8} className="inline mr-0.5" /> Select Partner / Owner
 </label>
 {form.partnerId ? (
 <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
 <span className="text-sm font-bold text-app-foreground">{form.partnerName}</span>
 <button
 onClick={() => setForm(f => ({ ...f, partnerId: null, partnerName: '' }))}
 className="text-app-muted-foreground hover:text-app-error transition-colors"
 >
 <X size={14} />
 </button>
 </div>
 ) : (
 <div className="relative">
 <input
 value={contactQuery}
 onChange={(e) => {
 setContactQuery(e.target.value);
 setShowContactDropdown(true);
 searchContacts(e.target.value, 'PARTNER' as any);
 }}
 onFocus={() => { if (contactQuery.length > 0) setShowContactDropdown(true); }}
 placeholder="🔍 Search partner / owner by name..."
 className="w-full px-3 py-2 border border-app-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-200"
 />
 {showContactDropdown && contactResults.length > 0 && (
 <div className="absolute z-50 w-full mt-1 bg-app-surface border border-app-border rounded-xl shadow-xl max-h-40 overflow-y-auto">
 {contactResults.map(c => (
 <button
 key={c.id}
 onClick={() => {
 setForm(f => ({ ...f, partnerId: c.id, partnerName: c.name }));
 setShowContactDropdown(false);
 setContactQuery('');
 setContactResults([]);
 }}
 className="w-full px-3 py-2 text-left hover:bg-violet-50 transition-colors flex items-center justify-between text-sm border-b border-app-border last:border-0"
 >
 <div>
 <span className="font-bold text-app-foreground">{c.name}</span>
 {c.phone && <span className="text-app-muted-foreground ml-2 text-xs">{c.phone}</span>}
 </div>
 <span className="text-[9px] font-bold text-violet-400 uppercase">Partner</span>
 </button>
 ))}
 </div>
 )}
 {contactSearching && (
 <div className="absolute right-3 top-2.5"><Loader2 size={14} className="animate-spin text-app-muted-foreground" /></div>
 )}
 </div>
 )}
 </div>
 )}

 {/* ── ORDER REF ── */}
 {(selectedType.fields?.includes('order') || false) && (
 <input
 value={form.linkedOrderRef}
 onChange={(e) => setForm(f => ({ ...f, linkedOrderRef: e.target.value }))}
 placeholder="Original order reference"
 className="w-full px-3 py-2 border border-app-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
 />
 )}

 {/* Submit */}
 <button
 onClick={handleAdd}
 disabled={saving || !form.description.trim() || !form.amount}
 className={clsx(
 "w-full py-2.5 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg text-app-foreground",
 selectedType.dir === 'IN'
 ? 'bg-app-primary hover:bg-app-primary shadow-emerald-100'
 : 'bg-app-error hover:bg-app-error shadow-rose-100',
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
 className="w-full py-3 bg-app-warning text-app-foreground rounded-xl font-black text-sm hover:bg-app-warning transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-100"
 >
 <Plus size={14} />
 New Entry
 </button>
 <p className="text-center text-[9px] text-app-muted-foreground mt-2">
 <AlertTriangle size={8} className="inline text-app-warning" /> Entries require manager approval • You are responsible for accuracy
 </p>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
