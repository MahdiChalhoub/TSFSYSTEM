'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

export async function getOrderPayments(orderId: string | number) {
 try {
 const data = await erpFetch(`pos/orders/${orderId}/payments/`)
 return { success: true, data }
 } catch (error: any) {
 console.error('Failed to fetch order payments:', error)
 return { success: false, error: error.message || 'Failed to fetch payments' }
 }
}

export async function processPaymentAction(orderId: string | number, actionType: 'reconcile' | 'write_off' | 'refund', payload: any = {}) {
 try {
 const response = await erpFetch(`pos/orders/${orderId}/payments/`, {
 method: 'POST',
 body: JSON.stringify({
 action: actionType,
 ...payload
 })
 })
 revalidatePath(`/sales/${orderId}`)
 return { success: true, data: response }
 } catch (error: any) {
 console.error(`Failed to execute payment action ${actionType}:`, error)
 return { success: false, error: error.message || `Failed to process ${actionType}` }
 }
}
