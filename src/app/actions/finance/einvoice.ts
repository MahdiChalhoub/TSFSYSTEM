'use server'

import { erpFetch } from '@/lib/erp-api'
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
    } catch { return [] }
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
