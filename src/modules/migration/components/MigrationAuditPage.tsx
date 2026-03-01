'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAllMigrationRecords, approveMigrationEntity } from '../actions';
import {
    ArrowLeft, Loader2, CheckCircle2, AlertTriangle,
    ChevronLeft, ChevronRight, Database,
    ArrowRight, Eye, Search, Layers, Package,
    Users, Banknote, ShoppingCart, Tag, Ruler,
    Building2, Globe, X
} from 'lucide-react';
import { toast } from 'sonner';

// Entity display metadata
const ENTITY_LABELS: Record<string, string> = {
    UNIT: "Units of Measure", CATEGORY: "Categories", BRAND: "Brands",
    PRODUCT: "Products", CONTACT: "Contacts", TRANSACTION: "Transactions",
    ORDER_LINE: "Order Lines", ACCOUNT: "Financial Accounts",
    ACCOUNT_TRANSACTION: "Account Transactions", TAX_RATE: "Tax Rates",
    EXPENSE: "Expenses", PAYMENT: "Payments",
    STOCK_ADJUSTMENT: "Stock Adjustments", STOCK_TRANSFER: "Stock Transfers",
    JOURNAL_ENTRY: "Journal Entries", INVENTORY: "Inventory",
};

const ENTITY_ICONS: Record<string, any> = {
    UNIT: Ruler, CATEGORY: Layers, BRAND: Tag, PRODUCT: Package,
    CONTACT: Users, TRANSACTION: ShoppingCart, ORDER_LINE: ShoppingCart,
    ACCOUNT: Banknote, ACCOUNT_TRANSACTION: Banknote,
    EXPENSE: Banknote, PAYMENT: Banknote,
    STOCK_ADJUSTMENT: Package, STOCK_TRANSFER: Package,
    JOURNAL_ENTRY: Database, INVENTORY: Package,
};

const SOURCE_KEY_LABELS: Record<string, string> = {
    name: 'Name', first_name: 'First Name', last_name: 'Last Name',
    type: 'Type', amount: 'Amount', total: 'Total', price: 'Price',
    selling_price: 'Selling Price', purchase_price: 'Purchase Price',
    tax_rate: 'Tax Rate', status: 'Status', payment_method: 'Payment Method',
    phone: 'Phone', email: 'Email', address: 'Address',
    balance: 'Balance', opening_balance: 'Opening Balance',
    currency: 'Currency', reference: 'Reference', date: 'Date',
    transaction_date: 'Transaction Date', final_total: 'Total (TTC)',
    contact_id: 'Contact ID', sku: 'SKU', barcode: 'Barcode',
    unit_short_name: 'Unit', category_name: 'Category',
    brand_name: 'Brand', account_name: 'Account',
};

// Get a human-readable label for a source key
function getKeyLabel(key: string): string {
    return SOURCE_KEY_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Render a value nicely
function renderValue(val: any): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'number') return val.toLocaleString();
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
}

// Keys to always exclude from display
const EXCLUDE_KEYS = new Set([
    'created_at', 'updated_at', 'deleted_at', 'id', 'organization_id',
    'created_by', 'updated_by', 'organization', 'is_deleted',
]);

export function MigrationAuditPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const jobId = Number(searchParams.get('jobId') || 0);
    const entityType = searchParams.get('entityType') || 'TRANSACTION';
    const entityLabel = ENTITY_LABELS[entityType] || entityType;
    const Icon = ENTITY_ICONS[entityType] || Database;

    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const [searchFilter, setSearchFilter] = useState('');
    const [approving, setApproving] = useState(false);

    const fetchRecords = useCallback(async (p: number) => {
        if (!jobId) return;
        setLoading(true);
        try {
            const data = await getAllMigrationRecords(jobId, entityType, p, 50);
            setRecords(data?.records || []);
            setTotalPages(data?.total_pages || 1);
            setTotalCount(data?.total || 0);
            setPage(p);
        } catch (err) {
            toast.error('Failed to load records');
        } finally {
            setLoading(false);
        }
    }, [jobId, entityType]);

    useEffect(() => { fetchRecords(1); }, [fetchRecords]);

    const handleBulkApprove = async () => {
        if (!confirm(`Approve ALL draft ${entityLabel}? This will mark them as completed/posted.`)) return;
        setApproving(true);
        try {
            await approveMigrationEntity(jobId, entityType);
            toast.success(`${entityLabel} approved successfully`);
            fetchRecords(page);
        } catch {
            toast.error('Approval failed');
        } finally {
            setApproving(false);
        }
    };

    // Get important keys from source data
    const getSourceKeys = (source: any): string[] => {
        if (!source || typeof source !== 'object') return [];
        return Object.keys(source).filter(k => !EXCLUDE_KEYS.has(k));
    };

    // Get important keys from target data
    const getTargetKeys = (target: any): string[] => {
        if (!target || typeof target !== 'object') return [];
        return Object.keys(target).filter(k => !EXCLUDE_KEYS.has(k) && k !== 'error');
    };

    // Filter records by search
    const filteredRecords = searchFilter
        ? records.filter(r => {
            const src = JSON.stringify(r.source_raw || {}).toLowerCase();
            const tgt = JSON.stringify(r.target_state || {}).toLowerCase();
            return src.includes(searchFilter.toLowerCase()) || tgt.includes(searchFilter.toLowerCase());
        })
        : records;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50">
            {/* ═══════ HEADER ═══════ */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/migration')}
                                className="h-10 w-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all active:scale-95"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center border border-emerald-200/50 shadow-sm">
                                    <Icon className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-black text-gray-900 tracking-tight">
                                        Migration Audit: {entityLabel}
                                    </h1>
                                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                                        {totalCount.toLocaleString()} records ·  Job #{jobId} · Side-by-side comparison
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Filter records..."
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                    className="pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 w-64 transition-all placeholder:text-gray-300"
                                />
                                {searchFilter && (
                                    <button onClick={() => setSearchFilter('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={handleBulkApprove}
                                disabled={approving}
                                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Bulk Approve
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════ TABLE ═══════ */}
            <div className="max-w-[1600px] mx-auto px-6 py-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                        <p className="text-gray-400 font-bold text-sm">Loading {entityLabel}...</p>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <Database className="w-12 h-12 text-gray-200" />
                        <p className="text-gray-400 font-bold">No records found</p>
                    </div>
                ) : (
                    <>
                        {/* Column Headers */}
                        <div className="grid grid-cols-[60px_1fr_40px_1fr] gap-0 mb-3 px-2">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">#</div>
                            <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                Source / Imported Data
                            </div>
                            <div />
                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                TSF System Data
                            </div>
                        </div>

                        {/* Records */}
                        <div className="space-y-2">
                            {filteredRecords.map((record, idx) => {
                                const sourceKeys = getSourceKeys(record.source_raw);
                                const targetKeys = getTargetKeys(record.target_state);
                                const isExpanded = expandedRow === idx;
                                const displaySourceKeys = isExpanded ? sourceKeys : sourceKeys.slice(0, 6);
                                const displayTargetKeys = isExpanded ? targetKeys : targetKeys.slice(0, 6);
                                const hasError = record.target_state?.error;
                                const rowNum = (page - 1) * 50 + idx + 1;

                                return (
                                    <div
                                        key={record.mapping_id || idx}
                                        className={`grid grid-cols-[60px_1fr_40px_1fr] gap-0 border rounded-2xl transition-all hover:shadow-md cursor-pointer group ${hasError
                                                ? 'bg-red-50/50 border-red-200 hover:border-red-300'
                                                : 'bg-white border-gray-100 hover:border-emerald-200'
                                            }`}
                                        onClick={() => setExpandedRow(isExpanded ? null : idx)}
                                    >
                                        {/* Row Number */}
                                        <div className="flex flex-col items-center justify-center py-4 border-r border-gray-100/50">
                                            <span className="text-lg font-black text-gray-200 group-hover:text-gray-400 transition-colors">{rowNum}</span>
                                            <span className="text-[8px] font-bold text-gray-300 mt-0.5">SRC:{record.source_id || '?'}</span>
                                            <span className="text-[8px] font-bold text-emerald-400 mt-0.5">TSF:{record.target_id}</span>
                                        </div>

                                        {/* SOURCE COLUMN */}
                                        <div className="p-4 border-r border-gray-100/50 bg-amber-50/20">
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                                {displaySourceKeys.map(key => (
                                                    <div key={key} className="min-w-0">
                                                        <p className="text-[9px] font-bold text-amber-500/70 uppercase tracking-tight truncate">{getKeyLabel(key)}</p>
                                                        <p className="text-[12px] font-bold text-gray-800 truncate mt-0.5" title={renderValue(record.source_raw[key])}>
                                                            {renderValue(record.source_raw[key])}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                            {!isExpanded && sourceKeys.length > 6 && (
                                                <p className="text-[9px] text-amber-400 font-bold mt-2 italic">+{sourceKeys.length - 6} more fields...</p>
                                            )}
                                        </div>

                                        {/* Arrow Divider */}
                                        <div className="flex items-center justify-center bg-gray-50/50">
                                            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-400 transition-colors" />
                                        </div>

                                        {/* TARGET COLUMN */}
                                        <div className="p-4 bg-emerald-50/20">
                                            {hasError ? (
                                                <div className="flex items-center gap-2 text-red-500">
                                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                                    <span className="text-xs font-bold">{record.target_state.error}</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                                        {displayTargetKeys.map(key => (
                                                            <div key={key} className="min-w-0">
                                                                <p className="text-[9px] font-bold text-emerald-500/70 uppercase tracking-tight truncate">{getKeyLabel(key)}</p>
                                                                <p className="text-[12px] font-bold text-gray-800 truncate mt-0.5" title={renderValue(record.target_state[key])}>
                                                                    {renderValue(record.target_state[key])}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {!isExpanded && targetKeys.length > 6 && (
                                                        <p className="text-[9px] text-emerald-400 font-bold mt-2 italic">+{targetKeys.length - 6} more fields...</p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ═══════ PAGINATION ═══════ */}
                        <div className="flex items-center justify-between mt-8 px-2">
                            <p className="text-xs font-bold text-gray-400">
                                Showing {(page - 1) * 50 + 1} – {Math.min(page * 50, totalCount)} of {totalCount.toLocaleString()} records
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => fetchRecords(page - 1)}
                                    disabled={page <= 1}
                                    className="h-10 w-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-sm font-bold text-gray-600 px-3">
                                    Page {page} / {totalPages}
                                </span>
                                <button
                                    onClick={() => fetchRecords(page + 1)}
                                    disabled={page >= totalPages}
                                    className="h-10 w-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
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
