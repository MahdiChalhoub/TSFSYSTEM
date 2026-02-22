'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

// Cache for frequently accessed data (server-side)
let productsCache: Record<string, any>[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export async function getPosProducts(options: {
    search?: string;
    limit?: number;
    offset?: number;
    categoryId?: number;
} = {}) {
    const { search = '', limit = 100, offset = 0, categoryId } = options;

    try {
        const queryParams = new URLSearchParams();
        if (search) queryParams.append('query', search);
        // Add limit/offset if backend supports it

        const products = await erpFetch(`products/search_enhanced/?${queryParams.toString()}`);
        return products;
    } catch (error) {
        console.error('[getPosProducts] API error:', error);
        return [];
    }
}

export async function getProductCount(search?: string) {
    // Stub for now
    return 100;
}

export async function clearProductsCache() {
    productsCache = null;
    cacheTimestamp = 0;
    return { success: true };
}

export async function getCategories() {
    try {
        return await erpFetch('inventory/categories/');
    } catch (error) {
        console.error('[getCategories] Error:', error);
        return [];
    }
}

export async function processSale(data: {
    cart: Record<string, any>[],
    paymentMethod: string,
    totalAmount: number,
    scope?: string,
    notes?: string,
    warehouseId?: number,
    paymentAccountId?: number
}) {
    try {
        const response = await erpFetch('pos/checkout/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: data.cart.map(item => ({
                    product_id: item.productId,
                    quantity: item.quantity,
                    unit_price: item.price
                })),
                warehouse_id: data.warehouseId || 1, // Fallback need actual ID
                payment_account_id: data.paymentAccountId,
                notes: data.notes,
                scope: data.scope || 'OFFICIAL'
            })
        });

        return { success: true, orderId: response.order_id, ref: response.ref || "POS-WEB" };
    } catch (e: unknown) {
        console.error("POS Checkout Error:", e);
        throw new Error((e instanceof Error ? e.message : String(e)) || "Checkout Failed");
    }
}