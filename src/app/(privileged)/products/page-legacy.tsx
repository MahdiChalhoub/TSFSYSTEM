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
 <div className="page-header-icon bg-app-primary text-app-foreground">
 <Database size={22} strokeWidth={2.5} />
 </div>
 <div>
 <div className="flex items-center gap-3">
 <h1 className="page-header-title">
 Product <span className="text-app-primary">Registry</span>
 </h1>
 <span className="badge-status badge-emerald">V2.5</span>
 </div>
 <p className="page-header-subtitle mt-1 flex items-center gap-2">
 <ShieldCheck size={14} className="text-app-primary" />
 Master product data management
 </p>
 </div>
 </div>

 <div className="flex items-center gap-3">
 <Link
 href="/products/new"
 className="bg-app-surface border border-app-success/30 text-app-success px-6 h-12 rounded-2xl font-bold shadow-sm hover:bg-app-primary-light hover:border-app-success transition-all flex items-center gap-2 active:scale-95 text-sm"
 >
 <Plus size={18} className="group-hover:rotate-90 transition-transform" />
 <span>New Product</span>
 </Link>
 <Link
 href="/products/create-group"
 className="bg-app-primary text-app-foreground px-6 h-12 rounded-2xl font-bold shadow-lg shadow-app-primary/20 hover:bg-app-success transition-all flex items-center gap-2 active:scale-95 text-sm"
 >
 <Layers size={18} />
 <span>Variant Group</span>
 </Link>
 </div>
 </header>

 {/* 2. Intelligence Section */}
 {stats && <ProductDashboardStats stats={stats} />}

 {/* 3. Toolbar Section */}
 <div className="flex flex-col lg:flex-row gap-6 items-center justify-between bg-app-surface p-6 rounded-[2.5rem] border border-app-border shadow-2xl shadow-app-border/20">
 <div className="flex p-2 bg-app-background rounded-2xl border border-app-border">
 <Link
 href={`/products?view=flat&search=${search}`}
 className={`px-8 py-3 rounded-xl text-xs font-black tracking-widest transition-all uppercase flex items-center gap-2 ${!isGrouped ? 'bg-app-surface shadow-xl shadow-app-border/20 text-app-foreground border border-app-border' : 'text-app-muted-foreground hover:text-app-muted-foreground'}`}
 >
 <Search size={14} /> Detailed (SKUs)
 </Link>
 <Link
 href={`/products?view=grouped&search=${search}`}
 className={`px-8 py-3 rounded-xl text-xs font-black tracking-widest transition-all uppercase flex items-center gap-2 ${isGrouped ? 'bg-app-surface shadow-xl shadow-app-border/20 text-app-foreground border border-app-border' : 'text-app-muted-foreground hover:text-app-muted-foreground'}`}
 >
 <Layers size={14} /> Grouped (Master)
 </Link>
 </div>

 <div className="flex gap-4 w-full max-w-2xl">
 <form action="/products" className="relative flex-1 group">
 <input type="hidden" name="view" value={isGrouped ? 'grouped' : 'flat'} />
 <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-app-muted-foreground pointer-events-none group-focus-within:text-app-primary transition-colors" size={22} />
 <input
 type="text"
 name="search"
 defaultValue={search}
 placeholder="Find product by name, SKU or barcode..."
 className="w-full pl-14 pr-6 h-16 bg-app-surface-2/50 rounded-3xl border-2 border-transparent focus:border-app-primary/20 focus:bg-app-surface focus:ring-8 focus:ring-app-primary/5 outline-none transition-all font-bold text-app-foreground placeholder:text-app-muted-foreground placeholder:font-medium text-lg"
 />
 </form>
 <button className="h-16 w-16 bg-app-surface border-2 border-app-border rounded-3xl flex items-center justify-center text-app-muted-foreground hover:text-app-primary hover:border-app-success/30 shadow-sm transition-all hover:rotate-12">
 <Filter size={24} />
 </button>
 </div>
 </div>

 {/* 4. Table Section */}
 <div className="bg-app-surface rounded-[3rem] overflow-hidden shadow-2xl shadow-app-border/20 border border-app-border">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-app-surface-2/30 border-b border-app-border text-[10px] uppercase tracking-[0.2em] text-app-muted-foreground font-black">
 <th className="py-8 px-10">Entity Identity</th>
 <th className="py-8 px-10">Origin & Attributes</th>
 <th className="py-8 px-10">Logistics Codes</th>
 <th className="py-8 px-10">Current Inventory</th>
 <th className="py-8 px-10 text-right">Master Control</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-app-border">
 {data.length === 0 ? (
 <tr>
 <td colSpan={5} className="py-32 text-center">
 <div className="flex flex-col items-center gap-4 opacity-20">
 <div className="w-20 h-20 rounded-full border-4 border-app-primary flex items-center justify-center">
 <Search size={40} className="text-app-primary" />
 </div>
 <p className="text-xl font-black uppercase tracking-widest text-app-success">No results found</p>
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
 <div className="bg-app-surface-2/30 px-10 py-10 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-app-border">
 <div className="flex items-center gap-4 bg-app-surface px-6 py-3 rounded-2xl border border-app-border shadow-sm">
 <div className="flex flex-col">
 <span className="text-2xl font-black text-app-foreground leading-none">{total.toLocaleString()}</span>
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mt-1">Total Artifacts</span>
 </div>
 <div className="w-px h-8 bg-app-surface-2 mx-2" />
 <div className="flex flex-col">
 <span className="text-2xl font-black text-app-primary leading-none">{totalPages}</span>
 <span className="text-[10px] font-black text-app-primary uppercase tracking-widest mt-1">Master Pages</span>
 </div>
 </div>

 {totalPages > 1 && (
 <nav className="flex items-center gap-3">
 <Link
 href={`/products?view=${isGrouped ? 'grouped' : 'flat'}&page=${page > 1 ? page - 1 : 1}&search=${search}`}
 className={`h-14 px-6 flex items-center gap-3 bg-app-surface border border-app-border rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-app-background hover:border-app-border transition-all shadow-sm active:translate-y-1 ${page <= 1 ? 'opacity-30 pointer-events-none' : ''}`}
 >
 <ChevronLeft size={18} /> Prev
 </Link>

 <div className="flex h-14 items-center bg-app-surface px-6 rounded-2xl border border-app-border shadow-sm font-black text-sm tabular-nums">
 <span className="text-app-muted-foreground">PAGE</span>
 <span className="mx-2 text-app-foreground">{page}</span>
 <span className="text-app-foreground mx-1">/</span>
 <span className="text-app-muted-foreground">{totalPages}</span>
 </div>

 <Link
 href={`/products?view=${isGrouped ? 'grouped' : 'flat'}&page=${page < totalPages ? page + 1 : totalPages}&search=${search}`}
 className={`h-14 px-6 flex items-center gap-3 bg-app-primary text-app-foreground rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-app-success transition-all shadow-xl shadow-app-primary/20 active:translate-y-1 ${page >= totalPages ? 'opacity-30 pointer-events-none' : ''}`}
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