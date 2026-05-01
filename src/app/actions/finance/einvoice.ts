'use server'

import { erpFetch, handleAuthError } from '@/lib/erp-api'
import { serialize } from '@/lib/utils'

export async function submitEInvoice(invoiceId: string | number) {
 return await erpFetch(`finance/einvoice/submit/${invoiceId}/`, { method: 'POST' })
}

export async function getEInvoiceStatus(invoiceId: string | number) {
 return await erpFetch(`finance/einvoice/status/${invoiceId}/`)
}

export async function getEInvoiceQR(invoiceId: string | number) {
 return await erpFetch(`finance/einvoice/qr/${invoiceId}/`)
}

export async function getGatewayConfigs() {
 try {
 const data = await erpFetch('finance/gateway-configs/')
 return serialize(data)
 } catch (error) {     handleAuthError(error)
 return [] }
}

export async function createGatewayConfig(data: Record<string, any>) {
 return await erpFetch('finance/gateway-configs/', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateGatewayConfig(id: number, data: Record<string, any>) {
 return await erpFetch(`finance/gateway-configs/${id}/`, { method: 'PATCH', body: JSON.stringify(data) })
}

export async function setGatewayKeys(id: number, apiKey: string, webhookSecret?: string) {
 return await erpFetch(`finance/gateway-configs/${id}/set-keys/`, {
 method: 'POST',
 body: JSON.stringify({ api_key: apiKey, webhook_secret: webhookSecret })
 })
}

export async function testGatewayConnection(id: number) {
 return await erpFetch(`finance/gateway-configs/${id}/test-connection/`, { method: 'POST' })
}

export async function deleteGatewayConfig(id: number) {
 return await erpFetch(`finance/gateway-configs/${id}/`, { method: 'DELETE' })
}

// ═══════════════════════════════════════════════════════════════
// FNE E-Invoicing (Côte d'Ivoire)
// ═══════════════════════════════════════════════════════════════

export type FNECertifyRequest = {
  invoice_type: 'sale' | 'creditNote' | 'purchase'
  payment_method: string
  template: 'B2C' | 'B2B' | 'B2G' | 'B2F'
  client_ncc?: string
  client_company_name?: string
  client_phone?: string
  client_email?: string
  client_seller_name?: string
  point_of_sale?: string
  establishment?: string
  commercial_message?: string
  footer?: string
  discount?: number
  parent_reference?: string
  foreign_currency?: string
  foreign_currency_rate?: number
  items: {
    description: string
    quantity: number
    amount: number
    taxes: string[]
    reference?: string
    discount?: number
    measurementUnit?: string
    customTaxes?: { name: string; amount: number }[]
  }[]
  customTaxes?: { name: string; amount: number }[]
}

export type FNECertifyResponse = {
  success: boolean
  reference?: string
  ncc?: string
  token?: string
  qr_url?: string
  warning?: boolean
  balance_sticker?: number
  invoice_id?: string
  invoice?: Record<string, any>
  error?: string
}

export async function fneCertifyInvoice(data: FNECertifyRequest): Promise<FNECertifyResponse> {
  try {
    const res = await erpFetch('finance/fne/certify/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return res as FNECertifyResponse
  } catch (e: any) {
    return { success: false, error: e?.message || 'FNE certification failed' }
  }
}

export async function fneTestConnection(apiKey: string, baseUrl?: string) {
  try {
    return await erpFetch('finance/fne/test-connection/', {
      method: 'POST',
      body: JSON.stringify({
        api_key: apiKey,
        base_url: baseUrl || 'http://54.247.95.108/ws',
      }),
    })
  } catch (e: any) {
    return { connected: false, authenticated: false, message: e?.message || 'Connection test failed' }
  }
}
