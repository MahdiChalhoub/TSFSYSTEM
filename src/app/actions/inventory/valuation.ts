'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getStockValuation(warehouseId?: number) {
    const params = warehouseId ? `?warehouse_id=${warehouseId}` : ''
    return await erpFetch(`inventory/stock-valuation/${params}`)
}

export async function getWarehouses() {
    try {
        const data = await erpFetch('inventory/warehouses/')
        return Array.isArray(data) ? data : []
    } catch {
        return []
    }
}
