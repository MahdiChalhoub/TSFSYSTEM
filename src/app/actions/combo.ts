'use server'

import { erpFetch } from '@/lib/erp-api'

// ─── Combo Component Actions ────────────────────────────────────────

/** Get all components of a combo product */
export async function getComboComponents(productId: number) {
 return erpFetch(`/products/${productId}/combo-components/`)
}

/** Add a component to a combo product */
export async function addComboComponent(
 productId: number,
 componentProductId: number,
 quantity: number = 1,
 priceOverride?: number,
 sortOrder: number = 0,
) {
 return erpFetch(`/products/${productId}/add-component/`, {
 method: 'POST',
 body: JSON.stringify({
 component_product_id: componentProductId,
 quantity,
 price_override: priceOverride ?? null,
 sort_order: sortOrder,
 }),
 })
}

/** Remove a component from a combo product */
export async function removeComboComponent(productId: number, componentId: number) {
 return erpFetch(`/products/${productId}/remove-component/${componentId}/`, {
 method: 'DELETE',
 })
}
