'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Product } from "@/types/erp";
import { getPosProducts } from '@/app/(privileged)/sales/actions';
import clsx from 'clsx';
import { AlertCircle, Loader2, PackageX, WifiOff, Zap, TrendingUp, TrendingDown, Activity, Plus } from 'lucide-react';
import { cacheProducts, getCachedProducts, type OfflineProduct } from '@/lib/offline/db';
import { useOnlineStatus } from '@/lib/offline/hooks';
import { Badge } from "@/components/ui/badge";
const ITEMS_PER_LOAD = 50; // Load 50 products at a time
const SEARCH_DEBOUNCE_MS = 300; // Wait 300ms after user stops typing

// Generate a unique, consistent color for each product based on its ID
// Modern, authoritative color palette for product avatars
const AVATAR_COLORS = [
 { bg: 'bg-emerald-500/10', text: 'text-emerald-500', hoverBg: 'bg-emerald-gradient' },
 { bg: 'bg-slate-500/10', text: 'text-app-text-muted', hoverBg: 'bg-slate-900' },
 { bg: 'bg-teal-500/10', text: 'text-teal-500', hoverBg: 'bg-teal-600' },
 { bg: 'bg-amber-500/10', text: 'text-amber-500', hoverBg: 'bg-amber-600' },
 { bg: 'bg-rose-500/10', text: 'text-rose-500', hoverBg: 'bg-rose-gradient' },
 { bg: 'bg-cyan-500/10', text: 'text-cyan-500', hoverBg: 'bg-cyan-600' },
];
const getAvatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];
export function ProductGrid({ searchQuery, onAddToCart, categoryId, currency = '$', variant = 'default', onAutoAdd, onNotFound, onProductsLoaded }: {
 searchQuery: string,
 onAddToCart: (p: Record<string, any>) => void,
 categoryId?: number | null,
 currency?: string,
 variant?: string,
 onAutoAdd?: (p: Record<string, any>) => void,
 onNotFound?: (query: string) => void,
 onProductsLoaded?: (products: any[]) => void,
}) {
 const [products, setProducts] = useState<Product[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [hasMore, setHasMore] = useState(true);
 const [loadingMore, setLoadingMore] = useState(false);
 const [offlineMode, setOfflineMode] = useState(false);
 const { isOnline } = useOnlineStatus();
 const observerTarget = useRef<HTMLDivElement>(null);
 const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
 const productsCountRef = useRef(0);
 const hasMoreRef = useRef(true);
 const loadingMoreRef = useRef(false);
 // Sync refs with state
 useEffect(() => {
 productsCountRef.current = products.length;
 }, [products.length]);
 useEffect(() => {
 hasMoreRef.current = hasMore;
 }, [hasMore]);
 useEffect(() => {
 loadingMoreRef.current = loadingMore;
 }, [loadingMore]);
 // Cache products to IndexedDB after successful fetch
 const cacheToOffline = useCallback(async (data: Record<string, any>[]) => {
 try {
 const offlineData: OfflineProduct[] = data.map(p => ({
 id: p.id,
 name: p.name,
 price: Number(p.basePrice || p.price || 0),
 taxRate: Number(p.taxRate || 0),
 isTaxIncluded: Boolean(p.isTaxIncluded),
 category: p.category?.name || '',
 sku: p.sku || '',
 stock: p.stock,
 cachedAt: Date.now(),
 }));
 await cacheProducts(offlineData);
 } catch (e) {
 console.warn('Failed to cache products offline:', e);
 }
 }, []);
 // Load from IndexedDB cache when offline
 const loadFromCache = useCallback(async () => {
 try {
 const cached = await getCachedProducts();
 if (cached.length > 0) {
 // Map back to component format
 const mapped = cached.map(p => ({
 id: p.id,
 name: p.name,
 basePrice: p.price,
 taxRate: p.taxRate,
 isTaxIncluded: p.isTaxIncluded,
 sku: p.sku || '',
 category: { name: p.category },
 }));
 setProducts(mapped);
 setOfflineMode(true);
 setHasMore(false);
 // Populate barcode index so offline scanning works
 if (onProductsLoaded) onProductsLoaded(mapped);
 return true;
 }
 } catch {
 // IndexedDB not available
 }
 return false;
 }, []);
 // Load products with combined filters
 const loadProducts = useCallback(async (query: string, catId: number | null | undefined, isLoadMore = false) => {
 if (isLoadMore && (!hasMoreRef.current || loadingMoreRef.current)) return;
 try {
 if (isLoadMore) setLoadingMore(true);
 else {
 setLoading(true);
 setProducts([]); // Clear for immediate feedback
 }
 setError(null);
 const data = await getPosProducts({
 search: query,
 limit: ITEMS_PER_LOAD,
 offset: isLoadMore ? productsCountRef.current : 0,
 categoryId: catId ?? undefined
 });
 if (isLoadMore) {
 setProducts(prev => [...prev, ...data]);
 setHasMore(data.length >= ITEMS_PER_LOAD);
 } else {
 setProducts(data);
 setHasMore(data.length >= ITEMS_PER_LOAD);
 setOfflineMode(false);
 cacheToOffline(data);
 // Populate the parent's barcode index (on first load and on every category/search load)
 if (onProductsLoaded) onProductsLoaded(data);
 }
 } catch (err) {
 console.error('Load products error:', err);
 if (!isLoadMore) {
 const loaded = await loadFromCache();
 if (!loaded) setError('Failed to load products. Please check your connection.');
 }
 } finally {
 setLoading(false);
 setLoadingMore(false);
 }
 }, [hasMore, loadingMore, cacheToOffline, loadFromCache]);

 // When search resolves: auto-add if 1 result, or notify if 0 results
 const prevSearchRef = useRef('');
 const autoAddedQueryRef = useRef('');
 useEffect(() => {
 if (!searchQuery || loading) return;
 if (searchQuery !== prevSearchRef.current) return; // Only run after load for current query
 if (searchQuery === autoAddedQueryRef.current) return; // Prevent infinite cart-add loop on re-renders

 if (products.length === 1 && onAutoAdd) {
 autoAddedQueryRef.current = searchQuery;
 onAutoAdd(products[0] as any);
 } else if (products.length === 0 && onNotFound) {
 autoAddedQueryRef.current = searchQuery;
 onNotFound(searchQuery);
 }
 }, [products, loading, searchQuery, onAutoAdd, onNotFound]);
 // Handle search and category changes with debounce
 useEffect(() => {
 if (searchQuery) {
 if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
 setLoading(true); // Immediate feedback
 prevSearchRef.current = '';
 searchTimeoutRef.current = setTimeout(() => {
 // When there's a search query, IGNORE categoryId → search ALL products
 loadProducts(searchQuery, null);
 prevSearchRef.current = searchQuery;
 }, SEARCH_DEBOUNCE_MS);
 } else {
 prevSearchRef.current = '';
 loadProducts('', categoryId);
 }
 return () => {
 if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
 };
 }, [searchQuery, categoryId]); // Removed loadProducts to prevent infinite loops
 // Infinite scroll observer
 useEffect(() => {
 const observer = new IntersectionObserver(
 (entries) => {
 if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
 loadProducts(searchQuery, categoryId, true);
 }
 },
 { threshold: 0.1 }
 );
 if (observerTarget.current) observer.observe(observerTarget.current);
 return () => observer.disconnect();
 }, [hasMore, loading, loadingMore, searchQuery, categoryId, loadProducts]);
 // Velocity Calculator (Fake for Intelligence Mode Demo)
 const getVelocityBadge = (id: number) => {
 const velocities = ['HIGH', 'MEDIUM', 'LOW', 'STABLE'];
 const vel = velocities[id % 4];
 switch (vel) {
 case 'HIGH': return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[7px] font-black tracking-widest gap-1"><TrendingUp size={8} /> FAST</Badge>;
 case 'MEDIUM': return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[7px] font-black tracking-widest gap-1"><Activity size={8} /> STEADY</Badge>;
 case 'LOW': return <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[7px] font-black tracking-widest gap-1"><TrendingDown size={8} /> SLOW</Badge>;
 default: return <Badge className="bg-slate-500/10 text-app-text-muted border-slate-500/20 text-[7px] font-black tracking-widest opacity-50">STABLE</Badge>;
 }
 };
 // Retry handler
 const retry = () => {
 setError(null);
 setLoading(true);
 getPosProducts({ search: searchQuery, limit: ITEMS_PER_LOAD, category: categoryId ?? undefined })
 .then(data => {
 setProducts(data);
 setHasMore(data.length >= ITEMS_PER_LOAD);
 })
 .catch(err => {
 setError('Failed to load products. Please check your connection.');
 })
 .finally(() => setLoading(false));
 };
 // Loading state
 if (loading && products.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center p-20 text-center animate-in fade-in zoom-in-95 duration-700">
 <div className="relative mb-8">
 <Loader2 className="w-16 h-16 text-emerald-500 animate-spin opacity-20" />
 <div className="absolute inset-0 flex items-center justify-center">
 <Activity className="w-6 h-6 text-emerald-500 animate-pulse" />
 </div>
 </div>
 <h2 className="text-xl font-black text-app-text uppercase tracking-widest mb-2">Loading Products</h2>
 <p className="text-[10px] font-bold text-app-text-faint uppercase tracking-[0.3em]">Loading products...</p>
 </div>
 );
 }
 // Error state
 if (error && products.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center p-12 text-center">
 <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
 <AlertCircle className="w-8 h-8 text-red-500" />
 </div>
 <h3 className="text-lg font-bold text-app-text mb-2">Unable to Load Products</h3>
 <p className="text-app-text-muted mb-4 max-w-md">{error}</p>
 <button
 onClick={retry}
 className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
 >
 Try Again
 </button>
 </div>
 );
 }
 // Empty state
 if (products.length === 0 && !loading) {
 return (
 <div className="flex flex-col items-center justify-center p-20 text-center animate-in fade-in zoom-in-95 duration-1000">
 <div className="w-24 h-24 bg-app-surface-2 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner relative overflow-hidden group">
 <div className="absolute inset-0 bg-emerald-gradient opacity-0 group-hover:opacity-10 transition-opacity" />
 <PackageX className="w-10 h-10 text-slate-300 group-hover:text-emerald-500 transition-colors duration-700" />
 </div>
 <h3 className="text-2xl font-black text-app-text uppercase tracking-tighter mb-3">Inventory Void Detected</h3>
 <p className="text-sm text-app-text-faint max-w-sm font-medium leading-relaxed">
 {searchQuery
 ? `A query for "${searchQuery}" yielded no operational matches in the current registry.`
 : 'No products found. Check your warehouse or category selection.'
 }
 </p>
 </div>
 );
 }
 return (
 <div className="space-y-4">
 {/* Offline Mode Banner */}
 {offlineMode && (
 <div className="flex items-center gap-4 px-6 py-3 bg-slate-950 border border-emerald-500/20 rounded-[1.5rem] text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl relative overflow-hidden group">
 <div className="absolute inset-0 bg-emerald-500/5 animate-pulse" />
 <WifiOff size={14} className="animate-bounce shrink-0" />
 <div className="flex flex-col">
 <span className="flex items-center gap-2">Edge Computing Active <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" /></span>
 <span className="text-app-text-muted text-[8px] mt-0.5">Operating from Local Buffer • Operations will synchronize upon re-establishing uplink.</span>
 </div>
 </div>
 )}
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
 {products.map(product => (
 <div
 key={product.id}
 onClick={() => onAddToCart(product)}
 className="group bg-app-surface p-4 rounded-[2.5rem] border border-app-border shadow-sm hover:shadow-[0_20px_40px_rgba(16,185,129,0.12)] hover:border-emerald-500/20 hover:-translate-y-2 transition-all duration-500 active:scale-[0.94] select-none flex flex-col justify-between h-[180px] relative overflow-hidden"
 >
 {/* Interactive Sparkle Effect */}
 <div className="absolute -top-4 -right-4 w-12 h-12 bg-emerald-gradient rounded-full opacity-0 group-hover:opacity-10 scale-0 group-hover:scale-150 transition-all duration-1000 blur-xl" />

 <div className="absolute top-0 right-0 p-5 opacity-0 group-hover:opacity-100 transition-all duration-500 scale-50 group-hover:scale-100 origin-top-right">
 <div className="w-8 h-8 rounded-full bg-emerald-gradient flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
 <Plus size={16} strokeWidth={4} />
 </div>
 </div>

 <div className="relative z-10">
 <div className="flex justify-between items-start mb-3">
 {(product as any).imageUrl ? (
 <div className="h-10 w-10 p-0.5 rounded-xl bg-app-bg border border-app-border overflow-hidden group-hover:border-emerald-500/30 transition-all">
 <img
 src={(product as any).imageUrl}
 alt={product.name}
 className="w-full h-full rounded-lg object-cover group-hover:scale-110 transition-transform duration-700"
 onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).style.display = 'none'; }}
 />
 </div>
 ) : (
 (() => {
 const c = getAvatarColor(product.id);
 return (
 <div className={clsx(
 "w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black transition-all duration-500",
 c.bg, c.text, "group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-current/20"
 )}>
 {product.name.substring(0, 2).toUpperCase()}
 </div>
 );
 })()
 )}
 {getVelocityBadge(product.id)}
 </div>
 <h3 className="font-black text-app-text leading-[1.2] line-clamp-2 text-[11.5px] tracking-tight mb-1 group-hover:text-emerald-600 transition-colors uppercase italic outfit">
 {product.name}
 </h3>
 <div className="flex items-center gap-2">
 <span className="text-[7.5px] font-black text-slate-300 uppercase tracking-widest leading-none bg-app-surface-2 px-1.5 py-0.5 rounded">
 {product.sku || 'N/A'}
 </span>
 </div>
 </div>

 <div className="flex justify-between items-end mt-auto pt-3 border-t border-slate-50 relative z-10">
 <div className="flex flex-col">
 <span className="text-[8px] font-black text-app-text-faint uppercase tracking-[0.2em] mb-0.5">Settlement</span>
 <div className="flex items-baseline gap-0.5">
 <span className="text-[10px] font-black text-emerald-500 leading-none">{currency}</span>
 <span className="font-black text-lg text-app-text leading-none tracking-tighter tabular-nums">
 {(Number(product.basePrice || product.price || product.sellingPriceTTC || 0)).toFixed(2).split('.')[0]}
 <span className="text-[10px] opacity-40">.{(Number(product.basePrice || product.price || product.sellingPriceTTC || 0)).toFixed(2).split('.')[1]}</span>
 </span>
 </div>
 </div>
 {Number(product.taxRate) > 0 && (
 <Badge variant="outline" className="border-app-border text-[6.5px] font-black uppercase tracking-tighter text-slate-300 py-0 h-4">
 + {product.taxRate}% VAT
 </Badge>
 )}
 </div>
 </div>
 ))}
 </div>
 {/* Infinite Scroll Target */}
 {hasMore && (
 <div ref={observerTarget} className="flex justify-center py-8">
 {loadingMore && (
 <div className="flex items-center gap-2 text-app-text-muted">
 <Loader2 className="w-5 h-5 animate-spin" />
 <span className="text-sm">Loading more products...</span>
 </div>
 )}
 </div>
 )}
 {/* End of catalog indicator */}
 {!hasMore && products.length > 0 && (
 <div className="text-center py-6 text-sm text-app-text-faint">
 {searchQuery
 ? `Showing all ${products.length} results for "${searchQuery}"`
 : `All ${products.length} products loaded`
 }
 </div>
 )}
 </div>
 );
}