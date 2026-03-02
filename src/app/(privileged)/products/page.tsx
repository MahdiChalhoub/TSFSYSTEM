import Link from 'next/link';
import { erpFetch } from '@/lib/erp-api';
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
 erpFetch('inventory/products/data-quality/'),
 ]);
 return {
 data: data.results || [],
 total: data.count || 0,
 totalPages: Math.ceil((data.count || 0) / PAGE_SIZE),
 stats,
 };
 } catch {
 return { data: [], total: 0, totalPages: 0, stats: null };
 }
}

export default async function ProductsPage({
 searchParams,
}: {
 searchParams: Promise<{ view?: string; page?: string; search?: string }>;
}) {
 const params = await searchParams;
 const isGrouped = params.view === 'grouped';
 const page = Number(params.page) || 1;
 const search = params.search || '';

 const { data, total, totalPages, stats } = await getProductsData(page, isGrouped, search);

 return (
 <div
 className="min-h-screen p-5 md:p-6 space-y-5 max-w-7xl mx-auto"
 style={{ color: 'var(--app-text)', fontFamily: 'var(--app-font)' }}
 >
 {/* ── Header ────────────────────────────────────── */}
 <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 fade-in-up">
 <div className="flex items-center gap-4">
 <div
 className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
 style={{ background: 'var(--app-primary)', boxShadow: '0 8px 24px var(--app-primary-glow)' }}
 >
 <Database size={26} color="#fff" />
 </div>
 <div>
 <div className="flex items-center gap-2 mb-0.5">
 <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--app-text)', fontFamily: 'var(--app-font-display)' }}>
 Product <span style={{ color: 'var(--app-primary)' }}>Registry</span>
 </h1>
 <span
 className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
 style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)', border: '1px solid var(--app-primary-glow)' }}
 >V2.5</span>
 </div>
 <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--app-text-muted)' }}>
 <ShieldCheck size={13} style={{ color: 'var(--app-primary)' }} />
 Master product data management
 </p>
 </div>
 </div>

 <div className="flex items-center gap-3">
 <Link
 href="/products/new"
 className="flex items-center gap-2 px-5 h-11 rounded-xl font-bold text-sm transition-all"
 style={{
 background: 'var(--app-surface)',
 border: '1px solid var(--app-border)',
 color: 'var(--app-primary)',
 boxShadow: 'var(--app-shadow-sm)',
 }}
 >
 <Plus size={16} />
 New Product
 </Link>
 <Link
 href="/products/create-group"
 className="flex items-center gap-2 px-5 h-11 rounded-xl font-bold text-sm transition-all text-app-text"
 style={{
 background: 'var(--app-primary)',
 boxShadow: '0 4px 14px var(--app-primary-glow)',
 }}
 >
 <Layers size={16} />
 Variant Group
 </Link>
 </div>
 </header>

 {/* ── Stats Panel ───────────────────────────────── */}
 {stats && <ProductDashboardStats stats={stats} />}

 {/* ── Toolbar ───────────────────────────────────── */}
 <div
 className="app-card flex flex-col lg:flex-row gap-4 items-center justify-between p-4 fade-in-up"
 style={{ animationDelay: '80ms' }}
 >
 {/* View toggle */}
 <div className="flex p-1 rounded-xl gap-1" style={{ background: 'var(--app-surface-2)', border: '1px solid var(--app-border)' }}>
 <Link
 href={`/products?view=flat&search=${search}`}
 className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
 style={!isGrouped ? {
 background: 'var(--app-primary)',
 color: '#fff',
 boxShadow: '0 2px 8px var(--app-primary-glow)',
 } : {
 color: 'var(--app-text-muted)',
 }}
 >
 <Search size={13} /> Detailed (SKUs)
 </Link>
 <Link
 href={`/products?view=grouped&search=${search}`}
 className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
 style={isGrouped ? {
 background: 'var(--app-primary)',
 color: '#fff',
 boxShadow: '0 2px 8px var(--app-primary-glow)',
 } : {
 color: 'var(--app-text-muted)',
 }}
 >
 <Layers size={13} /> Grouped (Master)
 </Link>
 </div>

 {/* Search */}
 <div className="flex gap-3 w-full max-w-xl">
 <form action="/products" className="relative flex-1">
 <input type="hidden" name="view" value={isGrouped ? 'grouped' : 'flat'} />
 <Search
 className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
 size={16}
 style={{ color: 'var(--app-text-muted)' }}
 />
 <input
 type="text"
 name="search"
 defaultValue={search}
 placeholder="Search by name, SKU or barcode..."
 className="app-input w-full pl-11 pr-4 h-11 text-sm"
 />
 </form>
 <button
 className="h-11 w-11 rounded-xl flex items-center justify-center transition-all"
 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}
 >
 <Filter size={16} />
 </button>
 </div>
 </div>

 {/* ── Table ─────────────────────────────────────── */}
 <div
 className="app-card overflow-hidden fade-in-up"
 style={{ animationDelay: '120ms' }}
 >
 <div className="overflow-x-auto">
 <table className="w-full text-left">
 <thead>
 <tr
 className="text-[10px] uppercase tracking-widest font-black"
 style={{
 background: 'var(--app-surface-2)',
 borderBottom: '1px solid var(--app-border)',
 color: 'var(--app-text-muted)',
 }}
 >
 <th className="py-4 px-6">Entity Identity</th>
 <th className="py-4 px-6">Origin & Attributes</th>
 <th className="py-4 px-6">Logistics Codes</th>
 <th className="py-4 px-6">Current Inventory</th>
 <th className="py-4 px-6 text-right">Actions</th>
 </tr>
 </thead>
 <tbody>
 {data.length === 0 ? (
 <tr>
 <td colSpan={5} className="py-24 text-center">
 <div className="flex flex-col items-center gap-4">
 <div
 className="w-16 h-16 rounded-2xl flex items-center justify-center"
 style={{ background: 'var(--app-primary-light)' }}
 >
 <Search size={32} style={{ color: 'var(--app-primary)' }} />
 </div>
 <p className="text-sm font-bold" style={{ color: 'var(--app-text-muted)' }}>
 No products found
 </p>
 <Link
 href="/products/new"
 className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-app-text transition-all"
 style={{ background: 'var(--app-primary)' }}
 >
 <Plus size={14} /> Add first product
 </Link>
 </div>
 </td>
 </tr>
 ) : data.map((item: Record<string, any>) =>
 isGrouped
 ? <GroupRow key={item.id} group={item} />
 : <ProductRow key={item.id} product={item} />
 )}
 </tbody>
 </table>
 </div>

 {/* Pagination */}
 <div
 className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-4"
 style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface-2)' }}
 >
 <div className="flex items-center gap-4 text-sm">
 <span className="font-black text-2xl" style={{ color: 'var(--app-text)' }}>{total.toLocaleString()}</span>
 <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
 Total Products
 </span>
 <div className="w-px h-6" style={{ background: 'var(--app-border)' }} />
 <span className="font-black text-2xl" style={{ color: 'var(--app-primary)' }}>{totalPages}</span>
 <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
 Pages
 </span>
 </div>

 {totalPages > 1 && (
 <nav className="flex items-center gap-2">
 <Link
 href={`/products?view=${isGrouped ? 'grouped' : 'flat'}&page=${Math.max(1, page - 1)}&search=${search}`}
 className={`flex items-center gap-1.5 px-4 h-9 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${page <= 1 ? 'opacity-30 pointer-events-none' : ''}`}
 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}
 >
 <ChevronLeft size={14} /> Prev
 </Link>
 <div
 className="px-4 h-9 flex items-center rounded-lg text-sm font-black"
 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}
 >
 {page} <span style={{ color: 'var(--app-border)' }} className="mx-1">/</span> {totalPages}
 </div>
 <Link
 href={`/products?view=${isGrouped ? 'grouped' : 'flat'}&page=${Math.min(totalPages, page + 1)}&search=${search}`}
 className={`flex items-center gap-1.5 px-4 h-9 rounded-lg font-bold text-xs uppercase tracking-wider transition-all text-app-text ${page >= totalPages ? 'opacity-30 pointer-events-none' : ''}`}
 style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px var(--app-primary-glow)' }}
 >
 Next <ChevronRight size={14} />
 </Link>
 </nav>
 )}
 </div>
 </div>
 </div>
 );
}