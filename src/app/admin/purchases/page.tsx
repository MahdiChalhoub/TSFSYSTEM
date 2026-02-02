import { prisma } from "@/lib/db";
import Link from "next/link";
import { ShoppingCart, Plus, Calendar, User, Tag, Clock, Database } from "lucide-react";
import { serializeDecimals } from "@/lib/utils/serialization";

export const dynamic = 'force-dynamic';

import { cookies } from "next/headers";

async function getPurchases(scope: string = 'INTERNAL') {
    const where: any = { type: 'PURCHASE' };
    if (scope === 'OFFICIAL') {
        where.scope = 'OFFICIAL';
    }

    return await prisma.order.findMany({
        where,
        include: {
            contact: true,
            user: true,
        },
        orderBy: { createdAt: 'desc' }
    });
}

export default async function PurchaseRegistryPage() {
    const cookieStore = await cookies();
    const scope = (cookieStore.get('tsf_view_scope')?.value as string) || 'INTERNAL'
    const rawPurchases = await getPurchases(scope);
    const purchases = serializeDecimals(rawPurchases);

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-8 lg:p-12">
            <div className="max-w-6xl mx-auto space-y-10">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-500 rounded-lg text-white">
                                <ShoppingCart size={16} />
                            </div>
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Commercial</span>
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tighter">
                            Purchase <span className="text-emerald-500">Registry</span>
                        </h1>
                    </div>
                    <Link
                        href="/admin/purchases/new"
                        className="bg-emerald-600 text-white px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2"
                    >
                        <Plus size={20} />
                        <span>New Purchase</span>
                    </Link>
                </div>

                {/* Table */}
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            <tr>
                                <th className="p-6">Date & Ref</th>
                                <th className="p-6">Supplier</th>
                                <th className="p-6">Status</th>
                                <th className="p-6 text-right">Amount</th>
                                <th className="p-6">Processed By</th>
                                <th className="p-6 text-center">Audit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {purchases.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center text-gray-400 font-medium">
                                        No purchase records found.
                                    </td>
                                </tr>
                            ) : (
                                purchases.map((p: any) => (
                                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-6">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900">{p.refCode || `PUR-${p.id}`}</span>
                                                <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1">
                                                    <Calendar size={10} />
                                                    {new Date(p.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6 text-sm font-bold text-gray-700">
                                            {p.contact?.name || 'Unknown'}
                                        </td>
                                        <td className="p-6">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${p.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                                }`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="p-6 text-right font-black text-gray-900">
                                            ${p.totalAmount.toFixed(2)}
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                    {p.user?.name?.[0] || 'U'}
                                                </div>
                                                <span className="text-xs text-gray-500 font-medium">{p.user?.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-6 text-center">
                                            <Link
                                                href={`/admin/finance/ledger?q=${p.refCode || `ORD-${p.id}`}`}
                                                className="p-2 hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 rounded-lg transition-colors inline-block"
                                                title="View Ledger Posting"
                                            >
                                                <Database size={14} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div >
        </div >
    );
}
