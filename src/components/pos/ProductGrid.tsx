'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Product } from "@/types/erp";
import { getPosProducts } from '@/app/(privileged)/sales/actions';
import clsx from 'clsx';
import { AlertCircle, Loader2, PackageX, WifiOff } from 'lucide-react';
import { cacheProducts, getCachedProducts, type OfflineProduct } from '@/lib/offline/db';
import { useOnlineStatus } from '@/lib/offline/hooks';

const ITEMS_PER_LOAD = 50; // Load 50 products at a time
const SEARCH_DEBOUNCE_MS = 300; // Wait 300ms after user stops typing

export function ProductGrid({ searchQuery, onAddToCart }: { searchQuery: string, onAddToCart: (p: Record<string, any>) => void }) {
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
                const data = await getPosProducts({ limit: ITEMS_PER_LOAD });
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
    }, [cacheToOffline, loadFromCache]);

    // Handle search changes
    useEffect(() => {
        if (searchQuery) {
            debouncedSearch(searchQuery);
        } else {
            // Reset to initial load when search is cleared
            setLoading(true);
            getPosProducts({ limit: ITEMS_PER_LOAD })
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
    }, [searchQuery, debouncedSearch]);

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
                <Loader2 className="w-12 h-12 text-app-info animate-spin mb-4" />
                <p className="text-app-muted-foreground font-medium">Loading products...</p>
                <p className="text-sm text-app-muted-foreground mt-1">This may take a moment for large catalogs</p>
            </div>
        );
    }

    // Error state
    if (error && products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 bg-app-error-soft rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-app-error" />
                </div>
                <h3 className="mb-2">Unable to Load Products</h3>
                <p className="text-app-muted-foreground mb-4 max-w-md">{error}</p>
                <button
                    onClick={retry}
                    className="px-6 py-2 bg-app-info text-white rounded-lg hover:bg-app-info transition-colors font-medium"
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
                    <PackageX className="w-8 h-8 text-app-muted-foreground" />
                </div>
                <h3 className="mb-2">No Products Found</h3>
                <p className="text-app-muted-foreground">
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
                <div className="flex items-center gap-2 px-4 py-2 bg-app-warning-soft border border-app-warning rounded-lg text-app-warning text-sm">
                    <WifiOff size={16} />
                    <span className="font-medium">Offline Mode</span>
                    <span className="text-app-warning">— Showing cached products. Orders will sync when you reconnect.</span>
                </div>
            )}

            {/* Product Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map(product => (
                    <div
                        key={product.id}
                        onClick={() => onAddToCart(product)}
                        className="bg-white p-4 rounded-xl border border-app-border shadow-sm hover:shadow-md hover:border-app-info cursor-pointer transition-all active:scale-95 select-none flex flex-col justify-between h-[160px]"
                    >
                        <div>
                            {/* Placeholder for Image */}
                            <div className="w-8 h-8 rounded-full bg-app-info-soft text-app-info flex items-center justify-center text-sm font-bold mb-3">
                                {product.name.substring(0, 2).toUpperCase()}
                            </div>
                            <h3 className="line-clamp-2">{product.name}</h3>
                            <p className="text-xs text-app-muted-foreground mt-1">{product.sku}</p>
                        </div>

                        <div className="flex justify-between items-end mt-2">
                            <span className="font-bold text-lg text-app-foreground">${Number(product.basePrice).toFixed(2)}</span>
                            {Number(product.taxRate) > 0 && (
                                <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-app-muted-foreground">
                                    {product.isTaxIncluded ? 'Tax Inc' : '+Tax'}
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
                        <div className="flex items-center gap-2 text-app-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm">Loading more products...</span>
                        </div>
                    )}
                </div>
            )}

            {/* End of catalog indicator */}
            {!hasMore && products.length > 0 && (
                <div className="text-center py-6 text-sm text-app-muted-foreground">
                    {searchQuery
                        ? `Showing all ${products.length} results for "${searchQuery}"`
                        : `All ${products.length} products loaded`
                    }
                </div>
            )}
        </div>
    );
}