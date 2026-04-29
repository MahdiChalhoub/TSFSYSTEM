'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getExpiryAlerts(severity?: string, acknowledged = false) {
    const params = new URLSearchParams()
    if (severity) params.set('severity', severity)
    if (acknowledged) params.set('acknowledged', 'true')
    const qs = params.toString() ? `?${params.toString()}` : ''
    return await erpFetch(`inventory/expiry-alerts/${qs}`)
}

export async function scanForExpiry() {
    const result = await erpFetch('inventory/scan-expiry/', {
        method: 'POST',
        body: JSON.stringify({})
    })
    revalidatePath('/inventory/expiry-alerts')
    return result
}

export async function acknowledgeAlert(alertId: number) {
    const result = await erpFetch('inventory/acknowledge-alert/', {
        method: 'POST',
        body: JSON.stringify({ alert_id: alertId })
    })
    revalidatePath('/inventory/expiry-alerts')
    return result
}

export async function createExpiryAlert(args: {
    productId: number
    quantity: number
    expiryDate: string  // ISO 'YYYY-MM-DD'
    batchNumber?: string
    notes?: string
    warehouseId?: number
}): Promise<{ success: boolean; alert_id?: number; batch_id?: number; severity?: string; days_until_expiry?: number; message?: string }> {
    const body: Record<string, unknown> = {
        product_id: args.productId,
        quantity: args.quantity,
        expiry_date: args.expiryDate,
    }
    if (args.batchNumber) body.batch_number = args.batchNumber
    if (args.notes) body.notes = args.notes
    if (args.warehouseId != null) body.warehouse_id = args.warehouseId

    try {
        const result = await erpFetch('inventory/expiry-alerts/create/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        revalidatePath('/inventory/expiry-alerts')
        revalidatePath('/inventory/products')
        return {
            success: true,
            alert_id: result?.alert_id,
            batch_id: result?.batch_id,
            severity: result?.severity,
            days_until_expiry: result?.days_until_expiry,
        }
    } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to create expiry alert' }
    }
}
