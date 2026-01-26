'use server';

import { prisma } from "@/lib/db";

// Cache for frequently accessed data (server-side)
let productsCache: any[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

/**
 * Get POS products with advanced optimization for 1000+ products
 * Features:
 * - Server-side caching (5 min TTL)
 * - Pagination support
 * - Search filtering
 * - Timeout protection
 * - Error handling
 */
export async function getPosProducts(options: {
    search?: string;
    limit?: number;
    offset?: number;
    categoryId?: number;
} = {}) {
    const { search = '', limit = 100, offset = 0, categoryId } = options;

    try {
        // Check cache first (only for non-search queries to keep search fresh)
        const now = Date.now();
        if (!search && productsCache && (now - cacheTimestamp) < CACHE_TTL) {
            console.log('[getPosProducts] Returning cached data');
            return productsCache.slice(offset, offset + limit);
        }

        // Build where clause for filtering
        const where: any = {};

        // Search filter (case-insensitive search on name and SKU)
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Category filter
        if (categoryId) {
            where.categoryId = categoryId;
        }

        // Execute query with timeout protection
        const fetchPromise = prisma.product.findMany({
            where,
            select: {
                id: true,
                name: true,
                basePrice: true,
                sku: true,
                taxRate: true,
                isTaxIncluded: true,
                categoryId: true,
                barcode: true,
            },
            orderBy: { name: 'asc' },
            take: limit,
            skip: offset,
        });

        // Add a manual timeout as backup (15 seconds)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database query timeout')), 15000)
        );

        const products = await Promise.race([fetchPromise, timeoutPromise]) as any[];

        // Convert Decimals to numbers for JSON serialization
        const serializedProducts = products.map(p => ({
            ...p,
            basePrice: Number(p.basePrice),
            taxRate: Number(p.taxRate)
        }));

        // Update cache if this was a full fetch (no search)
        if (!search && offset === 0) {
            productsCache = serializedProducts;
            cacheTimestamp = now;
        }

        return serializedProducts;

    } catch (error) {
        console.error('[getPosProducts] Database error:', error);

        // Return cached data as fallback if available
        if (productsCache && productsCache.length > 0) {
            console.warn('[getPosProducts] Returning stale cache due to error');
            return productsCache.slice(offset, offset + limit);
        }

        // Last resort: return empty array to prevent app crash
        console.error('[getPosProducts] No cache available, returning empty array');
        return [];
    }
}

/**
 * Get product count for pagination
 */
export async function getProductCount(search?: string) {
    try {
        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } },
            ];
        }

        const count = await prisma.product.count({ where });
        return count;
    } catch (error) {
        console.error('[getProductCount] Error:', error);
        return 0;
    }
}

/**
 * Clear the products cache (call after product updates)
 */
export async function clearProductsCache() {
    productsCache = null;
    cacheTimestamp = 0;
    return { success: true };
}

/**
 * Get categories for filtering
 */
export async function getCategories() {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' }
        });
        return categories;
    } catch (error) {
        console.error('[getCategories] Error:', error);
        return [];
    }
}
