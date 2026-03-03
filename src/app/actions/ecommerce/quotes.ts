'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

export type QuoteStatus = 'PENDING' | 'QUOTED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'

export interface QuoteRequest {
    id: number
    contact: number
    contact_name: string
    product: number | null
    product_name: string | null
    description: string
    quantity: number
    status: QuoteStatus
    quoted_price: string | null
    quoted_notes: string
    created_at: string
    updated_at: string
}

export async function getQuotes(status?: QuoteStatus): Promise<QuoteRequest[]> {
    const params = status ? `?status=${status}` : ''
    const res = await erpFetch(`client-portal/quote-requests/${params}`, { method: 'GET' })
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data
}

export async function respondToQuote(
    id: number,
    quotedPrice: string,
    notes: string,
): Promise<{ ok: boolean; error?: string }> {
    const res = await erpFetch(`client-portal/quote-requests/${id}/respond/`, {
        method: 'POST',
        body: JSON.stringify({ quoted_price: quotedPrice, quoted_notes: notes }),
    })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return { ok: false, error: data.detail || data.error || 'Failed to respond' }
    }
    revalidatePath('/ecommerce/quotes')
    return { ok: true }
}

export async function updateQuoteStatus(
    id: number,
    status: QuoteStatus,
): Promise<{ ok: boolean; error?: string }> {
    const res = await erpFetch(`client-portal/quote-requests/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return { ok: false, error: data.detail || 'Failed to update status' }
    }
    revalidatePath('/ecommerce/quotes')
    return { ok: true }
}
