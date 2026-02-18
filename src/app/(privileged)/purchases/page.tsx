import { erpFetch } from "@/lib/erp-api";
import Link from "next/link";
import { ShoppingCart, Plus, Calendar, User, Tag, Clock, Database, BarChart3 } from "lucide-react";
import { serializeDecimals } from "@/lib/utils/serialization";

export const dynamic = 'force-dynamic';

import { cookies } from "next/headers";

async function getPurchases() {
    try {
        return await erpFetch(`purchase/`);
    } catch (e) {
        console.error("Failed to fetch purchases:", e);
        return [];
    }
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'RFQ / Draft', color: 'bg-indigo-100 text-indigo-700' },
    AUTHORIZED: { label: 'Confirmed PO', color: 'bg-blue-100 text-blue-700' },
    RECEIVED: { label: 'Goods Received', color: 'bg-emerald-100 text-emerald-700' },
    INVOICED: { label: 'Bill Invoiced', color: 'bg-gray-100 text-gray-700' },
    CANCELLED: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700' },
    COMPLETED: { label: 'Quick Purchase', color: 'bg-emerald-500 text-white' },
};

export default async function PurchaseRegistryPage() {
    const purchases = await getPurchases();

    // Simple Analytics for Dashboard
    const rfqCount = purchases.filter((p: Record<string, any>) => p.status === 'DRAFT').length;
    const pendingReception = purchases.filter((p: Record<string, any>) => p.status === 'AUTHORIZED').length;
    const totalValue = purchases.reduce((acc: number, p: Record<string, any>) => acc + (p.totalAmount || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tighter">
                        Procurement <span className="text-emerald-500">Center</span>
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Manage RFQs, Purchase Orders, and Supplier Deliveries</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/purchases/sourcing"
                        className="bg-white border-2 border-gray-100 text-gray-500 px-6 py-3.5 rounded-2xl font-bold hover:text-emerald-600 hover:border-emerald-100 transition-all flex items-center gap-2"
                    >
                        <BarChart3 size={18} />
                        <span>Sourcing Intelligence</span>
                    </Link>
                    <Link
                        href="/purchases/new-order"
                        className="bg-white border-2 border-gray-100 text-gray-900 px-6 py-3.5 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center gap-2"
                    >
                        <Plus size={18} />
                        <span>Create RFQ</span>
                    </Link>
                    <Link
                        href="/purchases/new"
                        className="bg-emerald-600 text-white px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2"
                    >
                        <ShoppingCart size={18} />
                        <span>Quick Purchase</span>
                    </Link>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Open RFQs</div>
                    <div className="text-4xl font-black text-indigo-600">{rfqCount}</div>
                    <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Quotes pending validation</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Incoming Stock</div>
                    <div className="text-4xl font-black text-blue-600">{pendingReception}</div>
                    <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">PO confirmed, pending reception</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Procurement</div>
                    <div className="text-4xl font-black text-gray-900">{totalValue.toLocaleString()} XOF</div>
                    <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">All-time purchase volume</div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#F8FAFC] border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <tr>
                            <th className="p-6">Reference</th>
                            <th className="p-6">Supplier</th>
                            <th className="p-6">Status</th>
                            <th className="p-6 text-right">Amount</th>
                            <th className="p-6 text-center">Audit</th>
                            <th className="p-6 text-right w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {purchases.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-20 text-center text-gray-400 font-medium italic">
                                    No purchase orders found in the registry.
                                </td>
                            </tr>
                        ) : (
                            purchases.map((p: Record<string, any>) => (
                                <tr key={p.id} className="hover:bg-gray-50 group transition-colors">
                                    <td className="p-6">
                                        <Link href={`/purchases/${p.id}`} className="flex flex-col">
                                            <span className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{p.ref_code || `ORD-${p.id}`}</span>
                                            <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                                                <Calendar size={10} />
                                                {new Date(p.created_at).toLocaleDateString('fr-FR')}
                                            </div>
                                        </Link>
                                    </td>
                                    <td className="p-6 text-sm font-bold text-gray-700">
                                        {p.contact_name || 'Walking Supplier'}
                                    </td>
                                    <td className="p-6">
                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${STATUS_MAP[p.status]?.color || 'bg-gray-100 text-gray-400'}`}>
                                            {STATUS_MAP[p.status]?.label || p.status}
                                        </span>
                                    </td>
                                    <td className="p-6 text-right font-black text-gray-900">
                                        {parseFloat(p.total_amount).toLocaleString()} XOF
                                    </td>
                                    <td className="p-6 text-center">
                                        <Link
                                            href={`/finance/ledger?q=${p.ref_code || `ORD-${p.id}`}`}
                                            className="p-2 hover:bg-emerald-50 text-emerald-400 hover:text-emerald-600 rounded-lg transition-colors inline-block"
                                            title="View Ledger Posting"
                                        >
                                            <Database size={14} />
                                        </Link>
                                    </td>
                                    <td className="p-6 text-right">
                                        <Link href={`/purchases/${p.id}`} className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-gray-300 hover:text-emerald-500">
                                            <Clock size={16} />
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}