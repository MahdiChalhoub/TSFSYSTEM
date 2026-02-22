'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

// ── Warehouse Zones, Aisles, Racks, Shelves, Bins ────────────────

export async function getWarehouseZones(warehouseId?: number) {
    const qs = warehouseId ? `?warehouse=${warehouseId}` : ''
    try { return await erpFetch(`inventory/zones/${qs}`) } catch { return [] }
}

export async function getAisles(zoneId?: number) {
    const qs = zoneId ? `?zone=${zoneId}` : ''
    try { return await erpFetch(`inventory/aisles/${qs}`) } catch { return [] }
}

export async function createAisle(data: Record<string, any>) {
    const r = await erpFetch('inventory/aisles/', { method: 'POST', body: JSON.stringify(data) })
    revalidatePath('/inventory/warehouses')
    return r
}

export async function getRacks(aisleId?: number) {
    const qs = aisleId ? `?aisle=${aisleId}` : ''
    try { return await erpFetch(`inventory/racks/${qs}`) } catch { return [] }
}

export async function createRack(data: Record<string, any>) {
    const r = await erpFetch('inventory/racks/', { method: 'POST', body: JSON.stringify(data) })
    revalidatePath('/inventory/warehouses')
    return r
}

export async function getShelves(rackId?: number) {
    const qs = rackId ? `?rack=${rackId}` : ''
    try { return await erpFetch(`inventory/shelves/${qs}`) } catch { return [] }
}

export async function createShelf(data: Record<string, any>) {
    const r = await erpFetch('inventory/shelves/', { method: 'POST', body: JSON.stringify(data) })
    revalidatePath('/inventory/warehouses')
    return r
}

export async function getBins(shelfId?: number) {
    const qs = shelfId ? `?shelf=${shelfId}` : ''
    try { return await erpFetch(`inventory/bins/${qs}`) } catch { return [] }
}

export async function createBin(data: Record<string, any>) {
    const r = await erpFetch('inventory/bins/', { method: 'POST', body: JSON.stringify(data) })
    revalidatePath('/inventory/warehouses')
    return r
}

export async function getProductLocations(productId?: number) {
    const qs = productId ? `?product=${productId}` : ''
    try { return await erpFetch(`inventory/product-locations/${qs}`) } catch { return [] }
}

export async function assignProductLocation(data: Record<string, any>) {
    return await erpFetch('inventory/product-locations/', { method: 'POST', body: JSON.stringify(data) })
}

// ── Consignment Settlements ───────────────────────────────────────

export async function getConsignmentSettlements() {
    try { return await erpFetch('pos/consignment-settlements/') } catch { return [] }
}

export async function getConsignmentSettlement(id: number) {
    return await erpFetch(`pos/consignment-settlements/${id}/`)
}

// ── Supplier Sourcing & Pricing ───────────────────────────────────

export async function getSupplierSourcing(productId?: number) {
    const qs = productId ? `?product=${productId}` : ''
    try { return await erpFetch(`pos/sourcing/${qs}`) } catch { return [] }
}

export async function getSupplierPricingHistory(productId?: number, supplierId?: number) {
    const p = new URLSearchParams()
    if (productId) p.set('product', String(productId))
    if (supplierId) p.set('supplier', String(supplierId))
    const qs = p.toString() ? `?${p.toString()}` : ''
    try { return await erpFetch(`pos/supplier-pricing/${qs}`) } catch { return [] }
}

// ── Credit Notes ──────────────────────────────────────────────────

export async function getCreditNotes() {
    try { return await erpFetch('pos/credit-notes/') } catch { return [] }
}

// ── Purchase Orders ───────────────────────────────────────────────

export async function getPurchaseOrders() {
    try { return await erpFetch('pos/purchase-orders/') } catch { return [] }
}

export async function getPurchaseOrder(id: number) {
    return await erpFetch(`pos/purchase-orders/${id}/`)
}

export async function createPurchaseOrder(data: Record<string, any>) {
    const r = await erpFetch('pos/purchase-orders/', { method: 'POST', body: JSON.stringify(data) })
    revalidatePath('/purchases/purchase-orders')
    return r
}
