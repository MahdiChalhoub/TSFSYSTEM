'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Product } from "@/types/erp";
import { getPosProducts } from '@/app/(privileged)/sales/actions';
import clsx from 'clsx';
import { AlertCircle, Loader2, PackageX, WifiOff, Zap, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { cacheProducts, getCachedProducts, type OfflineProduct } from '@/lib/offline/db';
import { useOnlineStatus } from '@/lib/offline/hooks';
import { Badge } from "@/components/ui/badge";

const ITEMS_PER_LOAD = 50; // Load 50 products at a time
const SEARCH_DEBOUNCE_MS = 300; // Wait 300ms after user stops typing

export function ProductGrid({ searchQuery, onAddToCart, categoryId, currency = '$', variant = 'default' }: {
    searchQuery: string,
    onAddToCart: (p: Record<string, any>) => void,
    categoryId?: number | null,
    currency?: string,
    variant?: string
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
                return true;
            }
        } catch {
            // IndexedDB not available
        }
        return false;
    }, []);

    // Debounced search handler
    const debouncedSearch = useCallback((query: string) => {
        // Clear existing timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Set loading state immediately for UX
        setLoading(true);

        // Wait for user to stop typing
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                setError(null);
                const data = await getPosProducts({
                    search: query,
                    limit: ITEMS_PER_LOAD,
                    offset: 0
                });
                setProducts(data);
                setHasMore(data.length >= ITEMS_PER_LOAD);
                setOfflineMode(false);
                cacheToOffline(data);
            } catch (err) {
                console.error('Search error:', err);
                const loaded = await loadFromCache();
                if (!loaded) {
                    setError('Failed to search products. Please try again.');
                }
            } finally {
                setLoading(false);
            }
        }, SEARCH_DEBOUNCE_MS);
    }, [cacheToOffline, loadFromCache]);

    // Initial load
    useEffect(() => {
        const loadInitial = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await getPosProducts({ limit: ITEMS_PER_LOAD, categoryId: categoryId ?? undefined });
                setProducts(data);
                setHasMore(data.length >= ITEMS_PER_LOAD);
                setOfflineMode(false);
                cacheToOffline(data);
            } catch (err) {
                console.error('Initial load error:', err);
                const loaded = await loadFromCache();
                if (!loaded) {
                    setError('Failed to load products. Please refresh the page.');
                }
            } finally {
                setLoading(false);
            }
        };

        loadInitial();
    }, [cacheToOffline, loadFromCache, categoryId]);

    // Handle search changes
    useEffect(() => {
        if (searchQuery) {
            debouncedSearch(searchQuery);
        } else {
            // Reset to initial load when search is cleared
            setLoading(true);
            getPosProducts({ limit: ITEMS_PER_LOAD, categoryId: categoryId ?? undefined })
                .then(data => {
                    setProducts(data);
                    setHasMore(data.length >= ITEMS_PER_LOAD);
                })
                .catch(err => {
                    console.error('Reset error:', err);
                    setError('Failed to load products.');
                })
                .finally(() => setLoading(false));
        }

        // Cleanup timeout on unmount
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, debouncedSearch, categoryId]);

    // Load more products
    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;

        try {
            setLoadingMore(true);
            const data = await getPosProducts({
                search: searchQuery,
                limit: ITEMS_PER_LOAD,
                offset: products.length
            });

            if (data.length < ITEMS_PER_LOAD) {
                setHasMore(false);
            }

            setProducts(prev => [...prev, ...data]);
        } catch (err) {
            console.error('Load more error:', err);
            // Don't show error for load more failures, just stop loading
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, searchQuery, products.length]);

    // Infinite scroll observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [hasMore, loading, loadingMore, loadMore]);

    // Velocity Calculator (Fake for Intelligence Mode Demo)
    const getVelocityBadge = (id: number) => {
        const velocities = ['HIGH', 'MEDIUM', 'LOW', 'STABLE'];
        const vel = velocities[id % 4];

        switch (vel) {
            case 'HIGH': return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[7px] font-black tracking-widest gap-1"><TrendingUp size={8} /> FAST</Badge>;
            case 'MEDIUM': return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[7px] font-black tracking-widest gap-1"><Activity size={8} /> STEADY</Badge>;
            case 'LOW': return <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[7px] font-black tracking-widest gap-1"><TrendingDown size={8} /> SLOW</Badge>;
            default: return <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20 text-[7px] font-black tracking-widest opacity-50">STABLE</Badge>;
        }
    };

    // Retry handler
    const retry = () => {
        setError(null);
        setLoading(true);
        getPosProducts({ search: searchQuery, limit: ITEMS_PER_LOAD })
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
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Loading products...</p>
                <p className="text-sm text-gray-400 mt-1">This may take a moment for large catalogs</p>
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
                <h3 className="text-lg font-bold text-gray-900 mb-2">Unable to Load Products</h3>
                <p className="text-gray-500 mb-4 max-w-md">{error}</p>
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
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <PackageX className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">No Products Found</h3>
                <p className="text-gray-500">
                    {searchQuery
                        ? `No results for "${searchQuery}". Try a different search term.`
                        : 'No products available. Add products to get started.'
                    }
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Offline Mode Banner */}
            {offlineMode && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                    <WifiOff size={16} />
                    <span className="font-medium">Offline Mode</span>
                    <span className="text-amber-600">— Showing cached products. Orders will sync when you reconnect.</span>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {products.map(product => (
                    <div
                        key={product.id}
                        onClick={() => onAddToCart(product)}
                        className="group bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 active:scale-[0.96] select-none flex flex-col justify-between h-[160px] relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all duration-500 scale-50 group-hover:scale-100">
                            <Zap size={16} className="text-indigo-400 fill-indigo-400 animate-pulse" />
                        </div>

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                    {product.name.substring(0, 2).toUpperCase()}
                                </div>
                                {getVelocityBadge(product.id)}
                            </div>
                            <h3 className="font-bold text-gray-900 leading-tight line-clamp-2 text-[11px] tracking-tight mb-0.5 group-hover:text-indigo-600 transition-colors uppercase italic">{product.name}</h3>
                            <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none">{product.sku || 'SKU-NONE'}</p>
                        </div>

                        <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-50 relative z-10">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Price</span>
                                <span className="font-black text-sm text-indigo-600 leading-none tracking-tighter">{currency}{(Number(product.basePrice || product.price || 0)).toFixed(2)}</span>
                            </div>
                            {Number(product.taxRate) > 0 && (
                                <span className="text-[7px] font-black text-gray-300 uppercase">
                                    +VAT
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Infinite Scroll Target */}
            {hasMore && (
                <div ref={observerTarget} className="flex justify-center py-8">
                    {loadingMore && (
                        <div className="flex items-center gap-2 text-gray-500">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm">Loading more products...</span>
                        </div>
                    )}
                </div>
            )}

            {/* End of catalog indicator */}
            {!hasMore && products.length > 0 && (
                <div className="text-center py-6 text-sm text-gray-400">
                    {searchQuery
                        ? `Showing all ${products.length} results for "${searchQuery}"`
                        : `All ${products.length} products loaded`
                    }
                </div>
            )}
        </div>
    );
}