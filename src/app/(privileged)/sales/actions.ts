'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";
import { getCommercialContext } from "@/app/actions/commercial";

/**
 * Enhanced product search for POS with Next.js cache integration
 */
export async function getPosProducts(options: {
    search?: string;
    limit?: number;
    offset?: number;
    categoryId?: number;
    category?: number;
} = {}) {
    const { search = '', limit = 100, offset = 0, categoryId, category } = options;
    const effectiveCategoryId = categoryId || category;

    try {
        const queryParams = new URLSearchParams();
        if (search) queryParams.append('query', search);
        if (effectiveCategoryId) queryParams.append('category', String(effectiveCategoryId));
        queryParams.append('limit', String(limit));
        queryParams.append('offset', String(offset));

        // Use fetch cache for high-frequency search
        const data = await erpFetch(`products/search_enhanced/?${queryParams.toString()}`, {
            next: { revalidate: 0, tags: ['products', 'pos'] }
        });
        console.log(`[DEBUG] getPosProducts returned ${data?.length} items. First item price:`, data?.[0]?.basePrice);
        return data;
    } catch (error) {
        console.error('[getPosProducts] API error:', error);
        return [];
    }
}

/**
 * Get total product count for pagination/metrics
 */
export async function getProductCount(options: { search?: string; categoryId?: number } = {}) {
    try {
        const queryParams = new URLSearchParams();
        if (options.search) queryParams.append('query', options.search);
        const catId = options.categoryId || (options as any).category;
        if (catId) queryParams.append('category', String(catId));

        const res = await erpFetch(`products/count/?${queryParams.toString()}`);
        return res.count || 0;
    } catch (error) {
        console.error('[getProductCount] Error:', error);
        return 0;
    }
}

export async function clearProductsCache() {
    // In Next.js, we revalidate tags instead of clearing local vars
    revalidatePath('/sales');
    return { success: true };
}

export async function getCategories() {
    try {
        const data = await erpFetch('inventory/categories/with_counts/?limit=500', {
            next: { revalidate: 0, tags: ['categories'] }
        });
        const cats = Array.isArray(data) ? data : (data?.results || []);
        console.log(`[DEBUG] getCategories returned ${cats.length} categories.`);
        return cats;
    } catch (error) {
        console.error('[getCategories] Error:', error);
        return [];
    }
}

export async function getDeliveryZones() {
    try {
        const data = await erpFetch('pos/delivery-zones/', {
            next: { revalidate: 0, tags: ['delivery-zones'] }
        });
        return Array.isArray(data) ? data : (data?.results || []);
    } catch (error) {
        console.error('[getDeliveryZones] Error:', error);
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
    pointsRedeemed?: number,
    storeChangeInWallet?: boolean,
    cashReceived?: number
}) {
    try {
        const context = await getCommercialContext();

        const response = await erpFetch('pos/checkout/', {
            method: 'POST',
            body: JSON.stringify({
                items: data.cart.map(item => ({
                    product_id: item.productId,
                    quantity: item.quantity,
                    unit_price: item.price
                })),
                warehouse_id: data.warehouseId || context.defaultWarehouseId,
                payment_account_id: data.paymentAccountId,
                payment_method: data.paymentMethod,
                notes: data.notes,
                scope: data.scope || 'OFFICIAL',
                total_amount: data.totalAmount,
                contact_id: data.clientId,
                points_redeemed: data.pointsRedeemed || 0,
                store_change_in_wallet: data.storeChangeInWallet || false,
                cash_received: data.cashReceived || 0
            })
        });

        revalidatePath('/sales/history');
        return { success: true, orderId: response.order_id, ref: response.ref || "POS-WEB" };
    } catch (e: unknown) {
        console.error("POS Checkout Error:", e);
        throw new Error((e instanceof Error ? e.message : String(e)) || "Checkout Failed");
    }
}