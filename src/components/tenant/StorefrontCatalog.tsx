'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowRight, Star, Search, FileQuestion, ShoppingCart, X, Heart } from 'lucide-react';
import { usePortal } from '@/context/PortalContext';
interface Product {
 id: string;
 name: string;
 sku: string;
 selling_price_ttc: number;
 image_url?: string;
 category_name?: string;
 stock_quantity?: number;
 tax_rate?: number;
}
interface StorefrontCatalogProps {
 products: Product[];
 slug: string;
}
export function StorefrontCatalog({ products, slug }: StorefrontCatalogProps) {
 const { config, addToCart, toggleWishlist, isInWishlist } = usePortal();
 const [search, setSearch] = useState('');
 const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
 const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
 const storeMode = config?.store_mode || 'HYBRID';
 const showPrice = storeMode !== 'CATALOG_QUOTE';
 // Unique categories
 const categories = useMemo(() => {
 const cats = new Set<string>();
 products.forEach(p => { if (p.category_name) cats.add(p.category_name); });
 return Array.from(cats).sort();
 }, [products]);
 // Filtered products
 const filtered = useMemo(() => {
 return products.filter(p => {
 const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
 const matchCat = !selectedCategory || p.category_name === selectedCategory;
 return matchSearch && matchCat;
 });
 }, [products, search, selectedCategory]);
 const handleQuickAdd = (p: Product, e: React.MouseEvent) => {
 e.preventDefault();
 e.stopPropagation();
 addToCart({
 product_id: p.id,
 product_name: p.name,
 unit_price: p.selling_price_ttc,
 quantity: 1,
 image_url: p.image_url,
 tax_rate: p.tax_rate || 0,
 });
 setAddedIds(prev => new Set(prev).add(p.id));
 setTimeout(() => setAddedIds(prev => { const next = new Set(prev); next.delete(p.id); return next; }), 1500);
 };
 if (!products || products.length === 0) {
 return (
 <div className="p-12 text-center bg-app-text/5 rounded-[3rem] border border-app-text/10 backdrop-blur-xl">
 <ShoppingBag className="mx-auto text-slate-700 mb-4" size={48} />
 <h3 className="text-xl font-bold text-app-text">Catalog Coming Soon</h3>
 <p className="text-app-text-muted mt-2">We are currently updating our inventory. Please check back later.</p>
 </div>
 );
 }
 return (
 <div className="space-y-8">
 {/* Header + Search */}
 <div className="space-y-4">
 <div className="flex items-center justify-between px-1">
 <h2 className="text-3xl font-black text-app-text tracking-tighter">Featured Collection</h2>
 <div className="flex gap-2">
 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
 <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live Inventory</span>
 </div>
 </div>
 {/* Search Bar */}
 <div className="relative">
 <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" />
 <input
 type="text"
 placeholder="Search products..."
 value={search}
 onChange={e => setSearch(e.target.value)}
 className="w-full bg-slate-900/60 border border-app-text/5 pl-12 pr-10 py-4 rounded-2xl text-app-text outline-none focus:border-emerald-500/30 transition-all placeholder:text-slate-700"
 />
 {search && (
 <button onClick={() => setSearch('')}
 className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text">
 <X size={16} />
 </button>
 )}
 </div>
 {/* Category Pills */}
 {categories.length > 1 && (
 <div className="flex flex-wrap gap-2">
 <button
 onClick={() => setSelectedCategory(null)}
 className={`px-4 py-2 rounded-full text-xs font-bold transition-all border
 ${!selectedCategory
 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
 : 'bg-app-text/5 text-app-text-faint border-app-text/10 hover:border-app-text/20'
 }`}>
 All ({products.length})
 </button>
 {categories.map(cat => (
 <button
 key={cat}
 onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
 className={`px-4 py-2 rounded-full text-xs font-bold transition-all border
 ${selectedCategory === cat
 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
 : 'bg-app-text/5 text-app-text-faint border-app-text/10 hover:border-app-text/20'
 }`}>
 {cat}
 </button>
 ))}
 </div>
 )}
 </div>
 {/* Results Count */}
 {(search || selectedCategory) && (
 <p className="text-xs text-app-text-muted px-1">
 Showing {filtered.length} of {products.length} products
 {search && <> matching &quot;<span className="text-app-text">{search}</span>&quot;</>}
 {selectedCategory && <> in <span className="text-emerald-400">{selectedCategory}</span></>}
 </p>
 )}
 {/* Product Grid */}
 {filtered.length === 0 ? (
 <div className="py-16 text-center space-y-3">
 <Search size={36} className="mx-auto text-app-text-muted" />
 <p className="text-app-text font-bold">No products found</p>
 <p className="text-app-text-muted text-sm">Try adjusting your search or filter</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 {filtered.map((p, idx) => (
 <Link
 key={p.id}
 href={`/tenant/${slug}/product/${p.id}`}
 className="group relative bg-slate-900/40 backdrop-blur-3xl border border-app-text/5 rounded-[2.5rem] overflow-hidden hover:border-emerald-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10"
 style={{ animationDelay: `${idx * 100}ms` }}
 >
 <div className="aspect-[4/3] bg-slate-950 overflow-hidden relative">
 {p.image_url ? (
 <img
 src={p.image_url}
 alt={p.name}
 className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100"
 />
 ) : (
 <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
 <ShoppingBag size={40} className="text-app-text" />
 </div>
 )}
 <div className="absolute top-6 left-6 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] font-bold text-app-text uppercase tracking-wider border border-app-text/10">
 {p.category_name || 'Premium'}
 </div>
 <div className="absolute top-6 right-6 flex items-center gap-2">
 <button
 onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(p.id); }}
 className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg backdrop-blur-md border
 ${isInWishlist(p.id)
 ? 'bg-rose-500/80 text-app-text border-rose-500/50'
 : 'bg-black/40 text-app-text/70 hover:text-rose-400 border-app-text/10'
 }`}>
 <Heart size={18} fill={isInWishlist(p.id) ? 'currentColor' : 'none'} />
 </button>
 <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-app-text opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 shadow-lg shadow-emerald-900/40">
 <ArrowRight size={20} />
 </div>
 </div>
 </div>
 <div className="p-8 space-y-4">
 <div className="space-y-1">
 <div className="flex justify-between items-start">
 <h3 className="text-xl font-black text-app-text group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{p.name}</h3>
 <div className="flex items-center gap-1 text-emerald-500">
 <Star size={12} fill="currentColor" />
 <span className="text-[10px] font-black">4.9</span>
 </div>
 </div>
 <p className="text-[10px] text-app-text-muted font-mono tracking-widest">{p.sku}</p>
 </div>
 <div className="flex items-center justify-between pt-2">
 {showPrice ? (
 <div className="text-2xl font-black text-app-text">
 <span className="text-emerald-500 mr-1">$</span>
 {p.selling_price_ttc}
 </div>
 ) : (
 <div className="text-sm text-amber-400 flex items-center gap-2">
 <FileQuestion size={14} /> Request Quote
 </div>
 )}
 {/* Quick Action */}
 {storeMode === 'CATALOG_QUOTE' ? (
 <span className="px-6 py-2 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest">
 Get Quote
 </span>
 ) : (
 <button
 onClick={(e) => handleQuickAdd(p, e)}
 className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2
 ${addedIds.has(p.id)
 ? 'bg-emerald-500 text-app-text border border-emerald-500'
 : 'bg-app-text/5 hover:bg-emerald-500 text-app-text border border-app-text/10 hover:border-emerald-500'
 }`}>
 <ShoppingCart size={12} />
 {addedIds.has(p.id) ? 'Added!' : 'Add'}
 </button>
 )}
 </div>
 </div>
 </Link>
 ))}
 </div>
 )}
 {filtered.length > 0 && filtered.length < products.length && (
 <button
 onClick={() => { setSearch(''); setSelectedCategory(null); }}
 className="w-full py-8 bg-app-text/5 border border-app-text/10 text-app-text hover:bg-app-text/10 rounded-[2rem] text-xs font-black uppercase tracking-widest transition-all">
 Show All Products <ArrowRight className="ml-2 inline" size={16} />
 </button>
 )}
 </div>
 );
}
