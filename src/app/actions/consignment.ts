'use server'

import { erpFetch } from '@/lib/erp-api'

/**
 * Get current inventory items marked as consignment.
 */
export async function getAvailableConsignmentStock() {
 return erpFetch('/inventory/available-consignment/')
}

/**
 * Get sold consignment items that are pending settlement.
 */
export async function getPendingConsignmentItems() {
 return erpFetch('/consignment-settlements/pending-items/')
}

/**
 * Get all consignment settlement records.
 */
export async function getConsignmentSettlements() {
 return erpFetch('/consignment-settlements/')
}

/**
 * Generate a new settlement for a specific supplier.
 */
export async function generateConsignmentSettlement(data: {
 supplier_id: number;
 line_ids: number[];
 notes?: string;
}) {
 return erpFetch('/consignment-settlements/generate-settlement/', {
 method: 'POST',
 body: JSON.stringify(data)
 })
}

/**
 * Get details of a specific settlement.
 */
export async function getConsignmentSettlement(id: number) {
 return erpFetch(`/consignment-settlements/${id}/`)
}
