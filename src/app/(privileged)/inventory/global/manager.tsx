'use client';

import { useState, useTransition, useEffect } from 'react';
import { Search, Package, TrendingUp, DollarSign, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

type SiteRow = { id: number | string; name: string }
type ProductRow = {
    id: number | string
    name: string
    sku?: string
    barcode?: string
    category?: string
    brand?: string
    unit?: string
    totalQty: number
    costPrice: number
    siteStock: Record<string | number, number>
}

type GlobalInventoryData = {
    products: ProductRow[]
    sites: SiteRow[]
    totalCount: number
    totalPages: number
    search?: string
}

type FetchInput = { search?: string; offset?: number; limit?: number }
type FetchAction = (input: FetchInput) => Promise<GlobalInventoryData>

export default function GlobalInventoryManager({
    initialData,
    fetchAction
}: {
    initialData: GlobalInventoryData,
    fetchAction: FetchAction
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
        totalStock: data.products.reduce((acc: number, p) => acc + p.totalQty, 0),
        totalValue: data.products.reduce((acc: number, p) => acc + (p.totalQty * p.costPrice), 0)
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-app-surface p-8 rounded-[40px] shadow-xl shadow-indigo-900/5 border border-app-border flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-app-info-bg text-app-info flex items-center justify-center">
                        <Package size={32} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Total SKUs</div>
                        <div className="text-3xl font-black text-app-foreground">{stats.totalItems.toLocaleString()}</div>
                    </div>
                </div>
                <div className="bg-app-surface p-8 rounded-[40px] shadow-xl shadow-indigo-900/5 border border-app-border flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-app-success-bg text-app-success flex items-center justify-center">
                        <TrendingUp size={32} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Inventory Qty</div>
                        <div className="text-3xl font-black text-app-foreground">{stats.totalStock.toLocaleString()}</div>
                    </div>
                </div>
                <div className="bg-app-surface p-8 rounded-[40px] shadow-xl shadow-indigo-900/5 border border-app-border flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-app-warning-bg text-app-warning flex items-center justify-center">
                        <DollarSign size={32} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Stock Valuation</div>
                        <div className="text-3xl font-black text-app-foreground">${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 bg-app-surface p-4 rounded-[32px] shadow-lg shadow-gray-200/50 border border-app-border">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" size={20} />
                    <input
                        className="w-full pl-12 pr-6 py-4 bg-app-surface rounded-2xl border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground"
                        placeholder="Search by Product Name, SKU or Barcode..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <button className="px-6 py-4 bg-app-surface text-app-muted-foreground rounded-2xl font-bold flex items-center gap-2 hover:bg-app-surface-2 transition-all">
                    <Filter size={20} />
                    <span>Filter</span>
                </button>
            </div>

            {/* Table */}
            <div className="bg-app-surface rounded-[40px] shadow-2xl shadow-indigo-900/5 border border-app-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-app-surface/50">
                                <th className="px-8 py-6 text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em] border-b border-app-border">Product Info</th>
                                <th className="px-6 py-6 text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em] border-b border-app-border">Category / Brand</th>
                                {data.sites.map((site) => (
                                    <th key={site.id} className="px-6 py-6 text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] border-b border-app-border text-center bg-app-info-bg/20">
                                        {site.name}
                                    </th>
                                ))}
                                <th className="px-8 py-6 text-[10px] font-black text-app-success uppercase tracking-[0.2em] border-b border-app-border text-right">Total Stock</th>
                                <th className="px-8 py-6 text-[10px] font-black text-app-warning uppercase tracking-[0.2em] border-b border-app-border text-right">Value (Cost)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-app-border">
                            {data.products.map((product) => (
                                <tr key={product.id} className="hover:bg-app-surface transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-app-surface flex items-center justify-center text-app-muted-foreground group-hover:bg-app-surface transition-colors border border-transparent group-hover:border-app-border">
                                                <Package size={20} />
                                            </div>
                                            <div>
                                                <div className="font-black text-app-foreground group-hover:text-app-info transition-colors">{product.name}</div>
                                                <div className="text-[10px] font-mono text-app-muted-foreground flex items-center gap-2 mt-1">
                                                    <span className="bg-app-surface-2 px-1.5 py-0.5 rounded uppercase">{product.sku}</span>
                                                    {product.barcode && <span>ΓÇó {product.barcode}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-bold text-app-muted-foreground bg-app-surface-2 px-2 py-1 rounded-lg w-fit">{product.category}</span>
                                            <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-tighter">{product.brand}</span>
                                        </div>
                                    </td>
                                    {data.sites.map((site) => (
                                        <td key={site.id} className="px-6 py-6 text-center border-l border-app-border/50">
                                            <div className={clsx(
                                                "inline-block px-3 py-1.5 rounded-xl font-black text-sm",
                                                product.siteStock[site.id] > 0 ? "bg-app-info-bg text-app-info" : "bg-app-surface text-app-faint"
                                            )}>
                                                {product.siteStock[site.id]}
                                            </div>
                                        </td>
                                    ))}
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex flex-col items-end">
                                            <div className="text-lg font-black text-app-foreground">{product.totalQty}</div>
                                            <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">{product.unit || 'PC'}</div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="text-sm font-black text-app-success">
                                            ${(product.totalQty * product.costPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-[9px] font-bold text-app-muted-foreground mt-1">
                                            @ ${product.costPrice.toFixed(2)}/unit
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-8 py-6 bg-app-surface/50 border-t border-app-border flex justify-between items-center">
                    <div className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest">
                        Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, data.totalCount)} of {data.totalCount} products
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => loadData(page - 1, search)}
                            disabled={page === 1 || isPending}
                            className="p-3 bg-app-surface border border-app-border rounded-2xl text-app-muted-foreground hover:text-app-info disabled:opacity-50 transition-all"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div className="px-6 py-3 bg-app-surface border border-app-border rounded-2xl font-black text-app-info text-sm">
                            Page {page} of {data.totalPages}
                        </div>
                        <button
                            onClick={() => loadData(page + 1, search)}
                            disabled={page === data.totalPages || isPending}
                            className="p-3 bg-app-surface border border-app-border rounded-2xl text-app-muted-foreground hover:text-app-info disabled:opacity-50 transition-all"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}