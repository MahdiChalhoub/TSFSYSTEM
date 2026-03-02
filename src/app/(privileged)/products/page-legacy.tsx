import Link from 'next/link';
import { erpFetch } from "@/lib/erp-api";
import { Plus, Search, Layers, ChevronLeft, ChevronRight, Filter, ShieldCheck, Database } from 'lucide-react';
import ProductDashboardStats from './ProductStats';
import { ProductRow, GroupRow } from './ProductRows';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

async function getProductsData(page: number, isGrouped: boolean, search?: string) {
    try {
        const endpoint = isGrouped ? 'product-groups/' : 'products/';
        const query = `page=${page}&page_size=${PAGE_SIZE}${search ? `&search=${search}` : ''}`;

        const [data, stats] = await Promise.all([
            erpFetch(`${endpoint}?${query}`),
            erpFetch('inventory/products/data-quality/')
        ]);

        const results = data.results || [];
        const total = data.count || 0;

        return {
            data: results,
            total,
            totalPages: Math.ceil(total / PAGE_SIZE),
            stats
        };
    } catch {
        return { data: [], total: 0, totalPages: 0, stats: null };
    }
}

export default async function ProductsPage({
    searchParams
}: {
    searchParams: Promise<{ view?: string, page?: string, search?: string }>
}) {
    const params = await searchParams;
    const isGrouped = params.view === 'grouped';
    const page = Number(params.page) || 1;
    const search = params.search || '';

    const { data, total, totalPages, stats } = await getProductsData(page, isGrouped, search);

    return (
        <div className="page-container">
            {/* 1. Header Section */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="page-header-icon bg-emerald-600 text-white">
                        <Database size={22} strokeWidth={2.5} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="page-header-title">
                                Product <span className="text-emerald-600">Registry</span>
                            </h1>
                            <span className="badge-status badge-emerald">V2.5</span>
                        </div>
                        <p className="page-header-subtitle mt-1 flex items-center gap-2">
                            <ShieldCheck size={14} className="text-emerald-500" />
                            Master product data management
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/products/new"
                        className="bg-white border border-emerald-100 text-emerald-700 px-6 h-12 rounded-2xl font-bold shadow-sm hover:bg-emerald-50 hover:border-emerald-200 transition-all flex items-center gap-2 active:scale-95 text-sm"
                    >
                        <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                        <span>New Product</span>
                    </Link>
                    <Link
                        href="/products/create-group"
                        className="bg-emerald-600 text-white px-6 h-12 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95 text-sm"
                    >
                        <Layers size={18} />
                        <span>Variant Group</span>
                    </Link>
                </div>
            </header>

            {/* 2. Intelligence Section */}
            {stats && <ProductDashboardStats stats={stats} />}

            {/* 3. Toolbar Section */}
            <div className="flex flex-col lg:flex-row gap-6 items-center justify-between bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/10">
                <div className="flex p-2 bg-gray-50 rounded-2xl border border-gray-100">
                    <Link
                        href={`/products?view=flat&search=${search}`}
                        className={`px-8 py-3 rounded-xl text-xs font-black tracking-widest transition-all uppercase flex items-center gap-2 ${!isGrouped ? 'bg-white shadow-xl shadow-gray-200/50 text-gray-900 border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <Search size={14} /> Detailed (SKUs)
                    </Link>
                    <Link
                        href={`/products?view=grouped&search=${search}`}
                        className={`px-8 py-3 rounded-xl text-xs font-black tracking-widest transition-all uppercase flex items-center gap-2 ${isGrouped ? 'bg-white shadow-xl shadow-gray-200/50 text-gray-900 border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <Layers size={14} /> Grouped (Master)
                    </Link>
                </div>

                <div className="flex gap-4 w-full max-w-2xl">
                    <form action="/products" className="relative flex-1 group">
                        <input type="hidden" name="view" value={isGrouped ? 'grouped' : 'flat'} />
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none group-focus-within:text-emerald-500 transition-colors" size={22} />
                        <input
                            type="text"
                            name="search"
                            defaultValue={search}
                            placeholder="Find product by name, SKU or barcode..."
                            className="w-full pl-14 pr-6 h-16 bg-gray-50/50 rounded-3xl border-2 border-transparent focus:border-emerald-500/20 focus:bg-white focus:ring-8 focus:ring-emerald-500/5 outline-none transition-all font-bold text-gray-800 placeholder:text-gray-300 placeholder:font-medium text-lg"
                        />
                    </form>
                    <button className="h-16 w-16 bg-white border-2 border-gray-50 rounded-3xl flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:border-emerald-100 shadow-sm transition-all hover:rotate-12">
                        <Filter size={24} />
                    </button>
                </div>
            </div>

            {/* 4. Table Section */}
            <div className="bg-white rounded-[3rem] overflow-hidden shadow-2xl shadow-gray-200/20 border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/30 border-b border-gray-100 text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black">
                                <th className="py-8 px-10">Entity Identity</th>
                                <th className="py-8 px-10">Origin & Attributes</th>
                                <th className="py-8 px-10">Logistics Codes</th>
                                <th className="py-8 px-10">Current Inventory</th>
                                <th className="py-8 px-10 text-right">Master Control</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {data.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-32 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-20">
                                            <div className="w-20 h-20 rounded-full border-4 border-emerald-600 flex items-center justify-center">
                                                <Search size={40} className="text-emerald-600" />
                                            </div>
                                            <p className="text-xl font-black uppercase tracking-widest text-emerald-900">No results found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                data.map((item: Record<string, any>) => isGrouped ? <GroupRow key={item.id} group={item} /> : <ProductRow key={item.id} product={item} />)
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 5. Pagination Layer */}
                <div className="bg-gray-50/30 px-10 py-10 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-gray-50">
                    <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex flex-col">
                            <span className="text-2xl font-black text-gray-900 leading-none">{total.toLocaleString()}</span>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Total Artifacts</span>
                        </div>
                        <div className="w-px h-8 bg-gray-100 mx-2" />
                        <div className="flex flex-col">
                            <span className="text-2xl font-black text-emerald-600 leading-none">{totalPages}</span>
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1">Master Pages</span>
                        </div>
                    </div>

                    {totalPages > 1 && (
                        <nav className="flex items-center gap-3">
                            <Link
                                href={`/products?view=${isGrouped ? 'grouped' : 'flat'}&page=${page > 1 ? page - 1 : 1}&search=${search}`}
                                className={`h-14 px-6 flex items-center gap-3 bg-white border border-gray-100 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-50 hover:border-gray-200 transition-all shadow-sm active:translate-y-1 ${page <= 1 ? 'opacity-30 pointer-events-none' : ''}`}
                            >
                                <ChevronLeft size={18} /> Prev
                            </Link>

                            <div className="flex h-14 items-center bg-white px-6 rounded-2xl border border-gray-100 shadow-sm font-black text-sm tabular-nums">
                                <span className="text-gray-400">PAGE</span>
                                <span className="mx-2 text-gray-900">{page}</span>
                                <span className="text-gray-200 mx-1">/</span>
                                <span className="text-gray-400">{totalPages}</span>
                            </div>

                            <Link
                                href={`/products?view=${isGrouped ? 'grouped' : 'flat'}&page=${page < totalPages ? page + 1 : totalPages}&search=${search}`}
                                className={`h-14 px-6 flex items-center gap-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:translate-y-1 ${page >= totalPages ? 'opacity-30 pointer-events-none' : ''}`}
                            >
                                Next <ChevronRight size={18} />
                            </Link>
                        </nav>
                    )}
                </div>
            </div>
        </div>
    );
}