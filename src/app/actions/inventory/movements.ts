'use server'

import { revalidatePath } from "next/cache";
import { erpFetch } from "@/lib/erp-api"

export type StockMovementState = {
    message?: string;
    success?: boolean;
};

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
    if (quantity <= 0) return { success: false, message: "Quantity must be greater than zero." }
    if (costPriceHT < 0) return { success: false, message: "Cost price cannot be negative." }
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

        revalidatePath('/inventory')
        revalidatePath('/finance/ledger')

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

        revalidatePath('/inventory')
        return { success: true, message: result.message || `Successfully adjusted stock by ${quantity}.` }
    } catch (e: any) {
        console.error("Adjustment Error:", e)
        return { success: false, message: "Error: " + (e.message || e) }
    }
}

/**
 * Transfers stock between warehouses within the same organization.
 */
export async function transferStock(
    productId: number,
    sourceWarehouseId: number,
    destinationWarehouseId: number,
    quantity: number,
    reference?: string
): Promise<StockMovementState> {
    try {
        if (quantity <= 0) return { success: false, message: "Quantity must be positive." }
        if (sourceWarehouseId === destinationWarehouseId) {
            return { success: false, message: "Source and destination warehouse must be different." }
        }

        const result = await erpFetch('inventory/transfer_stock/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product_id: productId,
                source_warehouse_id: sourceWarehouseId,
                destination_warehouse_id: destinationWarehouseId,
                quantity,
                reference
            })
        })

        revalidatePath('/inventory')
        return { success: true, message: result.message || `Successfully transferred ${quantity} items.` }
    } catch (e: any) {
        console.error("Transfer Error:", e)
        return { success: false, message: "Error: " + (e.message || e) }
    }
}
