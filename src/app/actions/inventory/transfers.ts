'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

export async function getTransfers(params: Record<string, any> = {}) {
 const searchParams = new URLSearchParams()
 Object.entries(params).forEach(([k, v]) => {
 if (v !== undefined && v !== null && v !== '') {
 searchParams.append(k, String(v))
 }
 })
 const qs = searchParams.toString()
 return await erpFetch(`inventory/stock-moves/${qs ? `?${qs}` : ''}`)
}

export async function getTransfer(id: string | number) {
 return await erpFetch(`inventory/stock-moves/${id}/`)
}

export async function createTransfer(data: {
 from_warehouse: number;
 to_warehouse: number;
 scheduled_date?: string;
 notes?: string;
 lines: Array<{ product: number; quantity: number | string }>;
}) {
 try {
 const response = await erpFetch('inventory/stock-moves/', {
 method: 'POST',
 body: JSON.stringify(data)
 })
 revalidatePath('/inventory/transfer-orders')
 return { success: true, data: response }
 } catch (e: any) {
 return { success: false, error: e.message || 'Failed to create transfer' }
 }
}

export async function triggerTransferAction(id: string | number, action: 'submit' | 'dispatch' | 'receive' | 'cancel', reason?: string, quantities?: Record<string, string | number>) {
 try {
 const payload: any = { action }
 if (reason) payload.reason = reason
 if (quantities) payload.quantities = quantities

 const response = await erpFetch(`inventory/stock-moves/${id}/action/`, {
 method: 'POST',
 body: JSON.stringify(payload)
 })
 revalidatePath('/inventory/transfer-orders')
 revalidatePath(`/inventory/transfer-orders/${id}`)
 return { success: true, data: response }
 } catch (e: any) {
 return { success: false, error: e.message || `Failed to ${action} transfer` }
 }
}

export async function getTransfersUDLE(params: string = "") {
 try {
 const url = params ? `inventory/stock-moves/?${params}` : 'inventory/stock-moves/';
 return await erpFetch(url);
 } catch (e) {
 console.error("Failed to fetch transfer orders", e);
 return { results: [], count: 0 };
 }
}

export async function getTransfersMeta() {
 try {
 return await erpFetch('inventory/stock-moves/schema-meta/');
 } catch (e) {
 console.error("Failed to fetch transfer orders metadata", e);
 throw e;
 }
}
