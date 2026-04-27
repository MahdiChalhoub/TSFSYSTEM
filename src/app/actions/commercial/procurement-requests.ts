'use server';

import { revalidatePath } from 'next/cache';
import { erpFetch } from '@/lib/erp-api';

export interface SuggestedQuantity {
    product_id: number;
    suggested_qty: number;
    source: 'formula' | 'reorder_quantity' | 'min_stock' | 'fallback';
    reason: string;
    inputs?: {
        avg_daily_sales: number;
        sales_avg_period_days: number;
        proposed_qty_lead_days: number;
        proposed_qty_safety_multiplier: number;
    };
}

export async function getSuggestedQuantity(productId: number): Promise<SuggestedQuantity | null> {
    try {
        const result = await erpFetch(`procurement-requests/suggest-quantity/?product_id=${productId}`);
        if (result && typeof result === 'object' && 'suggested_qty' in result) return result as SuggestedQuantity;
        return null;
    } catch (error) {
        console.error('Failed to fetch suggested quantity', error);
        return null;
    }
}

/**
 * Create a procurement request (transfer or purchase from another supplier).
 */
export async function createProcurementRequest(data: {
    requestType: 'TRANSFER' | 'PURCHASE';
    productId: number;
    quantity: number;
    fromWarehouseId?: number;
    toWarehouseId?: number;
    supplierId?: number;
    suggestedUnitPrice?: number;
    reason?: string;
    priority?: string;
}) {
    const payload: Record<string, unknown> = {
        request_type: data.requestType,
        product: data.productId,
        quantity: data.quantity,
    };
    if (data.fromWarehouseId != null) payload.from_warehouse = data.fromWarehouseId;
    if (data.toWarehouseId != null) payload.to_warehouse = data.toWarehouseId;
    if (data.supplierId != null) payload.supplier = data.supplierId;
    if (data.suggestedUnitPrice != null) payload.suggested_unit_price = data.suggestedUnitPrice;
    if (data.reason != null) payload.reason = data.reason;
    if (data.priority != null) payload.priority = data.priority;

    try {
        const result = await erpFetch('procurement-requests/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        revalidatePath('/inventory/requests');
        revalidatePath('/inventory/products');
        return result;
    } catch (error) {
        console.error('Failed to create procurement request:', error);
        throw error;
    }
}
