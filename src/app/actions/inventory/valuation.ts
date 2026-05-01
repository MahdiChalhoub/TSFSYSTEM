'use server'

import { erpFetch, handleAuthError } from "@/lib/erp-api"

export async function getStockValuation(warehouseId?: number) {
    const params = warehouseId ? `?warehouse_id=${warehouseId}` : ''
    return await erpFetch(`inventory/stock-valuation/${params}`)
}

export async function getWarehouses() {
    try {
        const data = await erpFetch('inventory/warehouses/')
        return Array.isArray(data) ? data : []
    } catch (error) {
        handleAuthError(error)
        return []
    }
}
