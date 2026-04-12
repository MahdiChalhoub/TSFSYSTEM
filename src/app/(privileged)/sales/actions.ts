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
        return await erpFetch('categories/');
    } catch (error) {
        console.error('[getCategories] Error:', error);
        return [];
    }
}

export async function syncOfflineOrders(orders: Record<string, any>[]) {
    try {
        const res = await erpFetch('pos/sync-offline/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orders }),
        });
        return res;
    } catch (e: unknown) {
        console.error('[syncOfflineOrders] Error:', e);
        return { success: false };
    }
}

export async function getPosSettings() {
    try {
        const res = await erpFetch('pos/settings/');
        return res || { loyaltyPointValue: 0.01 };
    } catch {
        return { loyaltyPointValue: 0.01 };
    }
}

export async function getClientFidelity(clientId: number) {
    try {
        return await erpFetch(`pos/clients/${clientId}/fidelity/`);
    } catch {
        return null;
    }
}

export async function getDeliveryZones() {
    try {
        const res = await erpFetch('pos/delivery-zones/');
        return Array.isArray(res) ? res : [];
    } catch {
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
    paymentAccountId?: number,
    clientId?: number,
    storeChangeInWallet?: boolean,
    pointsRedeemed?: number,
    cashReceived?: number,
    globalDiscount?: number,
    paymentLegs?: Record<string, any>[],
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

        return { success: true, orderId: response.order_id, ref: response.ref || "POS-WEB", fneStatus: response.fne_status, fneReference: response.fne_reference, fneToken: response.fne_token };
    } catch (e: unknown) {
        console.error("POS Checkout Error:", e);
        throw new Error((e instanceof Error ? e.message : String(e)) || "Checkout Failed");
    }
}