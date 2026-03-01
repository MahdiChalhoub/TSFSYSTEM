'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAllMigrationRecords, getAuditSummary, bulkLinkLedger, approveMigrationEntity } from '../actions';
import {
    ArrowLeft, Loader2, CheckCircle2, AlertTriangle, XCircle,
    ChevronLeft, ChevronRight, Database, Link2, Unlink,
    ArrowRight, Search, Layers, Package,
    Users, Banknote, ShoppingCart, Tag, Ruler,
    BookOpen, X, Shield, Zap, FileText
} from 'lucide-react';
import { toast } from 'sonner';

const ENTITY_LABELS: Record<string, string> = {
    UNIT: "Units of Measure", CATEGORY: "Categories", BRAND: "Brands",
    PRODUCT: "Products", CONTACT: "Contacts", TRANSACTION: "Transactions",
    ORDER_LINE: "Order Lines", ACCOUNT: "Financial Accounts",
    EXPENSE: "Expenses", PAYMENT: "Payments",
    STOCK_ADJUSTMENT: "Stock Adjustments", STOCK_TRANSFER: "Stock Transfers",
    JOURNAL_ENTRY: "Journal Entries", INVENTORY: "Inventory",
};

const ENTITY_ICONS: Record<string, any> = {
    UNIT: Ruler, CATEGORY: Layers, BRAND: Tag, PRODUCT: Package,
    CONTACT: Users, TRANSACTION: ShoppingCart, ORDER_LINE: ShoppingCart,
    ACCOUNT: Banknote, EXPENSE: Banknote, PAYMENT: Banknote,
    STOCK_ADJUSTMENT: Package, STOCK_TRANSFER: Package,
    JOURNAL_ENTRY: Database, INVENTORY: Package,
};

export function MigrationAuditPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const jobId = Number(searchParams.get('jobId') || 0);
    const entityType = searchParams.get('entityType') || 'TRANSACTION';
    const entityLabel = ENTITY_LABELS[entityType] || entityType;
    const Icon = ENTITY_ICONS[entityType] || Database;

    const [records, setRecords] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const [searchFilter, setSearchFilter] = useState('');
    const [processing, setProcessing] = useState(false);

    const fetchSummary = useCallback(async () => {
        if (!jobId) return;
        setLoadingSummary(true);
        try {
            const data = await getAuditSummary(jobId, entityType);
            setSummary(data);
        } catch { }
        setLoadingSummary(false);
    }, [jobId, entityType]);

    const fetchRecords = useCallback(async (p: number) => {
        if (!jobId) return;
        setLoading(true);
        try {
            const data = await getAllMigrationRecords(jobId, entityType, p, 30);
            setRecords(data?.records || []);
            setTotalPages(data?.total_pages || 1);
            setTotalCount(data?.total || 0);
            setPage(p);
        } catch {
            toast.error('Failed to load records');
        }
        setLoading(false);
    }, [jobId, entityType]);

    useEffect(() => { fetchSummary(); fetchRecords(1); }, [fetchSummary, fetchRecords]);

    const handleBulkApprove = async () => {
        if (!confirm(`Approve ALL draft ${entityLabel}?`)) return;
        setProcessing(true);
        try {
            await approveMigrationEntity(jobId, entityType);
            toast.success(`${entityLabel} approved`);
            fetchSummary(); fetchRecords(page);
        } catch { toast.error('Failed'); }
        setProcessing(false);
    };

    const handleLinkContacts = async (contactType: string) => {
        if (!confirm(`Auto-link ALL ${contactType} contacts to ledger using posting rules?`)) return;
        setProcessing(true);
        try {
            const res = await bulkLinkLedger(jobId, contactType);
            toast.success(`${res?.linked || 0} ${contactType}s linked → ${res?.coa_parent_code || ''} ${res?.coa_parent || 'account'}`);
            fetchSummary(); fetchRecords(page);
        } catch { toast.error('Link failed'); }
        setProcessing(false);
    };

    const filteredRecords = searchFilter
        ? records.filter(r => {
            const src = JSON.stringify(r.source_raw || {}).toLowerCase();
            const tgt = JSON.stringify(r.target_state || {}).toLowerCase();
            return src.includes(searchFilter.toLowerCase()) || tgt.includes(searchFilter.toLowerCase());
        })
        : records;

    const diag = summary?.diagnostics || {};

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50">
            {/* ═══════ STICKY HEADER ═══════ */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.push('/migration')} className="h-10 w-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all active:scale-95">
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center border border-emerald-200/50">
                                    <Icon className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-black text-gray-900 tracking-tight">Migration Audit: {entityLabel}</h1>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{totalCount.toLocaleString()} records · Job #{jobId}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input type="text" placeholder="Filter..." value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)}
                                    className="pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:border-emerald-400 w-48 transition-all placeholder:text-gray-300" />
                                {searchFilter && <button onClick={() => setSearchFilter('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X className="w-4 h-4" /></button>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto px-6 py-5 space-y-5">
                {/* ═══════ STRATEGY DASHBOARD ═══════ */}
                {loadingSummary ? (
                    <div className="flex items-center gap-3 p-6 bg-white rounded-2xl border border-gray-100">
                        <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                        <span className="text-sm text-gray-400 font-bold">Loading diagnostics...</span>
                    </div>
                ) : summary && (
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white">
                            <div className="flex items-center gap-3 mb-3">
                                <Shield className="w-5 h-5 text-emerald-400" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-emerald-400">Audit Strategy Panel</h2>
                            </div>
                            <p className="text-xs text-white/50 font-medium">Diagnose issues and take bulk actions on all {entityLabel}.</p>
                        </div>

                        {/* CONTACTS Strategy */}
                        {entityType === 'CONTACT' && (
                            <div className="p-5 space-y-4">
                                {/* Stats Row */}
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                    {[
                                        { label: 'Customers', value: diag.customers || 0, color: 'text-blue-600', bg: 'bg-blue-50' },
                                        { label: 'Suppliers', value: diag.suppliers || 0, color: 'text-purple-600', bg: 'bg-purple-50' },
                                        { label: 'Both', value: diag.both || 0, color: 'text-amber-600', bg: 'bg-amber-50' },
                                        { label: 'Linked to Ledger', value: diag.linked_to_ledger || 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                        { label: 'NOT Linked', value: diag.not_linked || 0, color: diag.not_linked > 0 ? 'text-red-600' : 'text-gray-400', bg: diag.not_linked > 0 ? 'bg-red-50' : 'bg-gray-50' },
                                    ].map(s => (
                                        <div key={s.label} className={`${s.bg} p-3 rounded-xl border border-gray-100`}>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{s.label}</p>
                                            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Warning if not linked */}
                                {(diag.not_linked || 0) > 0 && (
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-bold text-red-700">{diag.not_linked} contacts have NO ledger sub-account</p>
                                            <p className="text-xs text-red-500 mt-1">These contacts cannot record financial transactions in the ledger. Use the actions below to link them.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Bulk Link Actions — Auto-resolved from posting rules */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* CUSTOMERS */}
                                    <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/30">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Users className="w-4 h-4 text-blue-600" />
                                            <span className="text-xs font-black text-blue-700 uppercase tracking-wider">Customers → Accounts Receivable</span>
                                        </div>
                                        <p className="text-[11px] text-blue-500 mb-3">Creates a COA child sub-account (e.g., <code className="bg-blue-100 px-1 rounded">1110-0001</code>) for each customer under the Accounts Receivable parent, using your posting rules.</p>
                                        <button onClick={() => handleLinkContacts('CUSTOMER')} disabled={processing}
                                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg disabled:opacity-30 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                                            {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                                            Auto-Link {summary?.actions_available?.find((a: any) => a.key === 'link_customers')?.count || diag.customers || 0} Customers
                                        </button>
                                    </div>

                                    {/* SUPPLIERS */}
                                    <div className="border border-purple-200 rounded-xl p-4 bg-purple-50/30">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Users className="w-4 h-4 text-purple-600" />
                                            <span className="text-xs font-black text-purple-700 uppercase tracking-wider">Suppliers → Accounts Payable</span>
                                        </div>
                                        <p className="text-[11px] text-purple-500 mb-3">Creates a COA child sub-account (e.g., <code className="bg-purple-100 px-1 rounded">2101-0001</code>) for each supplier under the Accounts Payable parent, using your posting rules.</p>
                                        <button onClick={() => handleLinkContacts('SUPPLIER')} disabled={processing}
                                            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-black rounded-lg disabled:opacity-30 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20">
                                            {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                                            Auto-Link {summary?.actions_available?.find((a: any) => a.key === 'link_suppliers')?.count || diag.suppliers || 0} Suppliers
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TRANSACTIONS Strategy */}
                        {entityType === 'TRANSACTION' && (
                            <div className="p-5 space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                    {[
                                        { label: 'Completed', value: diag.completed || 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                        { label: 'Draft', value: diag.draft || 0, color: diag.draft > 0 ? 'text-amber-600' : 'text-gray-400', bg: diag.draft > 0 ? 'bg-amber-50' : 'bg-gray-50' },
                                        { label: 'With Journal Entry', value: diag.with_journal_entry || 0, color: 'text-blue-600', bg: 'bg-blue-50' },
                                        { label: 'Missing Journal', value: diag.missing_journal_entry || 0, color: diag.missing_journal_entry > 0 ? 'text-red-600' : 'text-emerald-600', bg: diag.missing_journal_entry > 0 ? 'bg-red-50' : 'bg-emerald-50' },
                                        { label: 'Journal Rate', value: `${diag.journal_rate || 0}%`, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                                    ].map(s => (
                                        <div key={s.label} className={`${s.bg} p-3 rounded-xl border border-gray-100`}>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{s.label}</p>
                                            <p className={`text-2xl font-black ${s.color}`}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {(diag.missing_journal_entry || 0) > 0 && (
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                        <BookOpen className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-bold text-red-700">{(diag.missing_journal_entry || 0).toLocaleString()} transactions have NO journal entry</p>
                                            <p className="text-xs text-red-500 mt-1">These transactions are not recorded in the ledger. They need to be posted to create proper journal vouchers.</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    {(diag.draft || 0) > 0 && (
                                        <button onClick={handleBulkApprove} disabled={processing}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50">
                                            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                            Approve {diag.draft} Draft Transactions
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ACCOUNT Strategy */}
                        {entityType === 'ACCOUNT' && (
                            <div className="p-5 space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-emerald-50 p-3 rounded-xl border border-gray-100">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Linked to COA</p>
                                        <p className="text-2xl font-black text-emerald-600">{diag.linked_to_coa || 0}</p>
                                    </div>
                                    <div className={`${(diag.not_linked || 0) > 0 ? 'bg-red-50' : 'bg-gray-50'} p-3 rounded-xl border border-gray-100`}>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Not Linked</p>
                                        <p className={`text-2xl font-black ${(diag.not_linked || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{diag.not_linked || 0}</p>
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded-xl border border-gray-100">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Link Rate</p>
                                        <p className="text-2xl font-black text-blue-600">{diag.link_rate || 0}%</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PRODUCT / EXPENSE Strategy */}
                        {(entityType === 'PRODUCT' || entityType === 'EXPENSE') && (
                            <div className="p-5 space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className={`${(diag.draft || 0) > 0 ? 'bg-amber-50' : 'bg-gray-50'} p-3 rounded-xl border border-gray-100`}>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Draft</p>
                                        <p className={`text-2xl font-black ${(diag.draft || 0) > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{diag.draft || 0}</p>
                                    </div>
                                    <div className="bg-emerald-50 p-3 rounded-xl border border-gray-100">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{entityType === 'PRODUCT' ? 'Active' : 'Posted'}</p>
                                        <p className="text-2xl font-black text-emerald-600">{diag.active || diag.posted || 0}</p>
                                    </div>
                                    <div className="p-3 rounded-xl border border-gray-100">
                                        {(diag.draft || 0) > 0 && (
                                            <button onClick={handleBulkApprove} disabled={processing}
                                                className="w-full h-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50">
                                                <Zap className="w-4 h-4" />
                                                Bulk Approve
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════ RECORDS TABLE ═══════ */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                        <p className="text-gray-400 font-bold text-sm">Loading {entityLabel}...</p>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Database className="w-12 h-12 text-gray-200" />
                        <p className="text-gray-400 font-bold">No records found</p>
                    </div>
                ) : (
                    <>
                        {/* Column Headers */}
                        <div className="grid grid-cols-[50px_1fr_40px_1fr] gap-0 px-3">
                            <div />
                            <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                Source / Imported Data
                            </div>
                            <div />
                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                TSF System — How It Was Saved
                            </div>
                        </div>

                        <div className="space-y-2">
                            {filteredRecords.map((record, idx) => {
                                const isExpanded = expandedRow === idx;
                                const rowNum = (page - 1) * 30 + idx + 1;
                                const target = record.target_state || {};
                                const source = record.source_raw || {};
                                const hasError = target.error;

                                return (
                                    <div key={record.mapping_id || idx}
                                        className={`grid grid-cols-[50px_1fr_40px_1fr] border rounded-2xl transition-all hover:shadow-md cursor-pointer group ${hasError ? 'bg-red-50/50 border-red-200' : 'bg-white border-gray-100 hover:border-emerald-200'}`}
                                        onClick={() => setExpandedRow(isExpanded ? null : idx)}>

                                        {/* Row # */}
                                        <div className="flex flex-col items-center justify-center py-3 border-r border-gray-100/50 text-center">
                                            <span className="text-sm font-black text-gray-200 group-hover:text-gray-400">{rowNum}</span>
                                        </div>

                                        {/* SOURCE */}
                                        <div className="p-3 border-r border-gray-100/50 bg-amber-50/20">
                                            {renderSourcePanel(entityType, source, isExpanded)}
                                        </div>

                                        {/* Arrow */}
                                        <div className="flex items-center justify-center bg-gray-50/30">
                                            <ArrowRight className="w-4 h-4 text-gray-200 group-hover:text-emerald-400 transition-colors" />
                                        </div>

                                        {/* TARGET */}
                                        <div className="p-3 bg-emerald-50/20">
                                            {hasError ? (
                                                <div className="flex items-center gap-2 text-red-500">
                                                    <XCircle className="w-4 h-4 shrink-0" />
                                                    <span className="text-xs font-bold">{target.error}</span>
                                                </div>
                                            ) : renderTargetPanel(entityType, target, isExpanded)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* PAGINATION */}
                        <div className="flex items-center justify-between mt-6 px-2">
                            <p className="text-xs font-bold text-gray-400">
                                {(page - 1) * 30 + 1} – {Math.min(page * 30, totalCount)} of {totalCount.toLocaleString()}
                            </p>
                            <div className="flex items-center gap-2">
                                <button onClick={() => fetchRecords(page - 1)} disabled={page <= 1}
                                    className="h-9 w-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-all">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-xs font-bold text-gray-500 px-2">Page {page}/{totalPages}</span>
                                <button onClick={() => fetchRecords(page + 1)} disabled={page >= totalPages}
                                    className="h-9 w-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-all">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ── Entity-Specific Source Panel ──────────────────────────────────────────────
function renderSourcePanel(entityType: string, source: any, expanded: boolean) {
    const keys = Object.keys(source).filter(k => !['id', 'created_at', 'updated_at'].includes(k));
    if (keys.length === 0) {
        return <p className="text-xs text-gray-300 italic">No source data stored</p>;
    }

    const displayKeys = expanded ? keys : keys.slice(0, 5);
    return (
        <div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
                {displayKeys.map(key => (
                    <div key={key} className="min-w-0">
                        <p className="text-[8px] font-bold text-amber-500/60 uppercase tracking-tight truncate">{key.replace(/_/g, ' ')}</p>
                        <p className="text-[11px] font-bold text-gray-700 truncate">{renderVal(source[key])}</p>
                    </div>
                ))}
            </div>
            {!expanded && keys.length > 5 && <p className="text-[9px] text-amber-400 font-bold mt-1.5 italic">+{keys.length - 5} more...</p>}
        </div>
    );
}

// ── Entity-Specific Target Panel ─────────────────────────────────────────────
function renderTargetPanel(entityType: string, target: any, expanded: boolean) {
    if (entityType === 'CONTACT') return <ContactTargetPanel target={target} expanded={expanded} />;
    if (entityType === 'TRANSACTION') return <TransactionTargetPanel target={target} expanded={expanded} />;
    if (entityType === 'ACCOUNT') return <AccountTargetPanel target={target} expanded={expanded} />;
    if (entityType === 'EXPENSE') return <ExpenseTargetPanel target={target} expanded={expanded} />;
    if (entityType === 'PRODUCT') return <ProductTargetPanel target={target} expanded={expanded} />;
    return <GenericTargetPanel target={target} expanded={expanded} />;
}

function ContactTargetPanel({ target, expanded }: { target: any; expanded: boolean }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-gray-900">{target.name}</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${target.type === 'CUSTOMER' ? 'bg-blue-100 text-blue-700' : target.type === 'SUPPLIER' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                    {target.type}
                </span>
                {target.has_ledger_link ? (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                        <Link2 className="w-3 h-3" /> LEDGER LINKED
                    </span>
                ) : (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                        <Unlink className="w-3 h-3" /> NO LEDGER
                    </span>
                )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {target.phone && <Field label="Phone" value={target.phone} />}
                {target.email && <Field label="Email" value={target.email} />}
                {target.company_name && <Field label="Company" value={target.company_name} />}
                {target.has_ledger_link && target.coa_parent_name && (
                    <Field label="COA Parent" value={`${target.coa_parent_code} – ${target.coa_parent_name}`} color="text-emerald-700" />
                )}
            </div>
        </div>
    );
}

function TransactionTargetPanel({ target, expanded }: { target: any; expanded: boolean }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-gray-900">{target.ref || `#${target.id}`}</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${target.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {target.status}
                </span>
                {target.has_journal ? (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> JOURNAL ✓
                    </span>
                ) : (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> NO JOURNAL
                    </span>
                )}
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                <Field label="Total TTC" value={Number(target.total_ttc || 0).toLocaleString()} color="text-emerald-700" />
                <Field label="Payment" value={target.payment_method || 'N/A'} />
                <Field label="Contact" value={target.contact_name || 'Walk-In'} />
                {target.date && <Field label="Date" value={target.date.substring(0, 10)} />}
                <Field label="Type" value={target.type || 'SALE'} />
            </div>
            {expanded && target.journal_entries?.length > 0 && (
                <div className="mt-2 bg-slate-900 rounded-xl p-3">
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2">Journal Voucher Entries</p>
                    <div className="space-y-1">
                        {target.journal_entries.map((je: any) => (
                            <div key={je.id} className="flex justify-between text-[10px]">
                                <span className="text-white/60 truncate max-w-[200px]">{je.description || `JE #${je.id}`}</span>
                                <div className="flex gap-3">
                                    <span className="text-blue-400 font-mono font-bold">DR {Number(je.total_debit || 0).toLocaleString()}</span>
                                    <span className="text-amber-400 font-mono font-bold">CR {Number(je.total_credit || 0).toLocaleString()}</span>
                                    <span className={`font-bold ${je.status === 'POSTED' ? 'text-emerald-400' : 'text-amber-400'}`}>{je.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function AccountTargetPanel({ target, expanded }: { target: any; expanded: boolean }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-gray-900">{target.name}</span>
                {target.is_linked_to_coa ? (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                        <Link2 className="w-3 h-3" /> {target.coa_code} {target.coa_name}
                    </span>
                ) : (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                        <Unlink className="w-3 h-3" /> NOT MAPPED
                    </span>
                )}
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                <Field label="Type" value={target.type} />
                <Field label="Currency" value={target.currency} />
                <Field label="Balance" value={Number(target.balance || 0).toLocaleString()} color="text-emerald-700" />
            </div>
        </div>
    );
}

function ExpenseTargetPanel({ target, expanded }: { target: any; expanded: boolean }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-gray-900">{target.reference || `#${target.id}`}</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${target.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {target.status}
                </span>
                {target.has_journal !== undefined && (target.has_journal ? (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">JOURNAL ✓</span>
                ) : (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">NO JOURNAL</span>
                ))}
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                <Field label="Amount" value={Number(target.amount || 0).toLocaleString()} color="text-red-600" />
                <Field label="Payment" value={target.payment_method || 'N/A'} />
                {target.date && <Field label="Date" value={target.date.substring(0, 10)} />}
            </div>
        </div>
    );
}

function ProductTargetPanel({ target, expanded }: { target: any; expanded: boolean }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-gray-900">{target.name}</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${target.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {target.status}
                </span>
                {target.product_type && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{target.product_type}</span>}
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                <Field label="Selling Price" value={Number(target.selling_price || 0).toLocaleString()} color="text-blue-600" />
                <Field label="Purchase Price" value={Number(target.purchase_price || 0).toLocaleString()} />
                {target.sku && <Field label="SKU" value={target.sku} />}
            </div>
        </div>
    );
}

function GenericTargetPanel({ target, expanded }: { target: any; expanded: boolean }) {
    const keys = Object.keys(target).filter(k => !['id', 'created_at', 'updated_at', 'organization_id'].includes(k));
    const displayKeys = expanded ? keys : keys.slice(0, 6);
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {displayKeys.map(key => <Field key={key} label={key.replace(/_/g, ' ')} value={renderVal(target[key])} />)}
            {!expanded && keys.length > 6 && <p className="text-[9px] text-emerald-400 font-bold col-span-2 mt-1 italic">+{keys.length - 6} more...</p>}
        </div>
    );
}

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[8px] font-bold text-emerald-500/50 uppercase tracking-tight truncate">{label}</p>
            <p className={`text-[11px] font-bold truncate ${color || 'text-gray-800'}`} title={value}>{value || '—'}</p>
        </div>
    );
}

function renderVal(val: any): string {
    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'number') return val.toLocaleString();
    if (typeof val === 'object') return JSON.stringify(val).substring(0, 50);
    return String(val);
}
