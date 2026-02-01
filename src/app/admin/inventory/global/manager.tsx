'use client';

import { useState, useTransition, useEffect } from 'react';
import { Search, Package, Building2, TrendingUp, DollarSign, Filter, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import clsx from 'clsx';

export default function GlobalInventoryManager({
    initialData,
    fetchAction
}: {
    initialData: any,
    fetchAction: any
}) {
    const [data, setData] = useState(initialData);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [isPending, startTransition] = useTransition();

    const loadData = (newPage: number, newSearch: string) => {
        startTransition(async () => {
            const result = await fetchAction({
                search: newSearch,
                offset: (newPage - 1) * 50,
                limit: 50
            });
            setData(result);
            setPage(newPage);
        });
    };

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (search !== initialData.search) {
                loadData(1, search);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const stats = {
        totalItems: data.totalCount,
        totalStock: data.products.reduce((acc: number, p: any) => acc + p.totalQty, 0),
        totalValue: data.products.reduce((acc: number, p: any) => acc + (p.totalQty * p.costPrice), 0)
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[40px] shadow-xl shadow-indigo-900/5 border border-gray-50 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Package size={32} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total SKUs</div>
                        <div className="text-3xl font-black text-gray-900">{stats.totalItems.toLocaleString()}</div>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[40px] shadow-xl shadow-indigo-900/5 border border-gray-50 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <TrendingUp size={32} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Inventory Qty</div>
                        <div className="text-3xl font-black text-gray-900">{stats.totalStock.toLocaleString()}</div>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[40px] shadow-xl shadow-indigo-900/5 border border-gray-50 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <DollarSign size={32} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Stock Valuation</div>
                        <div className="text-3xl font-black text-gray-900">${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-[32px] shadow-lg shadow-gray-200/50 border border-gray-100">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        className="w-full pl-12 pr-6 py-4 bg-gray-50 rounded-2xl border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-700"
                        placeholder="Search by Product Name, SKU or Barcode..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <button className="px-6 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-100 transition-all">
                    <Filter size={20} />
                    <span>Filter</span>
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[40px] shadow-2xl shadow-indigo-900/5 border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100">Product Info</th>
                                <th className="px-6 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100">Category / Brand</th>
                                {data.sites.map((site: any) => (
                                    <th key={site.id} className="px-6 py-6 text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] border-b border-gray-100 text-center bg-indigo-50/20">
                                        {site.name}
                                    </th>
                                ))}
                                <th className="px-8 py-6 text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] border-b border-gray-100 text-right">Total Stock</th>
                                <th className="px-8 py-6 text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] border-b border-gray-100 text-right">Value (Cost)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {data.products.map((product: any) => (
                                <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white transition-colors border border-transparent group-hover:border-gray-100">
                                                <Package size={20} />
                                            </div>
                                            <div>
                                                <div className="font-black text-gray-900 group-hover:text-indigo-600 transition-colors">{product.name}</div>
                                                <div className="text-[10px] font-mono text-gray-400 flex items-center gap-2 mt-1">
                                                    <span className="bg-gray-100 px-1.5 py-0.5 rounded uppercase">{product.sku}</span>
                                                    {product.barcode && <span>• {product.barcode}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg w-fit">{product.category}</span>
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{product.brand}</span>
                                        </div>
                                    </td>
                                    {data.sites.map((site: any) => (
                                        <td key={site.id} className="px-6 py-6 text-center border-l border-gray-50/50">
                                            <div className={clsx(
                                                "inline-block px-3 py-1.5 rounded-xl font-black text-sm",
                                                product.siteStock[site.id] > 0 ? "bg-indigo-50 text-indigo-600" : "bg-gray-50 text-gray-300"
                                            )}>
                                                {product.siteStock[site.id]}
                                            </div>
                                        </td>
                                    ))}
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex flex-col items-end">
                                            <div className="text-lg font-black text-gray-900">{product.totalQty}</div>
                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{product.unit || 'PC'}</div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="text-sm font-black text-emerald-600">
                                            ${(product.totalQty * product.costPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-[9px] font-bold text-gray-400 mt-1">
                                            @ ${product.costPrice.toFixed(2)}/unit
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, data.totalCount)} of {data.totalCount} products
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => loadData(page - 1, search)}
                            disabled={page === 1 || isPending}
                            className="p-3 bg-white border border-gray-200 rounded-2xl text-gray-400 hover:text-indigo-600 disabled:opacity-50 transition-all"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div className="px-6 py-3 bg-white border border-gray-200 rounded-2xl font-black text-indigo-600 text-sm">
                            Page {page} of {data.totalPages}
                        </div>
                        <button
                            onClick={() => loadData(page + 1, search)}
                            disabled={page === data.totalPages || isPending}
                            className="p-3 bg-white border border-gray-200 rounded-2xl text-gray-400 hover:text-indigo-600 disabled:opacity-50 transition-all"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
