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
    try {
        const result = await erpFetch('procurement-requests/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return result;
    } catch (error) {
        console.error('Failed to create procurement request:', error);
        throw error;
    }
}
