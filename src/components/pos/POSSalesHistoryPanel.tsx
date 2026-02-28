'use client';
import { useState, useEffect, useCallback } from 'react';
import { erpFetch } from '@/lib/erp-api';
import {
    X, Search, RefreshCw, Receipt, User, Calendar,
    ChevronRight, Loader2, Hash, AlertCircle, Printer,
    CheckCircle2, Clock, XCircle, FileText, Package
} from 'lucide-react';
import clsx from 'clsx';

type Order = {
    id: number;
    ref_code: string;
    invoice_number?: string;
    created_at: string;
    type: string;
    contact_name?: string;
    status: string;
    total_amount: number;
    payment_method?: string;
    items?: { name: string; quantity: number; unit_price: number }[];
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    COMPLETED: { label: 'Completed', color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2 },
    INVOICED: { label: 'Invoiced', color: 'text-blue-600 bg-blue-50', icon: FileText },
    PENDING: { label: 'Pending', color: 'text-amber-600 bg-amber-50', icon: Clock },
    CANCELLED: { label: 'Cancelled', color: 'text-rose-600 bg-rose-50', icon: XCircle },
    DRAFT: { label: 'Draft', color: 'text-gray-500 bg-gray-100', icon: FileText },
};

interface POSSalesHistoryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    currency: string;
    registerName?: string;
    sessionId?: number | null;
}

export function POSSalesHistoryPanel({ isOpen, onClose, currency, registerName, sessionId }: POSSalesHistoryPanelProps) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [printingId, setPrintingId] = useState<number | null>(null);
    const [tab, setTab] = useState<'session' | 'all'>(sessionId ? 'session' : 'all');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const url = (tab === 'session' && sessionId)
                ? `pos/orders/?session=${sessionId}`
                : 'pos/orders/';
            const data = await erpFetch(url);
            setOrders(Array.isArray(data) ? data : data?.results || []);
        } catch {
            // silently fail
        }
        setLoading(false);
    }, [tab, sessionId]);

    useEffect(() => {
        if (isOpen) load();
    }, [isOpen, load, tab]);

    const fmt = (n: number) => `${currency} ${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    const filtered = orders.filter(o => {
        const q = search.toLowerCase();
        return !q || (o.ref_code || '').toLowerCase().includes(q) ||
            (o.contact_name || '').toLowerCase().includes(q) ||
            (o.invoice_number || '').toLowerCase().includes(q);
    });

    const handlePrint = async (order: Order) => {
        setPrintingId(order.id);
        try {
            const blob = await erpFetch(`pos/${order.id}/invoice-pdf/`);
            if (blob instanceof Blob) {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Invoice_${order.ref_code || order.id}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch { }
        setPrintingId(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[900] flex" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

            {/* Panel - slides in from right */}
            <div
                className="ml-auto relative w-[480px] max-w-full h-full bg-white flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                            <Receipt size={18} className="text-indigo-500" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-gray-900">Sales History</h2>
                            <p className="text-[10px] text-gray-400 font-medium">
                                {registerName ? `Register: ${registerName}` : 'All transactions'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={load} disabled={loading}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all disabled:opacity-40">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={onClose}
                            className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-rose-500 transition-all">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-4 pt-3 pb-0 border-b border-gray-50 shrink-0 flex gap-1">
                    {sessionId && (
                        <button onClick={() => setTab('session')}
                            className={clsx('px-3 py-1.5 rounded-t-lg text-[11px] font-black transition-all border-b-2',
                                tab === 'session'
                                    ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                                    : 'border-transparent text-gray-400 hover:text-gray-600')}>
                            This Session
                        </button>
                    )}
                    <button onClick={() => setTab('all')}
                        className={clsx('px-3 py-1.5 rounded-t-lg text-[11px] font-black transition-all border-b-2',
                            tab === 'all'
                                ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                                : 'border-transparent text-gray-400 hover:text-gray-600')}>
                        All History
                    </button>
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b border-gray-50 shrink-0">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by ref, client, invoice..."
                            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 font-medium placeholder:text-gray-300"
                        />
                    </div>
                </div>

                {/* Stats bar */}
                {!loading && orders.length > 0 && (
                    <div className="px-4 py-2 border-b border-gray-50 bg-gray-50/50 flex items-center gap-4 shrink-0">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Orders</p>
                            <p className="text-sm font-black text-gray-900">{orders.length}</p>
                        </div>
                        <div className="h-6 w-px bg-gray-200" />
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</p>
                            <p className="text-sm font-black text-emerald-600">
                                {fmt(orders.reduce((s, o) => s + Number(o.total_amount || 0), 0))}
                            </p>
                        </div>
                        <div className="h-6 w-px bg-gray-200" />
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Completed</p>
                            <p className="text-sm font-black text-gray-900">
                                {orders.filter(o => o.status === 'COMPLETED' || o.status === 'INVOICED').length}
                            </p>
                        </div>
                    </div>
                )}

                {/* Order List / Detail */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300">
                            <Loader2 size={28} className="animate-spin text-indigo-300" />
                            <p className="text-xs font-bold">Loading history...</p>
                        </div>
                    ) : selectedOrder ? (
                        /* ── ORDER DETAIL VIEW ── */
                        <div className="p-4 space-y-4">
                            <button onClick={() => setSelectedOrder(null)}
                                className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors">
                                <ChevronRight size={14} className="rotate-180" /> Back to list
                            </button>

                            {/* Order header */}
                            <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-lg font-black text-gray-900">#{selectedOrder.ref_code || selectedOrder.id}</p>
                                        {selectedOrder.invoice_number && (
                                            <p className="text-[10px] font-mono text-indigo-500 font-bold">{selectedOrder.invoice_number}</p>
                                        )}
                                    </div>
                                    {(() => {
                                        const cfg = STATUS_CONFIG[selectedOrder.status] || STATUS_CONFIG.DRAFT;
                                        const Icon = cfg.icon;
                                        return (
                                            <span className={clsx("flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg", cfg.color)}>
                                                <Icon size={10} /> {cfg.label}
                                            </span>
                                        );
                                    })()}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="flex items-center gap-1.5 text-gray-500">
                                        <Calendar size={11} className="text-gray-300" />
                                        {new Date(selectedOrder.created_at).toLocaleDateString('fr-FR')} {new Date(selectedOrder.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    {selectedOrder.contact_name && (
                                        <div className="flex items-center gap-1.5 text-gray-500">
                                            <User size={11} className="text-gray-300" />
                                            {selectedOrder.contact_name}
                                        </div>
                                    )}
                                    {selectedOrder.payment_method && (
                                        <div className="flex items-center gap-1.5 text-gray-500">
                                            <Hash size={11} className="text-gray-300" />
                                            {selectedOrder.payment_method}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Items */}
                            {selectedOrder.items && selectedOrder.items.length > 0 && (
                                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                                        <Package size={12} className="text-gray-400" />
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Items</span>
                                    </div>
                                    {selectedOrder.items.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 last:border-0">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                                                <p className="text-[10px] text-gray-400">{item.quantity} × {fmt(item.unit_price)}</p>
                                            </div>
                                            <p className="text-xs font-black text-gray-900 ml-4">{fmt(item.quantity * item.unit_price)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Total + Print */}
                            <div className="bg-emerald-50 rounded-2xl p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total</p>
                                    <p className="text-2xl font-black text-emerald-700">{fmt(selectedOrder.total_amount)}</p>
                                </div>
                                <button
                                    onClick={() => handlePrint(selectedOrder)}
                                    disabled={printingId === selectedOrder.id}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-lg shadow-emerald-100"
                                >
                                    {printingId === selectedOrder.id
                                        ? <Loader2 size={14} className="animate-spin" />
                                        : <Printer size={14} />
                                    }
                                    Print / PDF
                                </button>
                            </div>
                        </div>
                    ) : filtered.length === 0 ? (
                        /* ── EMPTY STATE ── */
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300">
                            <Receipt size={36} strokeWidth={1} />
                            <p className="text-xs font-bold text-gray-400">
                                {search ? 'No orders match your search' : 'No orders yet this session'}
                            </p>
                        </div>
                    ) : (
                        /* ── LIST VIEW ── */
                        <div className="divide-y divide-gray-50">
                            {filtered.map(order => {
                                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.DRAFT;
                                const StatusIcon = cfg.icon;
                                return (
                                    <button
                                        key={order.id}
                                        onClick={() => setSelectedOrder(order)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors text-left group"
                                    >
                                        {/* Status dot */}
                                        <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", cfg.color)}>
                                            <StatusIcon size={16} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs font-black text-gray-900">#{order.ref_code || order.id}</p>
                                                {order.invoice_number && (
                                                    <span className="text-[9px] font-mono text-indigo-400 bg-indigo-50 px-1 rounded">
                                                        {order.invoice_number}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {order.contact_name && (
                                                    <span className="text-[10px] text-gray-400 font-medium truncate">
                                                        {order.contact_name}
                                                    </span>
                                                )}
                                                <span className="text-[9px] text-gray-300">
                                                    {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Amount */}
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-black text-gray-900">{fmt(order.total_amount)}</p>
                                            <p className={clsx("text-[9px] font-black uppercase", cfg.color.split(' ')[0])}>{cfg.label}</p>
                                        </div>

                                        <ChevronRight size={14} className="text-gray-200 group-hover:text-gray-400 transition-colors shrink-0" />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
