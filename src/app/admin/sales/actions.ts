'use server';

import { prisma } from "@/lib/db";

import { getCurrentSiteId } from "@/app/actions/context";

// Cache for frequently accessed data (server-side)
let productsCache: any[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export async function getPosProducts(options: {
    search?: string;
    limit?: number;
    offset?: number;
    categoryId?: number;
} = {}) {
    const { search = '', limit = 100, offset = 0, categoryId } = options;
    const currentSiteId = await getCurrentSiteId();

    try {
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
            include: {
                inventory: {
                    where: {
                        warehouse: {
                            siteId: currentSiteId
                        }
                    },
                    select: {
                        quantity: true
                    }
                }
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
        // And calculate local stock level
        const serializedProducts = products.map(p => {
            const localStock = p.inventory.reduce((sum: number, item: any) => sum + Number(item.quantity), 0);
            return {
                ...p,
                costPrice: Number(p.costPrice),
                costPriceHT: Number(p.costPriceHT),
                costPriceTTC: Number(p.costPriceTTC),
                tvaRate: Number(p.tvaRate),
                sellingPriceHT: Number(p.sellingPriceHT),
                sellingPriceTTC: Number(p.sellingPriceTTC),
                basePrice: Number(p.basePrice),
                minPrice: Number(p.minPrice),
                taxRate: Number(p.taxRate),
                stock: localStock,
                inventory: undefined // Don't leak full relations
            };
        });

        return serializedProducts;

    } catch (error) {
        console.error('[getPosProducts] Database error:', error);
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
