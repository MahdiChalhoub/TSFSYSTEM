'use server'
/**
 * Inventory Business Events — Server Actions
 * ============================================
 * Actions for GiftSampleEvent and InternalConsumptionEvent.
 * These are cross-cutting business events that live in inventory.
 *
 * API paths still use finance/ routes (backend router unchanged)
 * until backend URL migration is complete.
 */
import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

// ─── Gift / Sample Events ───────────────────────────────────────────

export async function getGiftSampleEvents() {
  return erpFetch('finance/gift-sample-vat/')
}

export async function getGiftSampleEvent(id: string | number) {
  return erpFetch(`finance/gift-sample-vat/${id}/`)
}

export async function createGiftSampleEvent(data: any) {
  const result = await erpFetch('finance/gift-sample-vat/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  revalidatePath('/inventory/gift-sample')
  revalidatePath('/finance/gift-sample-vat') // backward-compat
  return result
}

export async function updateGiftSampleEvent(id: string | number, data: any) {
  const result = await erpFetch(`finance/gift-sample-vat/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  revalidatePath('/inventory/gift-sample')
  revalidatePath('/finance/gift-sample-vat')
  return result
}

export async function assessGiftSampleEvent(id: string | number) {
  const result = await erpFetch(`finance/gift-sample-vat/${id}/assess/`, {
    method: 'POST',
  })
  revalidatePath('/inventory/gift-sample')
  revalidatePath('/finance/gift-sample-vat')
  return result
}

export async function getGiftSampleDashboard() {
  return erpFetch('finance/gift-sample-vat/dashboard/')
}

// ─── Internal Consumption (Self-Supply) ─────────────────────────────

export async function getInternalConsumptionEvents() {
  return erpFetch('finance/self-supply-vat/')
}

export async function getInternalConsumptionEvent(id: string | number) {
  return erpFetch(`finance/self-supply-vat/${id}/`)
}

export async function createInternalConsumptionEvent(data: any) {
  const result = await erpFetch('finance/self-supply-vat/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  revalidatePath('/inventory/internal-consumption')
  revalidatePath('/finance/self-supply-vat')
  return result
}

export async function updateInternalConsumptionEvent(id: string | number, data: any) {
  const result = await erpFetch(`finance/self-supply-vat/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  revalidatePath('/inventory/internal-consumption')
  revalidatePath('/finance/self-supply-vat')
  return result
}

export async function assessInternalConsumption(id: string | number) {
  const result = await erpFetch(`finance/self-supply-vat/${id}/assess/`, {
    method: 'POST',
  })
  revalidatePath('/inventory/internal-consumption')
  revalidatePath('/finance/self-supply-vat')
  return result
}

export async function getInternalConsumptionDashboard() {
  return erpFetch('finance/self-supply-vat/dashboard/')
}
