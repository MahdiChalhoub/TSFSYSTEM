'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

export interface WebhookSubscription {
    id: number
    event_type: string
    event_type_display: string
    target_url: string
    description: string
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface DeliveryLog {
    id: number
    event_type: string
    response_status: number | null
    response_body: string
    delivered_at: string | null
    failed: boolean
    error_message: string
    retry_count: number
    created_at: string
}

export interface SupportedEvent {
    value: string
    label: string
}

export async function getWebhooks(): Promise<WebhookSubscription[]> {
    const res = await erpFetch('integrations/webhooks/', { method: 'GET' })
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data
}

export async function getSupportedEvents(): Promise<SupportedEvent[]> {
    const res = await erpFetch('integrations/webhooks/supported-events/', { method: 'GET' })
    if (!res.ok) return []
    return await res.json()
}

export async function createWebhook(payload: {
    event_type: string
    target_url: string
    secret?: string
    description?: string
}): Promise<{ ok: boolean; webhook?: WebhookSubscription; error?: string }> {
    const res = await erpFetch('integrations/webhooks/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.detail || JSON.stringify(data) }
    revalidatePath('/ecommerce/webhooks')
    return { ok: true, webhook: data }
}

export async function updateWebhook(
    id: number,
    payload: Partial<{ target_url: string; description: string; is_active: boolean; secret: string }>
): Promise<{ ok: boolean; error?: string }> {
    const res = await erpFetch(`integrations/webhooks/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })
    if (!res.ok) {
        const data = await res.json()
        return { ok: false, error: data.detail || JSON.stringify(data) }
    }
    revalidatePath('/ecommerce/webhooks')
    return { ok: true }
}

export async function deleteWebhook(id: number): Promise<{ ok: boolean }> {
    const res = await erpFetch(`integrations/webhooks/${id}/`, { method: 'DELETE' })
    if (res.ok) revalidatePath('/ecommerce/webhooks')
    return { ok: res.ok }
}

export async function testWebhook(
    id: number
): Promise<{ delivered: boolean; response_status?: number; response_body?: string; error?: string }> {
    const res = await erpFetch(`integrations/webhooks/${id}/test/`, {
        method: 'POST',
        body: JSON.stringify({}),
    })
    return await res.json()
}

export async function getDeliveryLogs(id: number): Promise<DeliveryLog[]> {
    const res = await erpFetch(`integrations/webhooks/${id}/delivery-logs/`, { method: 'GET' })
    if (!res.ok) return []
    return await res.json()
}
