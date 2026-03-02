'use server'

import { erpFetch } from "@/lib/erp-api"

// =============================================================================
// WAREHOUSE LOCATION ACTIONS (Gap 2 Fix)
// Backend: WarehouseZoneViewSet, AisleViewSet, RackViewSet,
// ShelfViewSet, BinViewSet, ProductLocationViewSet
// =============================================================================

// ── Zones ───────────────────────────────────────────────────────────────

export async function getWarehouseZones(warehouseId?: string) {
 const query = warehouseId ? `?warehouse=${warehouseId}` : ''
 return await erpFetch(`inventory/zones/${query}`)
}

export async function getWarehouseZone(id: string) {
 return await erpFetch(`inventory/zones/${id}/`)
}

export async function createWarehouseZone(data: Record<string, unknown>) {
 return await erpFetch('inventory/zones/', {
 method: 'POST',
 body: JSON.stringify(data),
 })
}

export async function updateWarehouseZone(id: string, data: Record<string, unknown>) {
 return await erpFetch(`inventory/zones/${id}/`, {
 method: 'PATCH',
 body: JSON.stringify(data),
 })
}

export async function deleteWarehouseZone(id: string) {
 return await erpFetch(`inventory/zones/${id}/`, {
 method: 'DELETE',
 })
}

// ── Aisles ──────────────────────────────────────────────────────────────

export async function getAisles(zoneId?: string) {
 const query = zoneId ? `?zone=${zoneId}` : ''
 return await erpFetch(`inventory/aisles/${query}`)
}

export async function createAisle(data: Record<string, unknown>) {
 return await erpFetch('inventory/aisles/', {
 method: 'POST',
 body: JSON.stringify(data),
 })
}

export async function updateAisle(id: string, data: Record<string, unknown>) {
 return await erpFetch(`inventory/aisles/${id}/`, {
 method: 'PATCH',
 body: JSON.stringify(data),
 })
}

export async function deleteAisle(id: string) {
 return await erpFetch(`inventory/aisles/${id}/`, {
 method: 'DELETE',
 })
}

// ── Racks ───────────────────────────────────────────────────────────────

export async function getRacks(aisleId?: string) {
 const query = aisleId ? `?aisle=${aisleId}` : ''
 return await erpFetch(`inventory/racks/${query}`)
}

export async function createRack(data: Record<string, unknown>) {
 return await erpFetch('inventory/racks/', {
 method: 'POST',
 body: JSON.stringify(data),
 })
}

export async function deleteRack(id: string) {
 return await erpFetch(`inventory/racks/${id}/`, {
 method: 'DELETE',
 })
}

// ── Shelves ─────────────────────────────────────────────────────────────

export async function getShelves(rackId?: string) {
 const query = rackId ? `?rack=${rackId}` : ''
 return await erpFetch(`inventory/shelves/${query}`)
}

export async function createShelf(data: Record<string, unknown>) {
 return await erpFetch('inventory/shelves/', {
 method: 'POST',
 body: JSON.stringify(data),
 })
}

export async function deleteShelf(id: string) {
 return await erpFetch(`inventory/shelves/${id}/`, {
 method: 'DELETE',
 })
}

// ── Bins ────────────────────────────────────────────────────────────────

export async function getBins(shelfId?: string) {
 const query = shelfId ? `?shelf=${shelfId}` : ''
 return await erpFetch(`inventory/bins/${query}`)
}

export async function createBin(data: Record<string, unknown>) {
 return await erpFetch('inventory/bins/', {
 method: 'POST',
 body: JSON.stringify(data),
 })
}

export async function deleteBin(id: string) {
 return await erpFetch(`inventory/bins/${id}/`, {
 method: 'DELETE',
 })
}

// ── Product Locations ───────────────────────────────────────────────────

export async function getProductLocations(productId?: string) {
 const query = productId ? `?product=${productId}` : ''
 return await erpFetch(`inventory/product-locations/${query}`)
}

export async function assignProductLocation(data: Record<string, unknown>) {
 return await erpFetch('inventory/product-locations/', {
 method: 'POST',
 body: JSON.stringify(data),
 })
}

export async function removeProductLocation(id: string) {
 return await erpFetch(`inventory/product-locations/${id}/`, {
 method: 'DELETE',
 })
}
