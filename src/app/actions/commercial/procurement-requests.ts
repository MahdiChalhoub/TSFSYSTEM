'use server';

import { erpFetch } from '@/lib/erp-api';

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
        return result;
    } catch (error) {
        console.error('Failed to create procurement request:', error);
        throw error;
    }
}
