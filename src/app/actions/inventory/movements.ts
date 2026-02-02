'use server';

import { revalidatePath } from "next/cache";

export type StockMovementState = {
    message?: string;
    success?: boolean;
};



import { erpFetch } from "@/lib/erp-api"

/**
 * Validates and Post a Stock Reception.
 * Updates quantity and calculates New Global AMC via Django ERP Core.
 */
export async function receiveStock(
    productId: number,
    warehouseId: number,
    quantity: number,
    unitId: number,
    costPriceHT: number,
    reference: string = "RECEPTION"
): Promise<StockMovementState> {
    try {
        const result = await erpFetch('inventory/receive_stock/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product_id: productId,
                warehouse_id: warehouseId,
                quantity,
                unit_id: unitId,
                cost_price_ht: costPriceHT,
                reference
            })
        })

        revalidatePath('/admin/inventory')
        revalidatePath('/admin/finance/ledger')

        return { success: true, message: result.message || `Successfully received ${quantity} items.` }
    } catch (e: any) {
        console.error("Reception Error:", e)
        return { success: false, message: "Error: " + (e.message || e) }
    }
}

/**
 * Performs a Manual Stock Adjustment (Gain or Loss).
 */
export async function adjustStock(
    productId: number,
    warehouseId: number,
    quantity: number,
    reason: string,
    notes?: string
): Promise<StockMovementState> {
    try {
        if (quantity === 0) return { success: false, message: "Quantity cannot be zero." }

        const result = await erpFetch('inventory/adjust_stock/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product_id: productId,
                warehouse_id: warehouseId,
                quantity,
                reason,
                notes
            })
        })

        revalidatePath('/admin/inventory')
        return { success: true, message: result.message || `Successfully adjusted stock by ${quantity}.` }
    } catch (e: any) {
        console.error("Adjustment Error:", e)
        return { success: false, message: "Error: " + (e.message || e) }
    }
}

